from rest_framework import serializers
from .models import Delivery


class DeliverySerializer(serializers.ModelSerializer):
    delivery_person_name = serializers.CharField(source='delivery_person.full_name', read_only=True, default='')
    sale_total = serializers.DecimalField(source='sale.total', max_digits=10, decimal_places=0, read_only=True)

    class Meta:
        model = Delivery
        fields = ['id', 'sale', 'sale_total', 'shift', 'delivery_person', 'delivery_person_name',
                  'address', 'status', 'notes', 'created_at', 'delivered_at']
        read_only_fields = ['id', 'created_at', 'shift']
