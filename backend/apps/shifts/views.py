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
        return Response(ShiftSerializer(shift).data)

    @action(detail=False, methods=['get'], permission_classes=[IsOperative])
    def active(self, request):
        shift = Shift.get_active()
        if not shift:
            return Response({'detail': 'No hay jornada activa.', 'shift': None})
        return Response({'shift': ShiftSerializer(shift).data})
