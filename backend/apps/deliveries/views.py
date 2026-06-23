from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.utils import timezone
from core.permissions import IsOperative, IsAdmin
from apps.shifts.models import Shift
from .models import Delivery, Domiciliario
from .serializers import DeliverySerializer, DomiciliarioSerializer


class DomiciliarioViewSet(viewsets.ModelViewSet):
    queryset = Domiciliario.objects.all()
    serializer_class = DomiciliarioSerializer
    permission_classes = [IsOperative]


class DeliveryViewSet(viewsets.ModelViewSet):
    queryset = Delivery.objects.select_related('sale', 'delivery_person').all()
    serializer_class = DeliverySerializer
    permission_classes = [IsOperative]
    filterset_fields = ['status', 'shift']

    def perform_create(self, serializer):
        shift = Shift.get_active()
        serializer.save(shift=shift)

    @action(detail=True, methods=['post'], permission_classes=[IsAdmin])
    def cancel(self, request, pk=None):
        """
        Cancela un domicilio:
          1. Marca el delivery como 'cancelled'
          2. Anula la factura asociada
          3. Revierte el inventario (vasos, sabores, toppings)
        """
        delivery = self.get_object()

        if delivery.status == 'cancelled':
            return Response({'detail': 'El domicilio ya está cancelado.'}, status=status.HTTP_400_BAD_REQUEST)

        # 1 — Cancelar delivery
        delivery.status = 'cancelled'
        delivery.save(update_fields=['status'])

        sale = delivery.sale
        if sale:
            # 2 — Anular factura
            try:
                invoice = sale.invoice
                if not invoice.voided:
                    invoice.voided     = True
                    invoice.voided_by  = request.user
                    invoice.voided_at  = timezone.now()
                    invoice.void_reason = request.data.get('reason', 'Domicilio cancelado')
                    invoice.save()
            except Exception:
                pass

            # 3 — Revertir inventario por cada ítem de la venta
            try:
                for item in sale.items.prefetch_related('saleitems_flavors__flavor', 'flavors').all():
                    item.reverse_inventory()
            except Exception:
                pass

        return Response(DeliverySerializer(delivery).data)
