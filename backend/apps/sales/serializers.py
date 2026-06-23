from rest_framework import serializers
from decimal import Decimal
from .models import Sale, SaleItem, SaleItemFlavor


class SaleItemFlavorSerializer(serializers.Serializer):
    flavor_id = serializers.IntegerField()


class SaleItemCreateSerializer(serializers.Serializer):
    cup_size_id = serializers.IntegerField(required=False, allow_null=True)
    flavor_ids  = serializers.ListField(child=serializers.IntegerField(), min_length=0, default=[], required=False)
    topping_id  = serializers.IntegerField(required=False, allow_null=True)
    unit_price  = serializers.DecimalField(max_digits=10, decimal_places=0)
    quantity    = serializers.IntegerField(default=1, min_value=1)


class SaleCreateSerializer(serializers.Serializer):
    seller_id = serializers.IntegerField(required=False, allow_null=True)
    promotion_id = serializers.IntegerField(required=False, allow_null=True)
    payment_method = serializers.ChoiceField(choices=['cash', 'transfer', 'mixed'])
    cash_received = serializers.DecimalField(max_digits=10, decimal_places=0, default=Decimal('0'))
    transfer_amount = serializers.DecimalField(max_digits=10, decimal_places=0, default=Decimal('0'))
    transfer_reference = serializers.CharField(required=False, allow_blank=True)
    is_delivery   = serializers.BooleanField(default=False)
    is_courtesy   = serializers.BooleanField(default=False)
    courtesy_paid = serializers.DecimalField(max_digits=10, decimal_places=0, default=Decimal('0'), required=False)
    notes = serializers.CharField(required=False, allow_blank=True)
    items = SaleItemCreateSerializer(many=True, min_length=1)


class SaleItemSerializer(serializers.ModelSerializer):
    cup_size_label = serializers.SerializerMethodField()
    topping_name   = serializers.SerializerMethodField()
    flavors_detail = serializers.SerializerMethodField()

    def get_cup_size_label(self, obj):
        return obj.cup_size.size if obj.cup_size else ''

    def get_topping_name(self, obj):
        return obj.topping.name if obj.topping else ''

    def get_flavors_detail(self, obj):
        return [{'id': sf.flavor_id, 'name': sf.flavor.name} for sf in obj.saleitems_flavors.select_related('flavor').all()]

    class Meta:
        model = SaleItem
        fields = ['id', 'cup_size', 'cup_size_label', 'flavors_detail', 'topping', 'topping_name', 'unit_price', 'topping_price', 'quantity', 'subtotal']


class SaleSerializer(serializers.ModelSerializer):
    items = SaleItemSerializer(many=True, read_only=True)
    seller_name = serializers.CharField(source='seller.full_name', read_only=True, default='')
    promotion_name = serializers.CharField(source='promotion.name', read_only=True, default='')

    class Meta:
        model = Sale
        fields = [
            'id', 'shift', 'seller', 'seller_name', 'promotion', 'promotion_name',
            'payment_method', 'cash_received', 'transfer_amount', 'transfer_reference',
            'total', 'change_given', 'is_delivery', 'is_courtesy', 'courtesy_paid', 'notes', 'created_at', 'items'
        ]
