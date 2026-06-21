from rest_framework import serializers
from .models import CashAudit


class CashAuditSerializer(serializers.ModelSerializer):
    audited_by_name = serializers.CharField(source='audited_by.full_name', read_only=True, default='')

    class Meta:
        model = CashAudit
        fields = [
            'id', 'shift', 'audited_by', 'audited_by_name',
            'expected_cash', 'expected_transfer', 'actual_cash', 'actual_transfer',
            'cash_difference', 'notes', 'created_at',
            'cups_16oz_system', 'cups_16oz_actual',
            'cups_24oz_system', 'cups_24oz_actual',
            'bags_creamy_system', 'bags_creamy_actual',
            'bags_refreshing_system', 'bags_refreshing_actual',
        ]
        read_only_fields = ['id', 'created_at', 'audited_by', 'cash_difference']
