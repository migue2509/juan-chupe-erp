from decimal import Decimal

from django.db import transaction
from rest_framework import serializers

from apps.users.models import User

from .models import CashAudit, ShiftAuditItem
from .services import pos_handover_workers, pos_sales_for_shift


class ShiftAuditItemSerializer(serializers.ModelSerializer):
    product_id = serializers.IntegerField(required=False, allow_null=True, min_value=1)
    unit_price = serializers.DecimalField(
        max_digits=10, decimal_places=0, min_value=Decimal('0'),
        required=False, default=Decimal('0')
    )
    opening_stock = serializers.IntegerField(min_value=0)
    entries = serializers.IntegerField(min_value=0)
    closing_stock = serializers.IntegerField(min_value=0)
    available = serializers.ReadOnlyField()
    sold      = serializers.ReadOnlyField()

    class Meta:
        model  = ShiftAuditItem
        fields = [
            'id', 'product_name', 'product_type', 'product_id', 'unit_price',
            'opening_stock', 'entries', 'closing_stock',
            'available', 'sold',
        ]


class CashAuditSerializer(serializers.ModelSerializer):
    audited_by_name  = serializers.CharField(source='audited_by.full_name', read_only=True, default='')
    channel_label    = serializers.CharField(source='get_channel_display', read_only=True)
    items = ShiftAuditItemSerializer(many=True, required=False)
    delivered_by = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.all(), required=False, allow_null=True,
    )
    actual_cash = serializers.DecimalField(
        max_digits=12, decimal_places=0, min_value=Decimal('0'), required=False,
    )

    class Meta:
        model = CashAudit
        fields = [
            'id', 'shift', 'channel', 'channel_label',
            'audited_by', 'audited_by_name', 'delivered_by', 'delivered_by_name',
            'expected_cash', 'expected_transfer',
            'actual_cash', 'actual_transfer',
            'cash_difference', 'notes', 'created_at',
            'items',
        ]
        read_only_fields = ['id', 'created_at', 'audited_by', 'cash_difference', 'delivered_by_name']
        validators = []

    def validate(self, attrs):
        attrs = super().validate(attrs)
        shift = attrs.get('shift') or getattr(self.instance, 'shift', None)
        channel = attrs.get('channel') or getattr(self.instance, 'channel', 'pos')

        if shift and channel == 'pos':
            worker = attrs.get('delivered_by', getattr(self.instance, 'delivered_by', None))
            if worker is None:
                raise serializers.ValidationError({
                    'delivered_by': 'Selecciona la trabajadora que entrega el efectivo POS.'
                })
            # Preserve a historical handover when editing other audit fields.
            unchanged_worker = (
                self.instance is not None
                and self.instance.shift_id == shift.pk
                and self.instance.delivered_by_id == worker.pk
            )
            if not unchanged_worker and not pos_handover_workers(shift).filter(pk=worker.pk).exists():
                raise serializers.ValidationError({
                    'delivered_by': 'La trabajadora debe estar activa y tener asistencia o actividad en esta jornada.'
                })
            if self.instance is None and 'actual_cash' not in attrs:
                raise serializers.ValidationError({'actual_cash': 'Ingresa el efectivo entregado.'})
            if not unchanged_worker:
                attrs['delivered_by_name'] = worker.full_name
            sales = list(pos_sales_for_shift(shift))
            attrs['expected_cash'] = sum((s.cash_amount for s in sales), Decimal('0'))
            attrs['expected_transfer'] = sum((s.transfer_paid for s in sales), Decimal('0'))
        elif channel == 'delivery':
            attrs['delivered_by'] = None
            attrs['delivered_by_name'] = ''
        return attrs

    @transaction.atomic
    def create(self, validated_data):
        items_data = validated_data.pop('items', [])
        from apps.shifts.models import Shift
        Shift.objects.select_for_update().get(pk=validated_data['shift'].pk)
        audit = CashAudit.objects.select_for_update().filter(
            shift=validated_data.get('shift'),
            channel=validated_data.get('channel', 'pos'),
        ).first()
        if audit:
            for attr, val in validated_data.items():
                setattr(audit, attr, val)
            audit.save()
            audit.items.all().delete()
        else:
            audit = CashAudit.objects.create(**validated_data)
        self._create_items(audit, items_data)
        audit.calculate_difference()
        return audit

    @transaction.atomic
    def update(self, instance, validated_data):
        items_data = validated_data.pop('items', None)
        for attr, val in validated_data.items():
            setattr(instance, attr, val)
        instance.save()
        if items_data is not None:
            instance.items.all().delete()
            self._create_items(instance, items_data)
        instance.calculate_difference()
        return instance

    def _create_items(self, audit, items_data):
        for item in items_data:
            ShiftAuditItem.objects.create(audit=audit, **item)
