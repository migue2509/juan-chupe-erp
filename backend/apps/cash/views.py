from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from decimal import Decimal
from core.permissions import IsAdmin
from apps.shifts.models import Shift
from apps.sales.models import Sale
from .models import CashAudit
from .serializers import CashAuditSerializer


class CashAuditViewSet(viewsets.ModelViewSet):
    queryset = CashAudit.objects.select_related('shift', 'audited_by').prefetch_related('items').all()
    serializer_class = CashAuditSerializer
    permission_classes = [IsAdmin]

    def perform_create(self, serializer):
        obj = serializer.save(audited_by=self.request.user)
        obj.calculate_difference()

    @action(detail=False, methods=['get'], url_path='prefill')
    def prefill(self, request):
        """
        Pre-carga datos para el arqueo.
        Params: shift_id (opcional, default = activa o última cerrada)
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

        # ── Resumen de ventas de la jornada ──
        sales = Sale.objects.filter(shift=shift)
        pos_sales     = sales.filter(is_delivery=False)
        delivery_sales = sales.filter(is_delivery=True)

        def transfer_total(qs):
            return sum(s.transfer_amount for s in qs)

        pos_total    = sum(s.total for s in pos_sales)
        pos_transfer = transfer_total(pos_sales)
        pos_cash     = pos_total - pos_transfer   # efectivo real = total - transferencia
        delivery_total  = sum(s.total for s in delivery_sales)

        expenses_from_cash = sum(
            e.amount for e in shift.expenses.filter(from_daily_cash=True)
        )

        # ── Catálogo para tabla de inventario ──
        from apps.inventory.models import CupStock, ToppingStock
        from apps.products.models import CupSize, Topping

        cup_sizes = []
        for cs in CupSize.objects.filter(is_active=True).order_by('price'):
            try:
                stock = cs.stock.quantity
            except Exception:
                stock = 0
            cup_sizes.append({
                'product_name': f'Vaso {cs.size}',
                'product_type': 'cup',
                'unit_price':   int(cs.price),
                'current_stock': stock,
            })

        toppings = []
        for t in Topping.objects.filter(is_active=True).order_by('name'):
            try:
                stock = t.stock.quantity
            except Exception:
                stock = 0
            toppings.append({
                'product_name': t.name,
                'product_type': 'topping',
                'unit_price':   int(t.price) if hasattr(t, 'price') else 0,
                'current_stock': stock,
            })

        return Response({
            'shift_id':           shift.id,
            # efectivo
            'pos_cash':           pos_cash,
            'pos_transfer':       pos_transfer,
            'pos_total':          pos_total,
            'delivery_total':     delivery_total,
            'expenses_from_cash': expenses_from_cash,
            'net_expected_cash':  pos_cash - expenses_from_cash,
            # legacy (para compatibilidad con CashAudit viejo)
            'expected_cash':      pos_cash,
            'expected_transfer':  pos_transfer,
            # catálogo
            'catalog': cup_sizes + toppings,
        })
