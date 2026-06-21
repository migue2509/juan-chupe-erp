from rest_framework import serializers
from decimal import Decimal
from .models import Sale, SaleItem, SaleItemFlavor


class SaleItemFlavorSerializer(serializers.Serializer):
    flavor_id = serializers.IntegerField()


class SaleItemCreateSerializer(serializers.Serializer):
    cup_size_id = serializers.IntegerField()
    flavor_ids = serializers.ListField(child=serializers.IntegerField(), min_length=1)
    topping_id = serializers.IntegerField(required=False, allow_null=True)
    unit_price = serializers.DecimalField(max_digits=10, decimal_places=0)
    quantity = serializers.IntegerField(default=1, min_value=1)


class SaleCreateSerializer(serializers.Serializer):
    seller_id = serializers.IntegerField(required=False, allow_null=True)
    promotion_id = serializers.IntegerField(required=False, allow_null=True)
    payment_method = serializers.ChoiceField(choices=['cash', 'transfer', 'mixed'])
    cash_received = serializers.DecimalField(max_digits=10, decimal_places=0, default=Decimal('0'))
    transfer_amount = serializers.DecimalField(max_digits=10, decimal_places=0, default=Decimal('0'))
    transfer_reference = serializers.CharField(required=False, allow_blank=True)
    is_delivery = serializers.BooleanField(default=False)
    notes = serializers.CharField(required=False, allow_blank=True)
    items = SaleItemCreateSerializer(many=True, min_length=1)


class SaleItemSerializer(serializers.ModelSerializer):
    cup_size_label = serializers.CharField(source='cup_size.size', read_only=True)
    flavors_detail = serializers.SerializerMethodField()

    class Meta:
        model = SaleItem
        fields = ['id', 'cup_size', 'cup_size_label', 'flavors_detail', 'topping', 'unit_price', 'quantity', 'subtotal']

    def get_flavors_detail(self, obj):
        return [{'id': sf.flavor_id, 'name': sf.flavor.name} for sf in obj.saleitems_flavors.select_related('flavor').all()]


class SaleSerializer(serializers.ModelSerializer):
    items = SaleItemSerializer(many=True, read_only=True)
    seller_name = serializers.CharField(source='seller.full_name', read_only=True, default='')
    promotion_name = serializers.CharField(source='promotion.name', read_only=True, default='')

    class Meta:
        model = Sale
        fields = [
            'id', 'shift', 'seller', 'seller_name', 'promotion', 'promotion_name',
            'payment_method', 'cash_received', 'transfer_amount', 'transfer_reference',
            'total', 'change_given', 'is_delivery', 'notes', 'created_at', 'items'
        ]
