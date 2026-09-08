from rest_framework import serializers
from .models import Shift
from .services import get_close_audit_status


class ShiftSerializer(serializers.ModelSerializer):
    opened_by_name = serializers.CharField(source='opened_by.full_name', read_only=True)
    closed_by_name = serializers.CharField(source='closed_by.full_name', read_only=True)
    has_audit      = serializers.SerializerMethodField()
    has_pos_audit  = serializers.SerializerMethodField()
    has_delivery_audit = serializers.SerializerMethodField()
    requires_delivery_audit = serializers.SerializerMethodField()
    missing_audits = serializers.SerializerMethodField()

    def _close_audit_status(self, obj):
        if not hasattr(self, '_close_audit_status_cache'):
            self._close_audit_status_cache = {}
        cache_key = obj.pk or id(obj)
        if cache_key not in self._close_audit_status_cache:
            self._close_audit_status_cache[cache_key] = get_close_audit_status(obj)
        return self._close_audit_status_cache[cache_key]

    def get_has_audit(self, obj):
        return self._close_audit_status(obj)['is_ready']

    def get_has_pos_audit(self, obj):
        return self._close_audit_status(obj)['has_pos_audit']

    def get_has_delivery_audit(self, obj):
        return self._close_audit_status(obj)['has_delivery_audit']

    def get_requires_delivery_audit(self, obj):
        return self._close_audit_status(obj)['requires_delivery_audit']

    def get_missing_audits(self, obj):
        return self._close_audit_status(obj)['missing_audits']

    class Meta:
        model = Shift
        fields = [
            'id', 'opened_by', 'opened_by_name', 'closed_by', 'closed_by_name',
            'opened_at', 'closed_at', 'status', 'notes', 'has_audit',
            'has_pos_audit', 'has_delivery_audit', 'requires_delivery_audit',
            'missing_audits',
        ]
        read_only_fields = ['id', 'opened_at', 'closed_at', 'opened_by', 'closed_by', 'status']
