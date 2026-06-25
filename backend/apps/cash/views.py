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
        prev_closing = {}
        if prev_shift:
            try:
                for item in prev_shift.cash_audits.filter(channel='pos').first().items.all():
                    prev_closing[item.product_name] = item.closing_stock
            except Exception:
                pass

        # ── Revenue real por vaso — solo POS ──
        from apps.products.models import CupSize, Topping
        from apps.inventory.models import CupStock, ToppingStock

        cup_revenue = {}
        for cs in CupSize.objects.filter(is_active=True):
            name = f'Vaso {cs.size}'
            agg  = SaleItem.objects.filter(
                sale__shift=shift, sale__is_delivery=False, cup_size=cs
            ).aggregate(qty=Sum('quantity'), rev=Sum('subtotal'))
            cup_revenue[name] = {
                'sales_qty':     int(agg['qty'] or 0),
                'sales_revenue': int(agg['rev'] or 0),
            }

        # ── Catálogo ──
        catalog = []
        for cs in CupSize.objects.filter(is_active=True).order_by('price'):
            name = f'Vaso {cs.size}'
            try:    stock = cs.stock.quantity
            except: stock = 0
            catalog.append({
                'product_name':  name,
                'product_type':  'cup',
                'unit_price':    int(cs.price),
                'current_stock': stock,
                'prev_closing':  prev_closing.get(name, 0),
                **cup_revenue.get(name, {'sales_qty': 0, 'sales_revenue': 0}),
            })

        for t in Topping.objects.filter(is_active=True).order_by('name'):
            try:    stock = t.stock.quantity
            except: stock = 0
            t_agg = SaleItem.objects.filter(
                sale__shift=shift, topping=t, cup_size__isnull=True
            ).aggregate(qty=Sum('quantity'), rev=Sum('subtotal'))
            catalog.append({
                'product_name':  t.name,
                'product_type':  'topping',
                'unit_price':    int(t.price) if hasattr(t, 'price') else 0,
                'current_stock': stock,
                'prev_closing':  prev_closing.get(t.name, 0),
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
