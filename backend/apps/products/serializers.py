from rest_framework import serializers
from .models import Flavor, CupSize, Product, Topping


class FlavorSerializer(serializers.ModelSerializer):
    bag = serializers.SerializerMethodField()

    def get_bag(self, obj):
        """Retorna info básica de la FlavorBag asociada (evita import circular)"""
        try:
            b = obj.bag   # related_name='bag' en FlavorBag.flavor
            return {
                'id':           b.id,
                'min_stock_ml': str(b.min_stock_ml),
                'stock_ml':     str(b.stock_ml),
            }
        except Exception:
            return None

    class Meta:
        model = Flavor
        fields = [
            'id', 'name', 'description', 'category', 'color', 'emoji',
            'is_active', 'created_at', 'updated_at', 'bag',
        ]
        extra_kwargs = {
            'name':       {'validators': []},
            'created_at': {'read_only': True},
            'updated_at': {'read_only': True},
        }


class CupSizeSerializer(serializers.ModelSerializer):
    class Meta:
        model = CupSize
        fields = [
            'id', 'size', 'ml', 'price', 'min_quantity',
            'is_active', 'created_at', 'updated_at',
        ]
        extra_kwargs = {
            'size':       {'validators': []},
            'created_at': {'read_only': True},
            'updated_at': {'read_only': True},
        }


class ProductSerializer(serializers.ModelSerializer):
    class Meta:
        model = Product
        fields = ['id', 'name', 'product_type', 'requires_topping', 'is_active']


class ToppingSerializer(serializers.ModelSerializer):
    class Meta:
        model = Topping
        fields = [
            'id', 'name', 'price', 'is_active', 'min_stock', 'linked_category',
            'created_at', 'updated_at',
        ]
        extra_kwargs = {
            'name':       {'validators': []},
            'created_at': {'read_only': True},
            'updated_at': {'read_only': True},
        }
