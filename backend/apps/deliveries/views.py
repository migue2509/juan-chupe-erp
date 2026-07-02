from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.utils import timezone
from django.db import transaction
from core.permissions import IsOperative, IsAdmin
from apps.shifts.models import Shift
from .models import Delivery, Domiciliario
from .serializers import DeliverySerializer, DomiciliarioSerializer


class DomiciliarioViewSet(viewsets.ModelViewSet):
    queryset = Domiciliario.objects.all()
    serializer_class = DomiciliarioSerializer
    permission_classes = [IsOperative]


class DeliveryViewSet(viewsets.ModelViewSet):
    queryset = Delivery.objects.select_related(
        'sale', 'sale__invoice', 'delivery_person'
    ).all()
    serializer_class = DeliverySerializer
    permission_classes = [IsOperative]
    filterset_fields = ['status', 'shift']

    def perform_create(self, serializer):
        shift = Shift.get_active()
        if not shift:
            from rest_framework.exceptions import ValidationError
            raise ValidationError('No hay jornada activa. El administrador debe abrir el día.')
        serializer.save(shift=shift)

    def _void_invoice_and_reverse_inventory(self, delivery, user):
        from apps.billing.models import Invoice
        sale_id = delivery.sale_id
        print(f'[cancel] delivery={delivery.id} sale_id={sale_id}')

        updated = Invoice.objects.filter(
            sale_id=sale_id, voided=False
        ).update(
            voided=True,
            voided_by=user,
            voided_at=timezone.now(),
            void_reason='Domicilio cancelado',
        )
        print(f'[cancel] facturas actualizadas: {updated}')

        sale = delivery.sale
        note = f'Cancelacion domicilio #{delivery.id} venta #{sale_id}'
        for item in sale.items.prefetch_related('saleitems_flavors__flavor__bag').all():
            try:
                item.reverse_inventory(note_prefix=note)
            except Exception as e:
                print(f'[cancel] ERROR inventario item {item.id}: {e}')

    def perform_update(self, serializer):
        old_status = serializer.instance.status
        instance = serializer.save()
        if instance.status == 'cancelled' and old_status != 'cancelled':
            self._void_invoice_and_reverse_inventory(instance, self.request.user)

    @action(detail=False, methods=['get'], url_path='heatmap', permission_classes=[IsAdmin])
    def heatmap(self, request):
        """
        Devuelve coordenadas de todos los domicilios con ubicación para el mapa de calor.
        Query params opcionales: date_from, date_to (YYYY-MM-DD)
        """
        qs = Delivery.objects.exclude(latitude__isnull=True).exclude(longitude__isnull=True)
        date_from = request.query_params.get('date_from')
        date_to   = request.query_params.get('date_to')
        if date_from:
            qs = qs.filter(created_at__date__gte=date_from)
        if date_to:
            qs = qs.filter(created_at__date__lte=date_to)

        points = list(qs.values('id', 'latitude', 'longitude', 'address', 'status', 'four_digits', 'created_at'))
        total_with_coords = qs.count()
        total_deliveries  = Delivery.objects.count()

        return Response({
            'points': points,
            'total_with_coords': total_with_coords,
            'total_deliveries':  total_deliveries,
        })

    @action(detail=True, methods=['post'], permission_classes=[IsOperative])
    def cancel(self, request, pk=None):
        delivery = self.get_object()
        print(f'[cancel endpoint] delivery={delivery.id} estado={delivery.status}')
        with transaction.atomic():
            if delivery.status != 'cancelled':
                delivery.status = 'cancelled'
                delivery.save(update_fields=['status'])
            self._void_invoice_and_reverse_inventory(delivery, request.user)
        return Response(DeliverySerializer(delivery).data)
