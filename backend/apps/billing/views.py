from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.utils import timezone
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
        invoice = self.get_object()
        if invoice.voided:
            return Response({'detail': 'La factura ya está anulada.'}, status=status.HTTP_400_BAD_REQUEST)
        reason = request.data.get('reason', '')
        invoice.voided = True
        invoice.voided_by = request.user
        invoice.voided_at = timezone.now()
        invoice.void_reason = reason
        invoice.save()

        # Devolver stock al inventario
        note = f'Anulacion factura {invoice.invoice_number}'
        for item in invoice.sale.items.all():
            try:
                item.reverse_inventory(note_prefix=note)
            except Exception:
                pass  # No bloquear la anulacion si falla un item

        return Response(InvoiceSerializer(invoice).data)

    @action(detail=False, methods=['get'], url_path='by-shift/(?P<shift_id>[0-9]+)')
    def by_shift(self, request, shift_id=None):
        invoices = Invoice.objects.filter(shift_id=shift_id)
        return Response(InvoiceSerializer(invoices, many=True).data)
