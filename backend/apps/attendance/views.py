from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from core.permissions import IsAdmin, IsOperative
from apps.shifts.models import Shift
from .models import AttendanceRecord
from .serializers import AttendanceSerializer


class AttendanceViewSet(viewsets.ModelViewSet):
    queryset = AttendanceRecord.objects.select_related('user', 'shift').all()
    serializer_class = AttendanceSerializer
    permission_classes = [IsAdmin]
    filterset_fields = ['user', 'shift']

    def perform_create(self, serializer):
        shift = Shift.get_active()
        serializer.save(shift=shift)

    @action(detail=True, methods=['post'], url_path='checkout')
    def checkout(self, request, pk=None):
        record = self.get_object()
        if record.check_out:
            return Response({'detail': 'Ya tiene salida registrada.'}, status=status.HTTP_400_BAD_REQUEST)
        record.checkout()
        return Response(AttendanceSerializer(record).data)

    @action(detail=False, methods=['get'], url_path='today')
    def today(self, request):
        shift = Shift.get_active()
        if not shift:
            return Response([])
        records = AttendanceRecord.objects.filter(shift=shift).select_related('user')
        return Response(AttendanceSerializer(records, many=True).data)
