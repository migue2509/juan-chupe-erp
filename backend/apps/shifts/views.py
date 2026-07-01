from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from core.permissions import IsAdmin, IsOperative
from .models import Shift
from .serializers import ShiftSerializer


class ShiftViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Shift.objects.all()
    serializer_class = ShiftSerializer

    @action(detail=False, methods=['post'], permission_classes=[IsAdmin])
    def open(self, request):
        active = Shift.get_active()
        if active:
            return Response(
                {'detail': 'Ya hay una jornada activa.', 'shift': ShiftSerializer(active).data},
                status=status.HTTP_400_BAD_REQUEST
            )
        shift = Shift.objects.create(opened_by=request.user)
        return Response(ShiftSerializer(shift).data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['post'], permission_classes=[IsAdmin])
    def close(self, request):
        shift = Shift.get_active()
        if not shift:
            return Response({'detail': 'No hay jornada activa.'}, status=status.HTTP_400_BAD_REQUEST)
        shift.close(user=request.user)
        # Cerrar automáticamente todas las asistencias abiertas de esta jornada
        try:
            from apps.attendance.models import AttendanceRecord
            from django.utils import timezone
            open_records = AttendanceRecord.objects.filter(shift=shift, check_out__isnull=True)
            now = timezone.now()
            for rec in open_records:
                rec.check_out = now
                rec.save(update_fields=['check_out'])
        except Exception as e:
            print(f'[close shift] error cerrando asistencias: {e}')
        return Response(ShiftSerializer(shift).data)

    @action(detail=False, methods=['get'], permission_classes=[IsOperative])
    def active(self, request):
        shift = Shift.get_active()
        if not shift:
            return Response({'detail': 'No hay jornada activa.', 'shift': None})
        return Response({'shift': ShiftSerializer(shift).data})

    @action(detail=True, methods=['get'], permission_classes=[IsAdmin], url_path='detail')
    def shift_detail(self, request, pk=None):
        """
        Resumen completo de una jornada: ventas, gastos, totales.
        Query param: channel = all | pos | delivery
        """
        from apps.sales.models import Sale
        from apps.expenses.models import Expense

        shift   = self.get_object()
        channel = request.query_params.get('channel', 'all')

        sales_qs = Sale.objects.filter(shift=shift).prefetch_related(
            'items__cup_size', 'items__topping', 'items__saleitems_flavors__flavor'
        ).select_related('invoice')
        if channel == 'pos':
            sales_qs = sales_qs.filter(is_delivery=False)
        elif channel == 'delivery':
            sales_qs = sales_qs.filter(is_delivery=True)

        expenses_qs = shift.expenses.all().order_by('-created_at')
        if channel == 'pos':
            expenses_qs = expenses_qs.filter(origin='pos')
        elif channel == 'delivery':
            expenses_qs = expenses_qs.filter(origin='delivery')

        # ── Totales del filtro activo ──
        # Nota: cash_received incluye vuelto, así que efectivo real = total - transfer_amount
        total_sales    = sum(s.total for s in sales_qs)
        total_transfer = sum(s.transfer_amount for s in sales_qs)
        total_cash     = total_sales - total_transfer
        total_expenses = sum(e.amount for e in expenses_qs)

        # ── Desglose completo por canal (siempre, independiente del filtro) ──
        all_sales  = Sale.objects.filter(shift=shift)
        pos_sales  = list(all_sales.filter(is_delivery=False))
        dom_sales  = list(all_sales.filter(is_delivery=True))

        # efectivo real = total de la venta - lo que fue por transferencia
        def _transfer(lst): return sum(s.transfer_amount for s in lst)
        def _cash(lst):     return _total(lst) - _transfer(lst)
        def _total(lst):    return sum(s.total for s in lst)

        pos_total       = _total(pos_sales)
        pos_cash        = _cash(pos_sales)
        pos_transfer    = _transfer(pos_sales)
        dom_total       = _total(dom_sales)
        dom_cash        = _cash(dom_sales)
        dom_transfer    = _transfer(dom_sales)
        all_total       = pos_total + dom_total

        expenses_list         = list(expenses_qs)
        expenses_pos          = sum(e.amount for e in expenses_list if e.origin == 'pos')
        expenses_dom          = sum(e.amount for e in expenses_list if e.origin == 'delivery')
        expenses_pos_cash     = sum(e.amount for e in expenses_list if e.origin == 'pos'      and e.payment_method == 'cash')
        expenses_pos_transfer = sum(e.amount for e in expenses_list if e.origin == 'pos'      and e.payment_method == 'transfer')
        expenses_dom_cash     = sum(e.amount for e in expenses_list if e.origin == 'delivery' and e.payment_method == 'cash')
        expenses_dom_transfer = sum(e.amount for e in expenses_list if e.origin == 'delivery' and e.payment_method == 'transfer')

        # ── Ventas serializadas ligeramente ──
        sales_data = []
        for s in sales_qs.order_by('-created_at'):
            items_detail = []
            for item in s.items.all():
                flavor_names = [sf.flavor.name for sf in item.saleitems_flavors.all()]
                items_detail.append({
                    'cup_size':     item.cup_size.size if item.cup_size else None,
                    'flavors':      flavor_names,
                    'topping':      item.topping.name if item.topping else None,
                    'qty':          item.quantity,
                    'unit_price':   int(item.unit_price),
                    'topping_price':int(item.topping_price),
                    'subtotal':     int(item.subtotal),
                })
            try:
                invoice_number = s.invoice.invoice_number
            except Exception:
                invoice_number = None
            sales_data.append({
                'id':             s.id,
                'invoice_number': invoice_number,
                'total':          int(s.total),
                'payment_method': s.payment_method,
                'cash_received':  int(s.cash_received),
                'transfer_amount':int(s.transfer_amount),
                'transfer_reference': s.transfer_reference,
                'is_delivery':    s.is_delivery,
                'is_courtesy':    s.is_courtesy,
                'courtesy_paid':  int(s.courtesy_paid),
                'change_given':   int(s.change_given),
                'notes':          s.notes,
                'created_at':     s.created_at,
                'seller':         s.seller.full_name if s.seller else '—',
                'items':          items_detail,
            })

        expenses_data = []
        for e in expenses_list:
            expenses_data.append({
                'id':             e.id,
                'description':    e.description,
                'amount':         int(e.amount),
                'category':       e.category,
                'origin':         e.origin,
                'from_daily_cash':e.from_daily_cash,
                'payment_method': e.payment_method,
                'created_at':     e.created_at,
            })

        # ── Arqueos existentes por canal ──
        from apps.cash.models import CashAudit
        arqueos = {}
        for a in CashAudit.objects.filter(shift=shift).select_related('audited_by'):
            arqueos[a.channel] = {
                'id':         a.id,
                'audited_by': a.audited_by.full_name if a.audited_by else '—',
                'created_at': a.created_at,
            }

        return Response({
            'shift': ShiftSerializer(shift).data,
            'summary': {
                # filtro activo
                'total_sales':    int(total_sales),
                'total_cash':     int(total_cash),
                'total_transfer': int(total_transfer),
                'total_expenses': int(total_expenses),
                'net_cash':       int(total_cash - total_expenses),
                'sales_count':    sales_qs.count(),
                # desglose completo (independiente del filtro)
                'all_total':      int(all_total),
                'pos_total':      int(pos_total),
                'pos_cash':       int(pos_cash),
                'pos_transfer':   int(pos_transfer),
                'pos_expenses':          int(expenses_pos),
                'pos_expenses_cash':     int(expenses_pos_cash),
                'pos_expenses_transfer': int(expenses_pos_transfer),
                'dom_total':             int(dom_total),
                'dom_cash':              int(dom_cash),
                'dom_transfer':          int(dom_transfer),
                'dom_expenses':          int(expenses_dom),
                'dom_expenses_cash':     int(expenses_dom_cash),
                'dom_expenses_transfer': int(expenses_dom_transfer),
                # neto real en efectivo (no descuenta gastos por transferencia)
                'pos_net_cash':          int(pos_cash - expenses_pos_cash),
                'dom_net_cash':          int(dom_cash - expenses_dom_cash),
            },
            'sales':    sales_data,
            'expenses': expenses_data,
            'arqueos':  arqueos,
        })
