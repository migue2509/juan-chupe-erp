from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from decimal import Decimal
from collections import defaultdict
from django.db.models import Sum
from core.permissions import IsAdmin
from apps.shifts.models import Shift
from apps.sales.models import Sale, SaleItem
from .models import CashAudit, SellerCashDelivery
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

    @action(detail=False, methods=['post'], url_path='save-seller-deliveries')
    def save_seller_deliveries(self, request):
        """Guarda el monto entregado por cada vendedora (canal POS)."""
        shift_id   = request.data.get('shift_id')
        deliveries = request.data.get('deliveries', [])
        try:
            shift = Shift.objects.get(pk=shift_id)
        except Shift.DoesNotExist:
            return Response({'detail': 'Jornada no encontrada.'}, status=status.HTTP_404_NOT_FOUND)

        for d in deliveries:
            sid = d.get('seller_id')  # puede ser None
            if sid is None:
                obj = SellerCashDelivery.objects.filter(shift=shift, seller_id__isnull=True).first()
            else:
                obj = SellerCashDelivery.objects.filter(shift=shift, seller_id=sid).first()

            if obj:
                obj.net_delivered = d.get('net_delivered', 0)
                obj.seller_name   = d.get('seller_name', '')
                obj.save(update_fields=['net_delivered', 'seller_name', 'updated_at'])
            else:
                SellerCashDelivery.objects.create(
                    shift=shift,
                    seller_id=sid,
                    seller_name=d.get('seller_name', ''),
                    net_delivered=d.get('net_delivered', 0),
                )
        return Response({'ok': True})

    @action(detail=False, methods=['post'], url_path='save-delivery-amount')
    def save_delivery_amount(self, request):
        """Guarda el monto entregado del canal domicilios (seller_id=None)."""
        shift_id      = request.data.get('shift_id')
        net_delivered = request.data.get('net_delivered', 0)
        try:
            shift = Shift.objects.get(pk=shift_id)
        except Shift.DoesNotExist:
            return Response({'detail': 'Jornada no encontrada.'}, status=status.HTTP_404_NOT_FOUND)

        obj = SellerCashDelivery.objects.filter(shift=shift, seller_id__isnull=True).first()
        if obj:
            obj.net_delivered = net_delivered
            obj.seller_name   = 'Domicilios'
            obj.save(update_fields=['net_delivered', 'seller_name', 'updated_at'])
        else:
            SellerCashDelivery.objects.create(
                shift=shift,
                seller_id=None,
                seller_name='Domicilios',
                net_delivered=net_delivered,
            )
        return Response({'ok': True})

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
        expenses_pos_transfer = sum(
            e.amount for e in shift.expenses.filter(
                from_daily_cash=True, payment_method='transfer', origin='pos'
            )
        )
        expenses_pos_no_cash = sum(
            e.amount for e in shift.expenses.filter(
                from_daily_cash=False, origin='pos'
            )
        )
        expenses_dom_cash = sum(
            e.amount for e in shift.expenses.filter(
                from_daily_cash=True, payment_method='cash', origin='delivery'
            )
        )
        expenses_dom_transfer = sum(
            e.amount for e in shift.expenses.filter(
                from_daily_cash=True, payment_method='transfer', origin='delivery'
            )
        )
        expenses_dom_no_cash = sum(
            e.amount for e in shift.expenses.filter(
                from_daily_cash=False, origin='delivery'
            )
        )

        # ── Resumen por domiciliario ──
        from apps.deliveries.models import Delivery
        dom_groups = defaultdict(lambda: {'name': 'Sin asignar', 'count': 0, 'total': Decimal('0'), 'cash': Decimal('0'), 'transfer': Decimal('0')})
        for d in Delivery.objects.filter(shift=shift).exclude(status='cancelled').select_related('delivery_person', 'sale'):
            key = d.delivery_person_id or 0
            if d.delivery_person:
                dom_groups[key]['name'] = d.delivery_person.name
            dom_groups[key]['count']    += 1
            dom_groups[key]['total']    += d.sale.total
            dom_groups[key]['cash']     += d.sale.total - d.sale.transfer_amount
            dom_groups[key]['transfer'] += d.sale.transfer_amount

        delivery_breakdown = sorted([
            {
                'id':       did,
                'name':     info['name'],
                'count':    info['count'],
                'total':    int(info['total']),
                'cash':     int(info['cash']),
                'transfer': int(info['transfer']),
            }
            for did, info in dom_groups.items()
        ], key=lambda x: -x['count'])

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

        # ── Cuadre por vendedora (solo canal POS) ──
        seller_groups = defaultdict(lambda: {'name': 'Sin vendedora', 'cash': Decimal('0'), 'transfer': Decimal('0')})
        for s in pos_sales:
            key = s.seller_id
            if key is not None:
                seller_groups[key]['name'] = s.seller_name or '—'
            seller_groups[key]['cash']     += s.total - s.transfer_amount
            seller_groups[key]['transfer'] += s.transfer_amount

        # Cargar montos guardados
        saved_map = {}
        for d in SellerCashDelivery.objects.filter(shift=shift):
            saved_map[d.seller_id] = d.net_delivered

        # Gastos en efectivo POS por vendedora (quien los registró pagó de su caja)
        seller_expenses_cash = defaultdict(Decimal)
        for e in shift.expenses.filter(from_daily_cash=True, payment_method='cash', origin='pos'):
            if e.registered_by_id is not None:
                seller_expenses_cash[e.registered_by_id] += e.amount

        sellers_breakdown = sorted([
            {
                'seller_id':    sid,
                'seller_name':  info['name'],
                'pos_cash':     int(info['cash']),
                'pos_transfer': int(info['transfer']),
                'expenses_cash': int(seller_expenses_cash.get(sid, 0)),
                'net_delivered': int(saved_map[sid]) if sid in saved_map and saved_map[sid] is not None else None,
            }
            for sid, info in seller_groups.items()
        ], key=lambda x: x['seller_name'] or '')

        # Monto entregado del canal domicilios
        dom_saved = saved_map.get(None)
        delivery_net_delivered = int(dom_saved) if dom_saved is not None else None

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

        # ── Ingresos de inventario en la jornada actual ──
        # product_id → entries (unidades que entraron al inventario durante el turno)
        current_entries = {}   # product_id → entries
        current_entries_name = {}  # product_name → entries (fallback)
        try:
            current_audit = shift.cash_audits.filter(channel='pos').first()
            if current_audit:
                for item in current_audit.items.all():
                    if item.product_id:
                        current_entries[item.product_id] = item.entries
                    current_entries_name[item.product_name] = item.entries
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
            prev    = prev_closing.get(cs.pk, prev_closing_name.get(name, 0))
            entries = current_entries.get(cs.pk, current_entries_name.get(name, 0))
            catalog.append({
                'product_name':  name,
                'product_type':  'cup',
                'product_id':    cs.pk,
                'unit_price':    int(cs.price),
                'current_stock': stock,
                'prev_closing':  prev,
                'entries':       entries,   # ingresos al inventario durante la jornada
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
            'pos_total':              pos_total,
            'pos_cash':               pos_cash,
            'pos_transfer':           pos_transfer,
            'expenses_from_cash':     expenses_pos_cash,       # gastos efectivo que salen de caja
            'expenses_pos_transfer':  expenses_pos_transfer,   # gastos transferencia POS (informativo)
            'expenses_pos_no_cash':   expenses_pos_no_cash,    # gastos que no afectan caja POS
            'net_expected_cash':      pos_cash - expenses_pos_cash,  # solo resta gastos en efectivo
            'expected_cash':          pos_cash,
            'expected_transfer':      pos_transfer,
            # Domicilios
            'delivery_total':           delivery_total,
            'delivery_cash':            delivery_cash,
            'delivery_transfer':        delivery_transfer,
            'delivery_expenses_cash':   expenses_dom_cash,       # gastos efectivo domicilios
            'delivery_expenses_transfer': expenses_dom_transfer, # gastos transferencia domicilios
            'delivery_expenses_no_cash':  expenses_dom_no_cash,  # gastos que no afectan caja dom
            'delivery_net_cash':        delivery_cash - expenses_dom_cash,
            'delivery_net_delivered':   delivery_net_delivered,
            # Resumen por domiciliario
            'delivery_breakdown': delivery_breakdown,
            # Cuadre por vendedora
            'sellers_breakdown': sellers_breakdown,
            # Catálogo (liquidación solo POS)
            'catalog': catalog,
            # Estado de arqueos
            'arqueos': arqueos,
        })
