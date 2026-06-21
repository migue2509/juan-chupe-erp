from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from decimal import Decimal
from core.permissions import IsAdmin
from apps.shifts.models import Shift
from apps.sales.models import Sale
from .models import CashAudit
from .serializers import CashAuditSerializer


class CashAuditViewSet(viewsets.ModelViewSet):
    queryset = CashAudit.objects.select_related('shift', 'audited_by').all()
    serializer_class = CashAuditSerializer
    permission_classes = [IsAdmin]

    def perform_create(self, serializer):
        obj = serializer.save(audited_by=self.request.user)
        obj.calculate_difference()

    @action(detail=False, methods=['get'], url_path='prefill')
    def prefill(self, request):
        """Pre-carga los datos del sistema para el arqueo"""
        shift = Shift.get_active()
        if not shift:
            # Use last closed shift
            shift = Shift.objects.filter(status='closed').order_by('-closed_at').first()
        if not shift:
            return Response({'detail': 'No hay jornada.'}, status=status.HTTP_404_NOT_FOUND)

        sales = Sale.objects.filter(shift=shift)
        expected_cash = sum(
            s.cash_received for s in sales if s.payment_method in ('cash', 'mixed')
        )
        expected_transfer = sum(
            s.transfer_amount for s in sales if s.payment_method in ('transfer', 'mixed')
        )
        expenses_from_cash = sum(
            e.amount for e in shift.expenses.filter(from_daily_cash=True)
        )

        from apps.inventory.models import CupStock, FlavorBag
        try:
            cups_16 = CupStock.objects.get(cup_size__size='16oz').quantity
        except Exception:
            cups_16 = 0
        try:
            cups_24 = CupStock.objects.get(cup_size__size='24oz').quantity
        except Exception:
            cups_24 = 0

        creamy_total = sum(
            b.stock_ml for b in FlavorBag.objects.filter(category='creamy')
        )
        refreshing_total = sum(
            b.stock_ml for b in FlavorBag.objects.filter(category='refreshing')
        )

        return Response({
            'shift_id': shift.id,
            'expected_cash': expected_cash,
            'expected_transfer': expected_transfer,
            'expenses_from_cash': expenses_from_cash,
            'net_expected_cash': expected_cash - expenses_from_cash,
            'cups_16oz_system': cups_16,
            'cups_24oz_system': cups_24,
            'bags_creamy_system': float(creamy_total),
            'bags_refreshing_system': float(refreshing_total),
        })
