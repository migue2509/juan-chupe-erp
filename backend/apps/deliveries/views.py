from rest_framework import viewsets
from core.permissions import IsOperative
from apps.shifts.models import Shift
from .models import Delivery, Domiciliario
from .serializers import DeliverySerializer, DomiciliarioSerializer


class DomiciliarioViewSet(viewsets.ModelViewSet):
    queryset = Domiciliario.objects.all()
    serializer_class = DomiciliarioSerializer
    permission_classes = [IsOperative]


class DeliveryViewSet(viewsets.ModelViewSet):
    queryset = Delivery.objects.select_related('sale', 'delivery_person').all()
    serializer_class =