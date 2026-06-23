from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
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

    # ── Endpoints para vendedoras: solo su propio registro ───────────────────

    @action(detail=False, methods=['get'], url_path='my-status',
            permission_classes=[IsAuthenticated])
    def my_status(self, request):
        """Devuelve el registro de asistencia del día para la empleada logueada."""
        shift = Shift.get_active()
        if not shift:
            return Response({'record': None, 'shift_active': False})
        record = (AttendanceRecord.objects
                  .filter(user=request.user, shift=shift)
                  .first())
        return Response({
            'shift_active': True,
            'record': AttendanceSerializer(record).data if record else None,
        })

    @action(detail=False, methods=['post'], url_path='my-checkin',
            permission_classes=[IsAuthenticated])
    def my_checkin(self, request):
        """Registra la entrada de la empleada logueada."""
        shift = Shift.get_active()
        if not shift:
            return Response({'detail': 'No hay jornada activa.'}, status=400)
        existing = AttendanceRecord.objects.filter(user=request.user, shift=shift).first()
        if existing:
            return Response({'detail': 'Ya tienes entrada registrada hoy.'}, status=400)
        record = AttendanceRecord.objects.create(user=request.user, shift=shift)
        return Response(AttendanceSerializer(record).data, status=201)

    @action(detail=False, methods=['post'], url_path='my-checkout',
            permission_classes=[IsAuthenticated])
    def my_checkout(self, request):
        """Registra la salida de la empleada logueada."""
        shift = Shift.get_active()
        if not shift:
            return Response({'detail': 'No hay jornada activa.'}, status=400)
        record = AttendanceRecord.objects.filter(user=request.user, shift=shift).first()
        if not record:
            return Response({'detail': 'No tienes entrada registrada hoy.'}, status=400)
        if record.check_out:
            return Response({'detail': 'Ya tienes salida registrada.'}, status=400)
        record.checkout()
        return Response(AttendanceSerializer(record).data)
