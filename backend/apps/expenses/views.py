from django.utils import timezone
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from core.permissions import IsOperative
from apps.shifts.models import Shift
from .models import Expense
from .serializers import ExpenseSerializer


class ExpenseViewSet(viewsets.ModelViewSet):
    queryset = Expense.objects.select_related('registered_by').all()
    serializer_class = ExpenseSerializer
    permission_classes = [IsOperative]
    filterset_fields = ['shift', 'category', 'origin', 'from_daily_cash']

    def perform_create(self, serializer):
        shift = Shift.get_active()
        serializer.save(registered_by=self.request.user, shift=shift)

    @action(detail=False, methods=['get'], url_path='today')
    def today(self, request):
        today = timezone.localdate()
        expenses = Expense.objects.filter(created_at__date=today).select_related('registered_by')
        return Response(ExpenseSerializer(expenses, many=True).data)
