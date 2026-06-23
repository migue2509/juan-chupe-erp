import datetime
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

    def get_queryset(self):
        qs = super().get_queryset()
        date_from = self.request.query_params.get('date_from')
        date_to   = self.request.query_params.get('date_to')
        if date_from:
            qs = qs.filter(check_in__date__gte=date_from)
        if date_to:
            qs = qs.filter(check_in__date__lte=date_to)
        return qs

    @action(detail=False, methods=['get'], url_path='today')
    def today(self, request):
        shift = Shift.get_active()
        if not shift:
            return Response([])
        records = AttendanceRecord.objects.filter(shift=shift).select_related('user')
        return Response(AttendanceSerializer(records, many=True).data)

    @action(detail=False, methods=['get'], url_path='metrics', permission_classes=[IsAdmin])
    def metrics(self, request):
        """
        Métricas de asistencia por empleada en un rango de fechas.
        Params: date_from, date_to (YYYY-MM-DD)
        """
        from django.db.models import Count, Sum, Avg
        from django.utils import timezone
        from apps.users.models import User

        date_from_str = request.query_params.get('date_from')
        date_to_str   = request.query_params.get('date_to')

        qs = AttendanceRecord.objects.select_related('user').all()
        if date_from_str:
            qs = qs.filter(check_in__date__gte=date_from_str)
        if date_to_str:
            qs = qs.filter(check_in__date__lte=date_to_str)

        # Totales globales
        total_records = qs.count()
        completed     = qs.exclude(check_out__isnull=True)
        total_hours   = sum(
            (r.check_out - r.check_in).total_seconds() / 3600
            for r in completed if r.check_out
        )

        # Por empleada
        operatives = User.objects.filter(role='operative', is_active=True).order_by('full_name')
        per_employee = []
        for emp in operatives:
            emp_qs       = qs.filter(user=emp)
            emp_complete = emp_qs.exclude(check_out__isnull=True)
            emp_hours    = sum(
                (r.check_out - r.check_in).total_seconds() / 3600
                for r in emp_complete if r.check_out
            )
            days = emp_qs.values('check_in__date').distinct().count()
            per_employee.append({
                'user_id':    emp.id,
                'user_name':  emp.full_name,
                'days':       days,
                'records':    emp_qs.count(),
                'hours':      round(emp_hours, 2),
                'avg_hours':  round(emp_hours / days, 2) if days else 0,
                'last_seen':  emp_qs.order_by('-check_in').values_list('check_in__date', flat=True).first(),
            })

        # Hoy
        today = timezone.localdate()
        today_records = AttendanceRecord.objects.filter(
            check_in__date=today
        ).select_related('user')

        return Response({
            'total_records': total_records,
            'total_hours':   round(total_hours, 2),
            'avg_hours_day': round(total_hours / total_records, 2) if total_records else 0,
            'per_employee':  per_employee,
            'today_present': [
                {
                    'user_name':  r.user.full_name,
                    'check_in':   r.check_in,
                    'check_out':  r.check_out,
                    'hours':      r.hours_worked,
                }
                for r in today_records
            ],
        })

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
