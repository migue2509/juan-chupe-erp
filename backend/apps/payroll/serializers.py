from rest_framework import serializers
from .models import WorkdaySchedule, WorkLog, WagePayment, DAY_NAMES, DAY_LABELS


class WorkdayScheduleSerializer(serializers.ModelSerializer):
    user_name = serializers.CharField(source='user.full_name', read_only=True)
    weekly_total = serializers.SerializerMethodField()
    work_days_labels = serializers.SerializerMethodField()

    def get_weekly_total(self, obj):
        return float(obj.weekly_total())

    def get_work_days_labels(self, obj):
        return [DAY_LABELS[i] for i, d in enumerate(DAY_NAMES) if getattr(obj, f'works_{d}', False)]

    class Meta:
        model = WorkdaySchedule
        fields = [
            'id', 'user', 'user_name',
            'works_monday', 'works_tuesday', 'works_wednesday', 'works_thursday',
            'works_friday', 'works_saturday', 'works_sunday',
            'monday_wage', 'tuesday_wage', 'wednesday_wage', 'thursday_wage',
            'friday_wage', 'saturday_wage', 'sunday_wage',
            'security_enabled',
            'weekly_total', 'work_days_labels', 'updated_at',
        ]
        read_only_fields = ['id', 'updated_at']


class WorkLogSerializer(serializers.ModelSerializer):
    user_name = serializers.CharField(source='user.full_name', read_only=True)
    is_paid   = serializers.SerializerMethodField()
    day_label = serializers.SerializerMethodField()

    def get_is_paid(self, obj):
        return obj.payment_id is not None

    def get_day_label(self, obj):
        return DAY_LABELS[obj.date.weekday()]

    class Meta:
        model = WorkLog
        fields = ['id', 'user', 'user_name', 'date', 'day_label', 'wage_earned', 'is_paid', 'payment', 'created_at']
        read_only_fields = ['id', 'created_at']


class WagePaymentSerializer(serializers.ModelSerializer):
    user_name   = serializers.CharField(source='user.full_name', read_only=True)
    paid_by_name = serializers.CharField(source='paid_by.full_name', read_only=True, default='')
    work_logs   = WorkLogSerializer(many=True, read_only=True)

    class Meta:
        model = WagePayment
        fields = [
            'id', 'user', 'user_name', 'week_start', 'week_end',
            'days_paid', 'total_amount', 'paid_by', 'paid_by_name',
            'paid_at', 'notes', 'work_logs',
        ]
        read_only_fields = ['id', 'paid_at', 'paid_by']
