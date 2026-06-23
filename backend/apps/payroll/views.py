import datetime
from decimal import Decimal
from django.utils import timezone
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from core.permissions import IsAdmin
from apps.users.models import User
from .models import WorkdaySchedule, WorkLog, WagePayment
from .serializers import WorkdayScheduleSerializer, WorkLogSerializer, WagePaymentSerializer


class WorkdayScheduleViewSet(viewsets.ModelViewSet):
    """CRUD del horario laboral y tarifa por día de cada empleada."""
    queryset = WorkdaySchedule.objects.select_related('user').all()
    serializer_class = WorkdayScheduleSerializer
    permission_classes = [IsAdmin]

    @action(detail=False, methods=['get'], url_path='all-employees')
    def all_employees(self, request):
        """
        Devuelve todas las empleadas (role=operative) con su horario.
        Si no tienen horario, devuelve defaults.
        """
        operatives = User.objects.filter(role='operative', is_active=True).order_by('full_name')
        result = []
        for user in operatives:
            try:
                schedule = user.schedule
                data = WorkdayScheduleSerializer(schedule).data
            except WorkdaySchedule.DoesNotExist:
                data = {
                    'id': None, 'user': user.id, 'user_name': user.full_name,
                    'works_monday': True, 'works_tuesday': True, 'works_wednesday': True,
                    'works_thursday': True, 'works_friday': True, 'works_saturday': False,
                    'works_sunday': False,
                    'monday_wage': 0, 'tuesday_wage': 0, 'wednesday_wage': 0,
                    'thursday_wage': 0, 'friday_wage': 0, 'saturday_wage': 0, 'sunday_wage': 0,
                    'weekly_total': 0, 'work_days_labels': [], 'updated_at': None,
                }
            result.append(data)
        return Response(result)

    @action(detail=False, methods=['post'], url_path='upsert')
    def upsert(self, request):
        """Crea o actualiza el horario de una empleada."""
        user_id = request.data.get('user')
        try:
            user = User.objects.get(id=user_id, role='operative')
        except User.DoesNotExist:
            return Response({'detail': 'Empleada no encontrada.'}, status=400)

        schedule, _ = WorkdaySchedule.objects.get_or_create(user=user)
        serializer = WorkdayScheduleSerializer(schedule, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


class WorkLogViewSet(viewsets.ReadOnlyModelViewSet):
    """Consulta de días trabajados."""
    serializer_class = WorkLogSerializer
    permission_classes = [IsAdmin]

    def get_queryset(self):
        qs = WorkLog.objects.select_related('user', 'payment').all()
        user_id = self.request.query_params.get('user')
        if user_id:
            qs = qs.filter(user_id=user_id)
        paid = self.request.query_params.get('paid')
        if paid == 'false':
            qs = qs.filter(payment__isnull=True)
        elif paid == 'true':
            qs = qs.filter(payment__isnull=False)
        return qs

    @action(detail=False, methods=['post'], url_path='manual')
    def manual_add(self, request):
        """Agrega manualmente un día trabajado (correcciones)."""
        user_id = request.data.get('user')
        date_str = request.data.get('date')
        try:
            user = User.objects.get(id=user_id, role='operative')
            date = datetime.date.fromisoformat(date_str)
        except Exception:
            return Response({'detail': 'Datos inválidos.'}, status=400)

        wage = Decimal('0')
        try:
            wage = user.schedule.wage_for_day(date)
        except Exception:
            pass

        log, created = WorkLog.objects.get_or_create(
            user=user, date=date, defaults={'wage_earned': wage}
        )
        return Response(WorkLogSerializer(log).data, status=201 if created else 200)

    @action(detail=True, methods=['delete'], url_path='remove')
    def remove(self, request, pk=None):
        """Elimina un día trabajado (correcciones)."""
        log = self.get_object()
        if log.payment_id:
            return Response({'detail': 'No se puede eliminar un día ya pagado.'}, status=400)
        log.delete()
        return Response(status=204)


class WagePaymentViewSet(viewsets.ReadOnlyModelViewSet):
    """Historial de pagos de nómina."""
    queryset = WagePayment.objects.select_related('user', 'paid_by').prefetch_related('work_logs').all()
    serializer_class = WagePaymentSerializer
    permission_classes = [IsAdmin]
    filterset_fields = ['user']

    @action(detail=False, methods=['get'], url_path='summary')
    def summary(self, request):
        """
        Resumen de nómina por empleada:
        - días trabajados totales, días pendientes de pago, monto pendiente
        - días trabajados esta semana
        """
        today = timezone.localdate()
        # Lunes de esta semana
        week_start = today - datetime.timedelta(days=today.weekday())

        operatives = User.objects.filter(role='operative', is_active=True).order_by('full_name')
        result = []
        for user in operatives:
            logs_all     = WorkLog.objects.filter(user=user)
            logs_unpaid  = logs_all.filter(payment__isnull=True)
            logs_week    = logs_all.filter(date__gte=week_start, date__lte=today)
            logs_unpaid_week = logs_unpaid.filter(date__gte=week_start, date__lte=today)

            unpaid_amount = sum(l.wage_earned for l in logs_unpaid)
            total_paid    = sum(p.total_amount for p in user.wage_payments.all())

            result.append({
                'user_id':           user.id,
                'user_name':         user.full_name,
                'days_worked_total': logs_all.count(),
                'days_unpaid':       logs_unpaid.count(),
                'amount_unpaid':     float(unpaid_amount),
                'days_this_week':    logs_week.count(),
                'unpaid_this_week':  logs_unpaid_week.count(),
                'total_paid_ever':   float(total_paid),
                'unpaid_logs':       WorkLogSerializer(
                    logs_unpaid.order_by('date'), many=True
                ).data,
            })

        return Response(result)

    @action(detail=False, methods=['post'], url_path='pay')
    def pay(self, request):
        """
        Registra el pago de días pendientes para una empleada.
        Body: { user: id, log_ids: [1,2,3], notes: '' }
        """
        user_id = request.data.get('user')
        log_ids = request.data.get('log_ids', [])
        notes   = request.data.get('notes', '')

        try:
            user = User.objects.get(id=user_id, role='operative')
        except User.DoesNotExist:
            return Response({'detail': 'Empleada no encontrada.'}, status=400)

        logs = WorkLog.objects.filter(id__in=log_ids, user=user, payment__isnull=True)
        if not logs.exists():
            return Response({'detail': 'No hay días pendientes seleccionados.'}, status=400)

        dates = sorted(l.date for l in logs)
        total = sum(l.wage_earned for l in logs)

        payment = WagePayment.objects.create(
            user=user,
            week_start=dates[0],
            week_end=dates[-1],
            days_paid=len(dates),
            total_amount=total,
            paid_by=request.user,
            notes=notes,
        )
        logs.update(payment=payment)

        return Response(WagePaymentSerializer(payment).data, status=201)
