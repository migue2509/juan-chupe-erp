from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from django.db import transaction
from core.permissions import IsAdmin, IsOperative
from .models import Invoice
from .serializers import InvoiceSerializer


class InvoiceViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Invoice.objects.select_related(
        'sale', 'sale__seller', 'sale__promotion', 'shift', 'voided_by'
    ).prefetch_related(
        'sale__items__saleitems_flavors__flavor',
        'sale__items__cup_size',
        'sale__items__topping',
    ).all()
    serializer_class = InvoiceSerializer
    permission_classes = [IsOperative]
    filterset_fields = ['shift', 'voided']
    search_fields = ['invoice_number']

    @action(detail=True, methods=['post'], permission_classes=[IsAdmin])
    def void(self, request, pk=None):
        """Anular factura — solo administrador (RN-006)"""
        invoice_id = self.get_object().pk
        try:
            with transaction.atomic():
                invoice = self.get_queryset().select_for_update().get(pk=invoice_id)
                if invoice.voided:
                    return Response({'detail': 'La factura ya está anulada.'}, status=status.HTTP_400_BAD_REQUEST)
                invoice.void_and_restore_inventory(
                    user=request.user,
                    reason=request.data.get('reason', ''),
                )
        except Exception as exc:
            raise ValidationError({'detail': f'No se pudo anular la factura ni devolver inventario: {exc}'})

        return Response(InvoiceSerializer(invoice).data)

    @action(detail=False, methods=['get'], url_path='by-shift/(?P<shift_id>[0-9]+)')
    def by_shift(self, request, shift_id=None):
        invoices = Invoice.objects.filter(shift_id=shift_id)
        return Response(InvoiceSerializer(invoices, many=True).data)
