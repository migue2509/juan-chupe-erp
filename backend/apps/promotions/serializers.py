from rest_framework import serializers
from .models import Promotion


class PromotionSerializer(serializers.ModelSerializer):
    unit_price      = serializers.DecimalField(max_digits=10, decimal_places=0, read_only=True)
    created_by_name = serializers.SerializerMethodField()
    cup_size_label  = serializers.SerializerMethodField()
    cup_size_ml     = serializers.SerializerMethodField()

    def get_created_by_name(self, obj):
        if obj.created_by:
            return obj.created_by.full_name or obj.created_by.username
        return ''

    def get_cup_size_label(self, obj):
        return obj.cup_size.size if obj.cup_size else ''

    def get_cup_size_ml(self, obj):
        return obj.cup_size.ml if obj.cup_size else 0

    def validate_cup_size(self, value):
        if value is None:
            raise serializers.ValidationError('Debes seleccionar un vaso para la promoción.')
        return value

    class Meta:
        model = Promotion
        fields = [
            'id', 'name', 'description',
            'cup_size', 'cup_size_label', 'cup_size_ml',
            'quantity_included', 'promo_price',
            'unit_price', 'is_active', 'valid_days',
            'created_by', 'created_by_name', 'created_at'
        ]
        read_only_fields = ['id', 'created_at', 'created_by', 'unit_price']
        extra_kwargs = {
            'cup_size': {'required': True, 'allow_null': False},
        }
