from rest_framework import viewsets
from rest_framework.exceptions import ValidationError
from core.permissions import IsOperative
from apps.shifts.models import Shift
from .models import Purchase
from .serializers import PurchaseSerializer


class PurchaseViewSet(viewsets.ModelViewSet):
    queryset = Purchase.objects.all()
    serializer_class = PurchaseSerializer
    permission_classes = [IsOperative]

    def perform_create(self, serializer):
        shift = Shift.get_active()
        if not shift:
            raise ValidationError('No hay jornada activa. El administrador debe abrir el dia.')
        serializer.save(registered_by=self.request.user, shift=shift)
