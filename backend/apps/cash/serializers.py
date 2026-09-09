from decimal import Decimal

from django.db import transaction
from rest_framework import serializers

from apps.sales.models import Sale
from apps.sales.selectors import active_sales

from .models import CashAudit, SellerCashDelivery, ShiftAuditItem


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

    class Meta:
        model = CashAudit
        fields = [
            'id', 'shift', 'channel', 'channel_label',
            'audited_by', 'audited_by_name',
            'expected_cash', 'expected_transfer',
            'actual_cash', 'actual_transfer',
            'cash_difference', 'notes', 'created_at',
            'items',
        ]
        read_only_fields = ['id', 'created_at', 'audited_by', 'cash_difference']
        validators = []

    def validate(self, attrs):
        attrs = super().validate(attrs)
        shift = attrs.get('shift') or getattr(self.instance, 'shift', None)
        channel = attrs.get('channel') or getattr(self.instance, 'channel', 'pos')

        if shift and channel == 'pos':
            if self._has_unassigned_pos_cash_entries(shift):
                raise serializers.ValidationError({
                    'detail': (
                        'No puedes marcar POS como entregado mientras existan '
                        'ventas o gastos POS sin responsable.'
                    )
                })
            self._validate_pos_seller_deliveries(shift, attrs)
        return attrs

    @transaction.atomic
    def create(self, validated_data):
        items_data = validated_data.pop('items', [])
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
        return instance

    def _create_items(self, audit, items_data):
        for item in items_data:
            ShiftAuditItem.objects.create(audit=audit, **item)

    def _validate_pos_seller_deliveries(self, shift, attrs):
        seller_ids = self._pos_responsible_seller_ids(shift)
        if not seller_ids:
            return

        deliveries = SellerCashDelivery.objects.filter(
            shift=shift,
            seller_id__in=seller_ids,
        )
        delivered_by_seller = {
            d.seller_id: d.net_delivered
            for d in deliveries
            if d.net_delivered is not None
        }
        missing_seller_ids = seller_ids - set(delivered_by_seller)
        if missing_seller_ids:
            raise serializers.ValidationError({
                'detail': 'Registra cuanto entrego cada vendedora antes de marcar POS.'
            })

        actual_cash = attrs.get('actual_cash', getattr(self.instance, 'actual_cash', Decimal('0')))
        delivered_total = sum(delivered_by_seller.values(), Decimal('0'))
        if actual_cash != delivered_total:
            raise serializers.ValidationError({
                'detail': (
                    'El efectivo POS debe coincidir con la suma entregada '
                    'por las vendedoras.'
                )
            })

    def _pos_responsible_seller_ids(self, shift):
        sales_seller_ids = set(active_sales(
            Sale.objects.filter(
                shift=shift,
                is_delivery=False,
                seller__isnull=False,
            )
        ).exclude(
            promotion__category__in=['rappi', 'didi']
        ).values_list('seller_id', flat=True))

        expense_seller_ids = set(shift.expenses.filter(
            from_daily_cash=True,
            payment_method='cash',
            origin='pos',
            registered_by__isnull=False,
        ).values_list('registered_by_id', flat=True))

        saved_seller_ids = set(SellerCashDelivery.objects.filter(
            shift=shift,
            seller_id__isnull=False,
        ).values_list('seller_id', flat=True))

        return sales_seller_ids | expense_seller_ids | saved_seller_ids

    def _has_unassigned_pos_cash_entries(self, shift):
        has_unassigned_sales = active_sales(
            Sale.objects.filter(
                shift=shift,
                is_delivery=False,
                seller__isnull=True,
            )
        ).exclude(
            promotion__category__in=['rappi', 'didi']
        ).exists()

        if has_unassigned_sales:
            return True

        return shift.expenses.filter(
            from_daily_cash=True,
            payment_method='cash',
            origin='pos',
            registered_by__isnull=True,
        ).exists()
