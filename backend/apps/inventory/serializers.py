from rest_framework import serializers
from .models import FlavorBag, CupStock, ToppingStock, StockMovement


class FlavorBagSerializer(serializers.ModelSerializer):
    flavor_name = serializers.CharField(source='flavor.name', read_only=True)
    flavor_emoji = serializers.CharField(source='flavor.emoji', read_only=True)
    flavor_color = serializers.CharField(source='flavor.color', read_only=True)
    is_low_stock = serializers.BooleanField(read_only=True)

    class Meta:
        model = FlavorBag
        fields = [
            'id', 'flavor', 'flavor_name', 'flavor_emoji', 'flavor_color',
            'category', 'stock_ml', 'min_stock_ml', 'is_low_stock', 'updated_at'
        ]


class CupStockSerializer(serializers.ModelSerializer):
    size_label = serializers.CharField(source='cup_size.size', read_only=True)
    is_low_stock = serializers.BooleanField(read_only=True)

    class Meta:
        model = CupStock
        fields = ['id', 'cup_size', 'size_label', 'quantity', 'min_quantity', 'is_low_stock', 'updated_at']


class StockMovementSerializer(serializers.ModelSerializer):
    created_by_name  = serializers.CharField(source='created_by.full_name', read_only=True)
    item_name        = serializers.SerializerMethodField()
    invoice_number   = serializers.SerializerMethodField()

    def get_item_name(self, obj):
        if obj.flavor_bag_id:
            try: return obj.flavor_bag.flavor.name
            except: pass
        if obj.cup_stock_id:
            try: return obj.cup_stock.cup_size.size
            except: pass
        if obj.topping_stock_id:
            try: return obj.topping_stock.topping.name
            except: pass
        return '—'

    def get_invoice_number(self, obj):
        if obj.sale_id:
            try: return obj.sale.invoice.invoice_number
            except: pass
        return None

    class Meta:
        model = StockMovement
        fields = [
            'id', 'movement_type', 'flavor_bag', 'cup_stock', 'topping_stock',
            'quantity_ml', 'quantity_units', 'purchase_amount', 'notes',
            'sale', 'invoice_number',
            'created_by', 'created_by_name', 'item_name', 'created_at', 'shift'
        ]
        read_only_fields = ['id', 'created_at', 'created_by']


class ToppingStockSerializer(serializers.ModelSerializer):
    topping_name = serializers.CharField(source='topping.name', read_only=True)
    is_low_stock  = serializers.BooleanField(read_only=True)

    class Meta:
        model  = ToppingStock
        fields = ['id', 'topping', 'topping_name', 'quantity', 'min_quantity', 'is_low_stock', 'updated_at']


class StockEntrySerializer(serializers.Serializer):
    """Para agregar stock manualmente"""
    flavor_bag_id = serializers.IntegerField(required=False)
    cup_stock_id = serializers.IntegerField(required=False)
    quantity_ml = serializers.DecimalField(max_digits=10, decimal_places=2, required=False)
    quantity_units = serializers.IntegerField(required=False)
    notes = serializers.CharField(required=False, allow_blank=True)
