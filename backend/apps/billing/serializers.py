from rest_framework import serializers
from django.utils import timezone
from apps.sales.serializers import SaleSerializer
from .models import Invoice


class InvoiceSerializer(serializers.ModelSerializer):
    sale_detail    = SaleSerializer(source='sale', read_only=True)
    voided_by_name = serializers.CharField(source='voided_by.full_name', read_only=True, default='')
    shift_label    = serializers.SerializerMethodField()

    def get_shift_label(self, obj):
        if obj.shift:
            local = timezone.localtime(obj.shift.opened_at)
            return f'#{obj.shift.id} · {local.strftime("%d/%m/%y")}'
        return '—'

    class Meta:
        model = Invoice
        fields = [
            'id', 'invoice_number', 'sale', 'sale_detail', 'shift', 'shift_label',
            'created_at', 'voided', 'voided_by', 'voided_by_name',
            'voided_at', 'void_reason'
        ]
        read_only_fields = ['id', 'invoice_number', 'created_at']
