from rest_framework import serializers
from .models import Expense


class ExpenseSerializer(serializers.ModelSerializer):
    registered_by_name = serializers.SerializerMethodField()
    category_label     = serializers.CharField(source='get_category_display', read_only=True)
    origin_label       = serializers.CharField(source='get_origin_display',   read_only=True)

    def get_registered_by_name(self, obj):
        if obj.registered_by:
            return obj.registered_by.full_name or obj.registered_by.username
        return '—'

    payment_method_label = serializers.CharField(source='get_payment_method_display', read_only=True)

    class Meta:
        model  = Expense
        fields = [
            'id', 'shift', 'registered_by', 'registered_by_name',
            'category', 'category_label', 'origin', 'origin_label',
            'description', 'amount', 'from_daily_cash', 'payment_method',
            'payment_method_label', 'notes', 'created_at',
        ]
        read_only_fields = ['id', 'created_at', 'registered_by', 'shift']
