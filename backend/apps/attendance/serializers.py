from rest_framework import serializers
from .models import AttendanceRecord


class AttendanceSerializer(serializers.ModelSerializer):
    user_name = serializers.CharField(source='user.full_name', read_only=True)
    hours_worked = serializers.FloatField(read_only=True)

    class Meta:
        model = AttendanceRecord
        fields = ['id', 'user', 'user_name', 'shift', 'check_in', 'check_out', 'hours_worked', 'notes']
        read_only_fields = ['id', 'check_in', 'shift']
