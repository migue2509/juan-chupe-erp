from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.decorators import api_view, permission_classes
from django.db.models import Sum, Count
from django.utils import timezone
from datetime import timedelta
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

        sales = Sale.objects.filter(shift=shift)
        total_sales = sales.aggregate(total=Sum('total'))['total'] or Decimal('0')
        total_cash = sum(s.cash_received for s in sales if s.payment_method in ('cash', 'mixed'))
        total_transfer = sum(s.transfer_amount for s in sales if s.payment_method in ('transfer', 'mixed'))

        expenses = Expense.objects.filter(shift=shift)
        total_expenses = expenses.aggregate(total=Sum('amount'))['total'] or Decimal('0')
        expenses_from_cash = expenses.filter(from_daily_cash=True).aggregate(total=Sum('amount'))['total'] or Decimal('0')

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
            total = Sale.objects.filter(shift=shift).aggregate(t=Sum('total'))['t'] or Decimal('0')
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
        total = Sale.objects.filter(shift__in=shifts).aggregate(t=Sum('total'))['t'] or Decimal('0')
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
