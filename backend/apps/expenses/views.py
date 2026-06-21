from rest_framework import viewsets
from core.permissions import IsOperative
from apps.shifts.models import Shift
from .models import Expense
from .serializers import ExpenseSerializer


class ExpenseViewSet(viewsets.ModelViewSet):
    queryset = Expense.objects.select_related('registered_by').all()
    serializer_class = ExpenseSerializer
    permission_classes = [IsOperative]
    filterset_fields = ['shift', 'category', 'from_daily_cash']

    def perform_create(self, serializer):
        shift = Shift.get_active()
        serializer.save(registered_by=self.request.user, shift=shift)
