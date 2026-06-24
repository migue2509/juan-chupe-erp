from rest_framework import serializers
from .models import CashAudit, ShiftAuditItem


class ShiftAuditItemSerializer(serializers.ModelSerializer):
    available = serializers.ReadOnlyField()
    sold      = serializers.ReadOnlyField()

    class Meta:
        model  = ShiftAuditItem
        fields = [
            'id', 'product_name', 'product_type', 'unit_price',
            'opening_stock', 'entries', 'closing_stock',
            'available', 'sold',
        ]


class CashAuditSerializer(serializers.ModelSerializer):
    audited_by_name = serializers.CharField(source='audited_by.full_name', read_only=True, default='')
    items = ShiftAuditItemSerializer(many=True, required=False)

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
            'items',
        ]
        read_only_fields = ['id', 'created_at', 'audited_by', 'cash_difference']

    def create(self, validated_data):
        items_data = validated_data.pop('items', [])
        audit = CashAudit.objects.create(**validated_data)
        for item in items_data:
            ShiftAuditItem.objects.create(audit=audit, **item)
        return audit

    def update(self, instance, validated_data):
        items_data = validated_data.pop('items', None)
        for attr, val in validated_data.items():
            setattr(instance, attr, val)
        instance.save()
        if items_data is not None:
            instance.items.all().delete()
            for item in items_data:
                ShiftAuditItem.objects.create(audit=instance, **item)
        return instance
