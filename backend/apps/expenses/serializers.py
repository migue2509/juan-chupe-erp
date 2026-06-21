from rest_framework import serializers
from .models import Expense


class ExpenseSerializer(serializers.ModelSerializer):
    registered_by_name = serializers.CharField(source='registered_by.full_name', read_only=True, default='')

    class Meta:
        model = Expense
        fields = [
            'id', 'shift', 'registered_by', 'registered_by_name',
            'category', 'description', 'amount', 'from_daily_cash', 'notes', 'created_at'
        ]
        read_only_fields = ['id', 'created_at', 'registered_by', 'shift']
