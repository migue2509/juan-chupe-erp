from rest_framework import serializers
from .models import Promotion, PromotionItem


class PromotionItemSerializer(serializers.ModelSerializer):
    cup_size_label = serializers.SerializerMethodField()
    cup_size_ml    = serializers.SerializerMethodField()

    def get_cup_size_label(self, obj):
        return obj.cup_size.size if obj.cup_size else ''

    def get_cup_size_ml(self, obj):
        return obj.cup_size.ml if obj.cup_size else 0

    class Meta:
        model  = PromotionItem
        fields = ['id', 'cup_size', 'cup_size_label', 'cup_size_ml', 'quantity', 'custom_name']


class PromotionSerializer(serializers.ModelSerializer):
    unit_price      = serializers.DecimalField(max_digits=10, decimal_places=0, read_only=True)
    net_price       = serializers.DecimalField(max_digits=10, decimal_places=0, read_only=True)
    created_by_name = serializers.SerializerMethodField()
    cup_size_label  = serializers.SerializerMethodField()
    cup_size_ml     = serializers.SerializerMethodField()
    category_label  = serializers.CharField(source='get_category_display', read_only=True)
    items           = PromotionItemSerializer(many=True, read_only=True)

    def get_created_by_name(self, obj):
        if obj.created_by:
            return obj.created_by.full_name or obj.created_by.username
        return ''

    def get_cup_size_label(self, obj):
        return obj.cup_size.size if obj.cup_size else ''

    def get_cup_size_ml(self, obj):
        return obj.cup_size.ml if obj.cup_size else 0

    def validate(self, data):
        # For PATCH, fall back to the instance's current values
        category = data.get('category') or (getattr(self.instance, 'category', None) or 'pos')
        # cup_size key may be absent (PATCH) or explicitly null (platform promo)
        if 'cup_size' in data:
            cup_size = data['cup_size']
        else:
            cup_size = getattr(self.instance, 'cup_size', None)
        # POS promos require a cup_size; Rappi/DiDi use PromotionItem
        if category == 'pos' and cup_size is None:
            raise serializers.ValidationError({'cup_size': 'Debes seleccionar un vaso para promos POS.'})
        return data

    class Meta:
        model = Promotion
        fields = [
            'id', 'name', 'description',
            'category', 'category_label',
            'cup_size', 'cup_size_label', 'cup_size_ml',
            'quantity_included', 'promo_price',
            'platform_fee_pct', 'net_price',
            'unit_price', 'is_active', 'valid_days',
            'created_by', 'created_by_name', 'created_at',
            'items',
        ]
        read_only_fields = ['id', 'created_at', 'created_by', 'unit_price', 'net_price']
        extra_kwargs = {
            'cup_size': {'required': False, 'allow_null': True},
        }
