from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from decimal import Decimal
from django.db.models import Sum
from core.permissions import IsAdmin
from apps.shifts.models import Shift
from apps.sales.models import Sale, SaleItem
from .models import CashAudit
from .serializers import CashAuditSerializer


class CashAuditViewSet(viewsets.ModelViewSet):
    serializer_class   = CashAuditSerializer
    permission_classes = [IsAdmin]

    def get_queryset(self):
        qs = CashAudit.objects.select_related('shift', 'audited_by').prefetch_related('items').all()
        shift_id = self.request.query_params.get('shift')
        channel  = self.request.query_params.get('channel')
        if shift_id:
            qs = qs.filter(shift_id=shift_id)
        if channel:
            qs = qs.filter(channel=channel)
        return qs

    def perform_create(self, serializer):
        obj = serializer.save(audited_by=self.request.user)
        obj.calculate_difference()

    @action(detail=False, methods=['get'], url_path='prefill')
    def prefill(self, request):
        """
        Pre-carga datos para el arqueo.
        Params: shift_id, channel (pos | delivery)
        """
        shift_id = request.query_params.get('shift_id')
        if shift_id:
            try:
                shift = Shift.objects.get(pk=shift_id)
            except Shift.DoesNotExist:
                return Response({'detail': 'Jornada no encontrada.'}, status=status.HTTP_404_NOT_FOUND)
        else:
            shift = Shift.get_active()
            if not shift:
                shift = Shift.objects.filter(status='closed').order_by('-closed_at').first()
        if not shift:
            return Response({'detail': 'No hay jornada.'}, status=status.HTTP_404_NOT_FOUND)

        # ── Resumen de ventas ──
        sales          = Sale.objects.filter(shift=shift)
        pos_sales      = list(sales.filter(is_delivery=False))
        delivery_sales = list(sales.filter(is_delivery=True))

        def _total(lst):    return sum(s.total for s in lst)
        def _transfer(lst): return sum(s.transfer_amount for s in lst)
        def _cash(lst):     return _total(lst) - _transfer(lst)

        pos_total    = _total(pos_sales)
        pos_transfer = _transfer(pos_sales)
        pos_cash     = _cash(pos_sales)

        delivery_total    = _total(delivery_sales)
        delivery_transfer = _transfer(delivery_sales)
        delivery_cash     = _cash(delivery_sales)

        expenses_pos_cash = sum(
            e.amount for e in shift.expenses.filter(
                from_daily_cash=True, payment_method='cash', origin='pos'
            )
        )
        expenses_dom_cash = sum(
            e.amount for e in shift.expenses.filter(
                from_daily_cash=True, payment_method='cash', origin='delivery'
            )
        )

        # ── Estado de arqueos existentes ──
        arqueos = {}
        for a in CashAudit.objects.filter(shift=shift).select_related('audited_by'):
            arqueos[a.channel] = {
                'id':            a.id,
                'audited_by':    a.audited_by.full_name if a.audited_by else '—',
                'created_at':    a.created_at,
                'actual_cash':   int(a.actual_cash),
                'cash_difference': int(a.cash_difference),
            }

        # ── Cierre de la jornada anterior ──
        prev_shift = Shift.objects.filter(opened_at__lt=shift.opened_at).order_by('-opened_at').first()
        # Matching por product_id (resistente a renombres); fallback a product_name
        prev_closing = {}   # product_id → closing_stock
        prev_closing_name = {}  # product_name → closing_stock (fallback)
        if prev_shift:
            try:
                for item in prev_shift.cash_audits.filter(channel='pos').first().items.all():
                    if item.product_id:
                        prev_closing[item.product_id] = item.closing_stock
                    prev_closing_name[item.product_name] = item.closing_stock
            except Exception:
                pass

        # ── Revenue real por vaso — solo POS, separado regular vs promo ──
        from apps.products.models import CupSize, Topping
        from apps.inventory.models import CupStock, ToppingStock

        # Incluir vasos con ventas en la jornada aunque hayan sido desactivados mid-shift
        active_ids = set(CupSize.objects.filter(is_active=True).values_list('id', flat=True))
        sales_ids  = set(CupSize.objects.filter(
            saleitem__sale__shift=shift, saleitem__sale__is_delivery=False
        ).values_list('id', flat=True))
        cups_to_process = CupSize.objects.filter(id__in=active_ids | sales_ids)

        cup_revenue = {}
        for cs in cups_to_process:
            name     = f'Vaso {cs.size}'
            base_qs  = SaleItem.objects.filter(sale__shift=shift, sale__is_delivery=False, cup_size=cs)

            # Ventas a precio regular (sin promoción)
            reg = base_qs.filter(sale__promotion__isnull=True).aggregate(qty=Sum('quantity'), rev=Sum('subtotal'))
            # Ventas con promoción (precio diferente)
            promo_items = base_qs.filter(sale__promotion__isnull=False)
            promo = promo_items.aggregate(qty=Sum('quantity'), rev=Sum('subtotal'))

            # Precio unitario promedio de promo (para mostrar en tabla)
            promo_unit = None
            if int(promo['qty'] or 0) > 0:
                promo_unit = int(int(promo['rev'] or 0) / int(promo['qty']))

            cup_revenue[name] = {
                'regular_qty':     int(reg['qty'] or 0),
                'regular_revenue': int(reg['rev'] or 0),
                'promo_qty':       int(promo['qty'] or 0),
                'promo_revenue':   int(promo['rev'] or 0),
                'promo_unit':      promo_unit,
                # totales consolidados
                'sales_qty':     int((reg['qty'] or 0) + (promo['qty'] or 0)),
                'sales_revenue': int((reg['rev'] or 0) + (promo['rev'] or 0)),
            }

        # ── Catálogo ──
        catalog = []
        for cs in cups_to_process.order_by('price'):
            name = f'Vaso {cs.size}'
            try:    stock = cs.stock.quantity
            except: stock = 0
            prev = prev_closing.get(cs.pk, prev_closing_name.get(name, 0))
            catalog.append({
                'product_name':  name,
                'product_type':  'cup',
                'product_id':    cs.pk,
                'unit_price':    int(cs.price),
                'current_stock': stock,
                'prev_closing':  prev,
                **cup_revenue.get(name, {'sales_qty': 0, 'sales_revenue': 0,
                                         'regular_qty': 0, 'regular_revenue': 0,
                                         'promo_qty': 0, 'promo_revenue': 0, 'promo_unit': None}),
            })

        for t in Topping.objects.filter(is_active=True).order_by('name'):
            try:    stock = t.stock.quantity
            except: stock = 0
            t_agg = SaleItem.objects.filter(
                sale__shift=shift, topping=t, cup_size__isnull=True
            ).aggregate(qty=Sum('quantity'), rev=Sum('subtotal'))
            prev_t = prev_closing.get(t.pk, prev_closing_name.get(t.name, 0))
            catalog.append({
                'product_name':  t.name,
                'product_type':  'topping',
                'product_id':    t.pk,
                'unit_price':    int(t.price) if hasattr(t, 'price') else 0,
                'current_stock': stock,
                'prev_closing':  prev_t,
                'sales_qty':     int(t_agg['qty'] or 0),
                'sales_revenue': int(t_agg['rev'] or 0),
            })

        return Response({
            'shift_id': shift.id,
            # POS
            'pos_total':          pos_total,
            'pos_cash':           pos_cash,
            'pos_transfer':       pos_transfer,
            'expenses_from_cash': expenses_pos_cash,
            'net_expected_cash':  pos_cash - expenses_pos_cash,
            'expected_cash':      pos_cash,
            'expected_transfer':  pos_transfer,
            # Domicilios
            'delivery_total':         delivery_total,
            'delivery_cash':          delivery_cash,
            'delivery_transfer':      delivery_transfer,
            'delivery_expenses_cash': expenses_dom_cash,
            'delivery_net_cash':      delivery_cash - expenses_dom_cash,
            # Catálogo (liquidación solo POS)
            'catalog': catalog,
            # Estado de arqueos
            'arqueos': arqueos,
        })
