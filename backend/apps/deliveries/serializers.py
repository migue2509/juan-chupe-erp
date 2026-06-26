from rest_framework import serializers
from django.utils import timezone
from apps.sales.serializers import SaleSerializer
from .models import Delivery, Domiciliario


class DomiciliarioSerializer(serializers.ModelSerializer):
    class Meta:
        model = Domiciliario
        fields = ['id', 'name', 'is_active', 'created_at']
        read_only_fields = ['id', 'created_at']


class DeliverySerializer(serializers.ModelSerializer):
    delivery_person_name = serializers.CharField(source='delivery_person.name', read_only=True, default='')
    sale_detail          = SaleSerializer(source='sale', read_only=True)
    shift_label          = serializers.SerializerMethodField()

    def get_shift_label(self, obj):
        if obj.shift:
            local = timezone.localtime(obj.shift.opened_at)
            return f'#{obj.shift.id} · {local.strftime("%d/%m/%y")}'
        return '—'

    class Meta:
        model = Delivery
        fields = [
            'id', 'sale', 'sale_detail', 'shift', 'shift_label',
            'delivery_person', 'delivery_person_name',
            'four_digits', 'address', 'status', 'notes',
            'created_at', 'delivered_at',
        ]
        read_only_fields = ['id', 'created_at', 'shift']
