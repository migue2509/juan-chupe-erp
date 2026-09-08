from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from decimal import Decimal, InvalidOperation
from collections import defaultdict
from django.core.exceptions import ObjectDoesNotExist
from django.db import transaction
from django.db.models import Sum
from core.permissions import IsAdmin
from apps.shifts.models import Shift
from apps.sales.models import Sale, SaleItem
from apps.sales.selectors import active_sales
from .models import CashAudit, SellerCashDelivery
from .serializers import CashAuditSerializer


class CashAuditViewSet(viewsets.ModelViewSet):
    serializer_class   = CashAuditSerializer
    permission_classes = [IsAdmin]

    def _non_negative_decimal(self, value, field_name):
        try:
            amount = Decimal(str(value if value not in (None, '') else 0))
        except (InvalidOperation, TypeError, ValueError):
            raise ValueError(f'{field_name} debe ser un numero valido.')
        if amount < 0:
            raise ValueError(f'{field_name} no puede ser negativo.')
        return amount

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
        if not isinstance(deliveries, list):
            return Response({'detail': 'deliveries debe ser una lista.'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            shift = Shift.objects.get(pk=shift_id)
        except Shift.DoesNotExist:
            return Response({'detail': 'Jornada no encontrada.'}, status=status.HTTP_404_NOT_FOUND)

        try:
            with transaction.atomic():
                for d in deliveries:
                    if not isinstance(d, dict):
                        raise ValueError('Cada entrega debe ser un objeto.')
                    sid = d.get('seller_id')
                    if sid in (None, ''):
                        raise ValueError('seller_id es requerido para entregas POS.')
                    try:
                        seller_id = int(sid)
                    except (TypeError, ValueError):
                        raise ValueError('seller_id debe ser un numero valido.')
                    if seller_id <= 0:
                        raise ValueError('seller_id debe ser mayor a cero.')
                    net_delivered = self._non_negative_decimal(d.get('net_delivered', 0), 'net_delivered')
                    SellerCashDelivery.objects.update_or_create(
                        shift=shift,
                        seller_id=seller_id,
                        defaults={
                            'seller_name': d.get('seller_name', ''),
                            'net_delivered': net_delivered,
                        },
                    )
        except ValueError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response({'ok': True})

    @action(detail=False, methods=['post'], url_path='save-delivery-amount')
    def save_delivery_amount(self, request):
        """Guarda el monto entregado del canal domicilios (seller_id=None)."""
        shift_id = request.data.get('shift_id')
        try:
            net_delivered = self._non_negative_decimal(request.data.get('net_delivered', 0), 'net_delivered')
        except ValueError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        try:
            shift = Shift.objects.get(pk=shift_id)
        except Shift.DoesNotExist:
            return Response({'detail': 'Jornada no encontrada.'}, status=status.HTTP_404_NOT_FOUND)

        with transaction.atomic():
            SellerCashDelivery.objects.update_or_create(
                shift=shift,
                seller_id=None,
                defaults={
                    'seller_name': 'Domicilios',
                    'net_delivered': net_delivered,
                },
            )
        return Response({'ok': True})

    def perform_create(self, serializer):
        obj = serializer.save(audited_by=self.request.user)
        obj.calculate_difference()

    def perform_update(self, serializer):
        obj = serializer.save()
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
        sales          = active_sales(Sale.objects.filter(shift=shift)).select_related('invoice', 'promotion', 'seller')
        pos_inventory_sales = sales.filter(is_delivery=False)
        pos_sales      = list(pos_inventory_sales.exclude(promotion__category__in=['rappi', 'didi']))
        delivery_sales = list(sales.filter(is_delivery=True))

        def _total(lst):    return sum(s.paid_total for s in lst)
        def _transfer(lst): return sum(s.transfer_paid for s in lst)
        def _cash(lst):     return sum(s.cash_amount for s in lst)

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
        for d in Delivery.objects.filter(shift=shift).exclude(status='cancelled').select_related('delivery_person', 'sale', 'sale__invoice'):
            try:
                if d.sale.invoice.voided:
                    continue
            except ObjectDoesNotExist:
                pass
            key = d.delivery_person_id or 0
            if d.delivery_person:
                dom_groups[key]['name'] = d.delivery_person.name
            dom_groups[key]['count']    += 1
            dom_groups[key]['total']    += d.sale.paid_total
            dom_groups[key]['cash']     += d.sale.cash_amount
            dom_groups[key]['transfer'] += d.sale.transfer_paid

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
            seller_groups[key]['cash']     += s.cash_amount
            seller_groups[key]['transfer'] += s.transfer_paid

        # Cargar montos guardados
        saved_map = {}
        saved_names = {}
        for d in SellerCashDelivery.objects.filter(shift=shift):
            saved_map[d.seller_id] = d.net_delivered
            if d.seller_id is not None:
                saved_names[d.seller_id] = d.seller_name

        # Gastos en efectivo POS por vendedora (quien los registró pagó de su caja)
        seller_expenses_cash = defaultdict(Decimal)
        for e in shift.expenses.filter(
            from_daily_cash=True, payment_method='cash', origin='pos'
        ).select_related('registered_by'):
            if e.registered_by_id is not None:
                if seller_groups[e.registered_by_id]['name'] == 'Sin vendedora':
                    seller_groups[e.registered_by_id]['name'] = (
                        e.registered_by.full_name if e.registered_by else '-'
                    )
                seller_expenses_cash[e.registered_by_id] += e.amount

        for seller_id, seller_name in saved_names.items():
            if seller_groups[seller_id]['name'] == 'Sin vendedora':
                seller_groups[seller_id]['name'] = seller_name or '-'

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
        prev_closing = {}
        prev_closing_name = {}
        if prev_shift:
            try:
                for item in prev_shift.cash_audits.filter(channel='pos').first().items.all():
                    if item.product_id:
                        prev_closing[(item.product_type, item.product_id)] = item.closing_stock
                    prev_closing_name[(item.product_type, item.product_name)] = item.closing_stock
            except Exception:
                pass

        # ── Ingresos de inventario en la jornada actual ──
        # product_id → entries (unidades que entraron al inventario durante el turno)
        current_opening = {}
        current_opening_name = {}
        current_entries = {}
        current_entries_name = {}
        current_closing = {}
        current_closing_name = {}
        current_audit_product_ids = defaultdict(set)
        current_audit = None
        try:
            current_audit = shift.cash_audits.filter(channel='pos').first()
            if current_audit:
                for item in current_audit.items.all():
                    if item.product_id:
                        typed_key = (item.product_type, item.product_id)
                        current_opening[typed_key] = item.opening_stock
                        current_entries[typed_key] = item.entries
                        current_closing[typed_key] = item.closing_stock
                        current_audit_product_ids[item.product_type].add(item.product_id)
                    typed_name = (item.product_type, item.product_name)
                    current_opening_name[typed_name] = item.opening_stock
                    current_entries_name[typed_name] = item.entries
                    current_closing_name[typed_name] = item.closing_stock
        except Exception:
            pass

        # ── Revenue real por vaso — solo POS, separado regular vs promo ──
        from apps.products.models import CupSize, Topping
        from apps.inventory.models import StockMovement

        movement_entries = {}
        if not current_audit:
            for row in StockMovement.objects.filter(
                shift=shift,
                movement_type='in',
                cup_stock__isnull=False,
            ).values('cup_stock__cup_size_id').annotate(total=Sum('quantity_units')):
                movement_entries[row['cup_stock__cup_size_id']] = int(row['total'] or 0)

        # Incluir vasos con ventas en la jornada aunque hayan sido desactivados mid-shift
        active_ids = set(CupSize.objects.filter(is_active=True).values_list('id', flat=True))
        sales_ids  = set(SaleItem.objects.filter(
            sale__in=pos_inventory_sales, cup_size__isnull=False
        ).values_list('cup_size_id', flat=True))
        cups_to_process = CupSize.objects.filter(
            id__in=active_ids | sales_ids | current_audit_product_ids['cup']
        )

        cup_revenue = {}
        for cs in cups_to_process:
            name     = f'Vaso {cs.size}'
            base_qs  = SaleItem.objects.filter(sale__in=pos_inventory_sales, cup_size=cs)

            # Ventas a precio regular (sin promoción)
            reg = base_qs.filter(sale__promotion__isnull=True).aggregate(qty=Sum('quantity'), rev=Sum('subtotal'))
            # Ventas con promoción POS (excluye Rappi/DiDi)
            pos_promo = base_qs.filter(
                sale__promotion__isnull=False
            ).exclude(sale__promotion__category__in=['rappi', 'didi']).aggregate(qty=Sum('quantity'), rev=Sum('subtotal'))
            # Ventas de plataforma — se muestran en unidades pero liquidan en $0
            plat = base_qs.filter(
                sale__promotion__category__in=['rappi', 'didi']
            ).aggregate(qty=Sum('quantity'))

            # Precio unitario promedio de promo POS (para mostrar en tabla)
            promo_unit = None
            if int(pos_promo['qty'] or 0) > 0:
                promo_unit = int(int(pos_promo['rev'] or 0) / int(pos_promo['qty']))

            cup_revenue[name] = {
                'regular_qty':     int(reg['qty'] or 0),
                'regular_revenue': int(reg['rev'] or 0),
                'promo_qty':       int(pos_promo['qty'] or 0),
                'promo_revenue':   int(pos_promo['rev'] or 0),
                'promo_unit':      promo_unit,
                'plat_qty':        int(plat['qty'] or 0),
                # totales: qty incluye plataformas, revenue NO (se liquidan en $0)
                'sales_qty':     int((reg['qty'] or 0) + (pos_promo['qty'] or 0) + (plat['qty'] or 0)),
                'sales_revenue': int((reg['rev'] or 0) + (pos_promo['rev'] or 0)),
            }

        # ── Catálogo ──
        catalog = []
        for cs in cups_to_process.order_by('price'):
            name = f'Vaso {cs.size}'
            try:    stock = cs.stock.quantity
            except: stock = 0
            revenue = cup_revenue.get(name, {'sales_qty': 0, 'sales_revenue': 0,
                                             'regular_qty': 0, 'regular_revenue': 0,
                                             'promo_qty': 0, 'promo_revenue': 0, 'promo_unit': None,
                                             'plat_qty': 0})
            cup_key = ('cup', cs.pk)
            cup_name_key = ('cup', name)
            entries = current_entries.get(
                cup_key,
                current_entries_name.get(cup_name_key, movement_entries.get(cs.pk, 0))
            )
            prev = current_opening.get(
                cup_key,
                current_opening_name.get(
                    cup_name_key,
                    prev_closing.get(cup_key, prev_closing_name.get(cup_name_key))
                )
            )
            if prev is None:
                prev = max(0, int(stock) + int(revenue['sales_qty'] or 0) - int(entries or 0))
            closing = current_closing.get(cup_key, current_closing_name.get(cup_name_key))
            catalog.append({
                'product_name':  name,
                'product_type':  'cup',
                'product_id':    cs.pk,
                'unit_price':    int(cs.price),
                'current_stock': stock,
                'prev_closing':  prev,
                'entries':       entries,   # ingresos al inventario durante la jornada
                'closing_stock':  closing,
                **revenue,
            })

        active_topping_ids = set(Topping.objects.filter(is_active=True).values_list('id', flat=True))
        topping_sales_ids = set(SaleItem.objects.filter(
            sale__in=pos_inventory_sales, cup_size__isnull=True, topping__isnull=False
        ).values_list('topping_id', flat=True))
        toppings_to_process = Topping.objects.filter(
            id__in=active_topping_ids | topping_sales_ids | current_audit_product_ids['topping']
        )
        for t in toppings_to_process.order_by('name'):
            try:    stock = t.stock.quantity
            except: stock = 0
            t_agg = SaleItem.objects.filter(
                sale__in=pos_inventory_sales, topping=t, cup_size__isnull=True
            ).aggregate(qty=Sum('quantity'), rev=Sum('subtotal'))
            topping_key = ('topping', t.pk)
            topping_name_key = ('topping', t.name)
            prev_t = current_opening.get(
                topping_key,
                current_opening_name.get(
                    topping_name_key,
                    prev_closing.get(topping_key, prev_closing_name.get(topping_name_key, 0))
                )
            )
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

        catalog_keys = {
            (row['product_type'], row['product_id']) if row.get('product_id')
            else (row['product_type'], row['product_name'])
            for row in catalog
        }
        if current_audit:
            for item in current_audit.items.all():
                key = (item.product_type, item.product_id) if item.product_id else (item.product_type, item.product_name)
                if key in catalog_keys:
                    continue
                catalog.append({
                    'product_name':  item.product_name,
                    'product_type':  item.product_type,
                    'product_id':    item.product_id,
                    'unit_price':    int(item.unit_price),
                    'current_stock': 0,
                    'prev_closing':  item.opening_stock,
                    'entries':       item.entries,
                    'closing_stock': item.closing_stock,
                    'regular_qty':   0,
                    'regular_revenue': 0,
                    'promo_qty':     0,
                    'promo_revenue': 0,
                    'promo_unit':    None,
                    'plat_qty':      0,
                    'sales_qty':     item.sold,
                    'sales_revenue': 0,
                })
                catalog_keys.add(key)

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
