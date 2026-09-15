from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from django.db import transaction
from django.utils import timezone
from core.permissions import IsOperative, IsAdmin
from apps.shifts.models import Shift
from .models import Delivery, Domiciliario, HeatmapPoint
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
        try:
            invoice = Invoice.objects.select_for_update().select_related(
                'sale', 'shift'
            ).prefetch_related(
                'sale__items__saleitems_flavors__flavor__bag'
            ).get(sale_id=delivery.sale_id)
        except Invoice.DoesNotExist:
            raise ValidationError({'detail': 'El domicilio no tiene factura asociada.'})

        if invoice.voided:
            return False

        invoice.void_and_restore_inventory(
            user=user,
            reason='Domicilio cancelado',
            note_prefix=f'Cancelacion domicilio #{delivery.id} venta #{delivery.sale_id}',
        )
        return True

    def perform_update(self, serializer):
        old_status = serializer.instance.status
        new_status = serializer.validated_data.get('status', old_status)
        if old_status == 'cancelled' and new_status != 'cancelled':
            raise ValidationError({'status': 'Un domicilio cancelado no puede reactivarse.'})

        with transaction.atomic():
            instance = serializer.save()
            if instance.status == 'delivered' and not instance.delivered_at:
                instance.delivered_at = timezone.now()
                instance.save(update_fields=['delivered_at'])
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

        delivery_points = list(qs.values('id', 'latitude', 'longitude', 'address', 'status', 'four_digits', 'created_at'))
        total_with_coords = qs.count()
        total_deliveries  = Delivery.objects.count()

        # Incluir puntos históricos del mapa de calor
        historical_qs = HeatmapPoint.objects.all()
        if date_from:
            historical_qs = historical_qs.filter(created_at__date__gte=date_from)
        if date_to:
            historical_qs = historical_qs.filter(created_at__date__lte=date_to)
        historical_points = [
            {
                'id': f'h{p["id"]}',
                'latitude': p['latitude'],
                'longitude': p['longitude'],
                'address': p['address'],
                'status': 'historical',
                'four_digits': '',
                'created_at': p['created_at'],
            }
            for p in historical_qs.values('id', 'latitude', 'longitude', 'address', 'created_at')
        ]

        points = delivery_points + historical_points

        return Response({
            'points': points,
            'total_with_coords': total_with_coords + len(historical_points),
            'total_deliveries':  total_deliveries,
        })

    @action(detail=True, methods=['post'], permission_classes=[IsOperative])
    def cancel(self, request, pk=None):
        delivery_id = self.get_object().pk
        with transaction.atomic():
            delivery = self.get_queryset().select_for_update().get(pk=delivery_id)
            if delivery.status != 'cancelled':
                delivery.status = 'cancelled'
                delivery.save(update_fields=['status'])
            self._void_invoice_and_reverse_inventory(delivery, request.user)
        return Response(DeliverySerializer(delivery).data)
