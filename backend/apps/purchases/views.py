from rest_framework import viewsets
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
        serializer.save(registered_by=self.request.user, shift=shift)
