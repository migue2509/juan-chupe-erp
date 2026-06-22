from rest_framework import serializers
from apps.sales.serializers import SaleSerializer
from .models import Delivery


class DeliverySerializer(serializers.ModelSerializer):
    delivery_person_name = serializers.CharField(source='delivery_person.full_name', read_only=True, default='')
    sale_detail          = SaleSerializer(source='sale', read_only=True)

    class Meta:
        model = Delivery
        fields = [
            'id', 'sale', 'sale_detail', 'shift',
            'delivery_person', 'delivery_person_name',
            'four_digits', 'address', 'status', 'notes',
            'created_at', 'delivered_at',
        ]
        read_only_fields = ['id', 'created_at', 'shift']
