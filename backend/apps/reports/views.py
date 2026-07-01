from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.decorators import api_view, permission_classes
from django.db.models import Sum, Count, Q
from django.utils import timezone
from datetime import timedelta, date as date_type
from decimal import Decimal
from core.permissions import IsAdmin
from apps.shifts.models import Shift
from apps.sales.models import Sale, SaleItem, SaleItemFlavor
from apps.expenses.models import Expense
from apps.inventory.models import FlavorBag, CupStock


class DailySummaryView(APIView):
    permission_classes = [IsAdmin]

    def get(self, request):
        shift_id = request.query_params.get('shift_id')
        if shift_id:
            try:
                shift = Shift.objects.get(id=shift_id)
            except Shift.DoesNotExist:
                return Response({'detail': 'Jornada no encontrada.'}, status=404)
        else:
            shift = Shift.get_active() or Shift.objects.order_by('-opened_at').first()

        if not shift:
            return Response({'detail': 'No hay jornadas.'}, status=404)

        sales = Sale.objects.filter(shift=shift).exclude(invoice__voided=True)
        total_sales    = sales.aggregate(total=Sum('total'))['total'] or Decimal('0')
        total_transfer = sum(s.transfer_amount for s in sales)
        total_cash     = total_sales - total_transfer

        expenses = Expense.objects.filter(shift=shift)
        total_expenses = expenses.aggregate(total=Sum('amount'))['total'] or Decimal('0')
        daily_expenses = expenses.filter(from_daily_cash=True)
        expenses_from_cash = daily_expenses.filter(payment_method='cash').aggregate(total=Sum('amount'))['total'] or Decimal('0')
        expenses_from_transfer = daily_expenses.filter(payment_method='transfer').aggregate(total=Sum('amount'))['total'] or Decimal('0')

        # Sales by flavor
        flavor_sales = []
        for sif in SaleItemFlavor.objects.filter(sale_item__sale__shift=shift).select_related('flavor'):
            flavor_sales.append({'flavor': sif.flavor.name, 'ml': float(sif.ml_consumed)})

        # Sales by cup size
        cup_sales = SaleItem.objects.filter(sale__shift=shift).values(
            'cup_size__size'
        ).annotate(count=Count('id'), total=Sum('subtotal'))

        # Deliveries count
        deliveries_count = sales.filter(is_delivery=True).count()

        return Response({
            'shift': {'id': shift.id, 'opened_at': shift.opened_at, 'status': shift.status},
            'total_sales': float(total_sales),
            'total_cash': float(total_cash),
            'total_transfer': float(total_transfer),
            'sales_count': sales.count(),
            'deliveries_count': deliveries_count,
            'total_expenses': float(total_expenses),
            'expenses_from_cash': float(expenses_from_cash),
            'expenses_from_transfer': float(expenses_from_transfer),
            'net_cash': float(total_cash - expenses_from_cash),
            'flavor_sales': flavor_sales,
            'cup_sales': list(cup_sales),
        })


class WeeklyReportView(APIView):
    permission_classes = [IsAdmin]

    def get(self, request):
        end = timezone.now()
        start = end - timedelta(days=7)
        shifts = Shift.objects.filter(opened_at__gte=start, opened_at__lte=end)
        data = []
        for shift in shifts:
            total = Sale.objects.filter(shift=shift).exclude(invoice__voided=True).aggregate(t=Sum('total'))['t'] or Decimal('0')
            data.append({
                'date': shift.opened_at.strftime('%d/%m/%Y'),
                'total': float(total),
                'shift_id': shift.id,
            })
        return Response({'period': '7 días', 'data': data, 'grand_total': sum(d['total'] for d in data)})


class MonthlyReportView(APIView):
    permission_classes = [IsAdmin]

    def get(self, request):
        now = timezone.now()
        start = now.replace(day=1, hour=0, minute=0, second=0)
        shifts = Shift.objects.filter(opened_at__gte=start)
        total = Sale.objects.filter(shift__in=shifts).exclude(invoice__voided=True).aggregate(t=Sum('total'))['t'] or Decimal('0')
        expense_total = Expense.objects.filter(shift__in=shifts).aggregate(t=Sum('amount'))['t'] or Decimal('0')
        return Response({
            'month': now.strftime('%B %Y'),
            'total_sales': float(total),
            'total_expenses': float(expense_total),
            'net': float(total - expense_total),
            'shifts_count': shifts.count(),
        })


class InventoryStatusView(APIView):
    permission_classes = [IsAdmin]

    def get(self, request):
        bags = FlavorBag.objects.select_related('flavor').all()
        cups = CupStock.objects.select_related('cup_size').all()
        return Response({
            'bags': [
                {
                    'flavor': b.flavor.name,
                    'category': b.category,
                    'stock_ml': float(b.stock_ml),
                    'min_stock_ml': float(b.min_stock_ml),
                    'is_low': b.is_low_stock,
                }
                for b in bags
            ],
            'cups': [
                {
                    'size': c.cup_size.size,
                    'quantity': c.quantity,
                    'min_quantity': c.min_quantity,
                    'is_low': c.is_low_stock,
                }
                for c in cups
            ],
        })


class RangeReportView(APIView):
    """Reporte para rango de fechas arbitrario. Params: date_from, date_to (YYYY-MM-DD)"""
    permission_classes = [IsAdmin]

    def get(self, request):
        from django.utils.dateparse import parse_date
        import datetime

        date_from_str = request.query_params.get('date_from')
        date_to_str   = request.query_params.get('date_to')
        channel       = request.query_params.get('channel', 'all')  # all | pos | delivery

        today_local = timezone.localdate()
        date_from = parse_date(date_from_str) if date_from_str else today_local
        date_to   = parse_date(date_to_str)   if date_to_str   else today_local

        start_dt = timezone.make_aware(datetime.datetime.combine(date_from, datetime.time.min))
        end_dt   = timezone.make_aware(datetime.datetime.combine(date_to,   datetime.time.max))

        # ── Base querysets ────────────────────────────────────────────────────
        sales_qs = Sale.objects.filter(
            created_at__gte=start_dt, created_at__lte=end_dt,
        ).exclude(invoice__voided=True)
        if channel == 'pos':
            sales_qs = sales_qs.filter(is_delivery=False)
        elif channel == 'delivery':
            sales_qs = sales_qs.filter(is_delivery=True)
        sales = sales_qs.select_related('seller')

        expenses_qs = Expense.objects.filter(created_at__gte=start_dt, created_at__lte=end_dt)
        if channel == 'pos':
            expenses_qs = expenses_qs.filter(origin='pos')
        elif channel == 'delivery':
            expenses_qs = expenses_qs.filter(origin='delivery')

        # ── Ventas por vendedora ──────────────────────────────────────────────
        seller_map = {}
        for s in sales:
            name = (s.seller.full_name or s.seller.username) if s.seller else 'Sin asignar'
            if name not in seller_map:
                seller_map[name] = {'name': name, 'total': 0, 'count': 0}
            paid = float(s.courtesy_paid) if s.is_courtesy else float(s.total)
            seller_map[name]['total'] += paid
            seller_map[name]['count'] += 1
        sellers = sorted(seller_map.values(), key=lambda x: x['total'], reverse=True)

        # ── Medio de pago ─────────────────────────────────────────────────────
        # efectivo real = total - transfer_amount (cash_received incluye vuelto)
        total_transfer = sum(float(s.transfer_amount) for s in sales)
        total_sales    = sum(
            float(s.courtesy_paid) if s.is_courtesy else float(s.total)
            for s in sales
        )
        total_cash  = total_sales - total_transfer
        total_money = total_sales

        # ── Ventas por tamaño de vaso ─────────────────────────────────────────
        cup_items = SaleItem.objects.filter(
            sale__in=sales, cup_size__isnull=False,
        ).values('cup_size__size').annotate(count=Count('id'), total=Sum('subtotal'))
        cup_sales = [{'size': r['cup_size__size'], 'count': r['count'], 'total': float(r['total'] or 0)} for r in cup_items]

        # ── Sabores más vendidos ──────────────────────────────────────────────
        flavor_sales_qs = SaleItemFlavor.objects.filter(
            sale_item__sale__in=sales,
        ).values('flavor__name').annotate(total_ml=Sum('ml_consumed')).order_by('-total_ml')
        flavors = [{'name': r['flavor__name'], 'ml': float(r['total_ml'] or 0)} for r in flavor_sales_qs]

        # ── Gastos ────────────────────────────────────────────────────────────
        daily_exp_qs = expenses_qs.filter(from_daily_cash=True)
        total_expenses          = float(daily_exp_qs.aggregate(t=Sum('amount'))['t'] or 0)
        total_expenses_cash     = float(daily_exp_qs.filter(payment_method='cash').aggregate(t=Sum('amount'))['t'] or 0)
        total_expenses_transfer = float(daily_exp_qs.filter(payment_method='transfer').aggregate(t=Sum('amount'))['t'] or 0)

        CATEGORY_LABELS = {
            'business': 'Gasto del Negocio',
            'personal': 'Gasto Personal',
            'petty_cash': 'Caja Menor',
            'supply': 'Ingreso de Mercancía',
        }
        expense_by_cat = []
        for cat, label in CATEGORY_LABELS.items():
            qs_cat = expenses_qs.filter(category=cat)
            total    = float(qs_cat.aggregate(t=Sum('amount'))['t'] or 0)
            if total > 0:
                qs_box     = qs_cat.filter(from_daily_cash=True)
                qs_no_box  = qs_cat.filter(from_daily_cash=False)
                cash_amt     = float(qs_box.filter(payment_method='cash').aggregate(t=Sum('amount'))['t'] or 0)
                transfer_amt = float(qs_box.filter(payment_method='transfer').aggregate(t=Sum('amount'))['t'] or 0)
                afecta_caja  = float(qs_box.aggregate(t=Sum('amount'))['t'] or 0)
                no_afecta    = float(qs_no_box.aggregate(t=Sum('amount'))['t'] or 0)
                expense_by_cat.append({
                    'category':    label,
                    'total':       total,
                    'cash':        cash_amt,
                    'transfer':    transfer_amt,
                    'afecta_caja': afecta_caja,
                    'no_afecta':   no_afecta,
                })
        expense_by_cat.sort(key=lambda x: x['total'], reverse=True)

        # ── Domicilios ────────────────────────────────────────────────────────
        from apps.deliveries.models import Delivery
        deliveries_qs = Delivery.objects.filter(created_at__gte=start_dt, created_at__lte=end_dt)
        delivery_sales = Sale.objects.filter(
            created_at__gte=start_dt, created_at__lte=end_dt, is_delivery=True
        )
        delivery_total = sum(
            (float(s.courtesy_paid) if s.is_courtesy else float(s.total))
            for s in delivery_sales
        )
        delivery_stats = {
            'total':     deliveries_qs.count(),
            'pending':   deliveries_qs.filter(status='pending').count(),
            'on_way':    deliveries_qs.filter(status='on_way').count(),
            'delivered': deliveries_qs.filter(status='delivered').count(),
            'cancelled': deliveries_qs.filter(status='cancelled').count(),
            'revenue':   delivery_total,
        }

        return Response({
            'date_from':      str(date_from),
            'date_to':        str(date_to),
            'channel':        channel,
            'total_sales':    total_sales,
            'total_cash':     total_cash,
            'total_transfer': total_transfer,
            'total_money':    total_money,
            'total_expenses':          total_expenses,
            'total_expenses_cash':     total_expenses_cash,
            'total_expenses_transfer': total_expenses_transfer,
            'net_cash':                total_money - total_expenses,
            'net_efectivo':            total_cash - total_expenses_cash,
            'net_transfer':            total_transfer - total_expenses_transfer,
            'sales_count':    sales.count(),
            'sellers':        sellers,
            'cup_sales':      cup_sales,
            'flavors':        flavors,
            'expense_by_cat': expense_by_cat,
            'deliveries':     delivery_stats,
            'payment_pct': {
                'cash':     round(total_cash     / total_money * 100) if total_money else 0,
                'transfer': round(total_transfer / total_money * 100) if total_money else 0,
            },
        })
