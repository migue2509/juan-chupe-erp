from rest_framework import serializers
from .models import Shift


class ShiftSerializer(serializers.ModelSerializer):
    opened_by_name = serializers.CharField(source='opened_by.full_name', read_only=True)
    closed_by_name = serializers.CharField(source='closed_by.full_name', read_only=True)

    class Meta:
        model = Shift
        fields = [
            'id', 'opened_by', 'opened_by_name', 'closed_by', 'closed_by_name',
            'opened_at', 'closed_at', 'status', 'notes'
        ]
        read_only_fields = ['id', 'opened_at', 'closed_at', 'opened_by', 'closed_by', 'status']
