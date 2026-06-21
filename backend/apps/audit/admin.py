from django.contrib import admin
from .models import AuditLog

@admin.register(AuditLog)
class AuditLogAdmin(admin.ModelAdmin):
    list_display = ['user', 'action', 'model', 'object_id', 'created_at']
    list_filter = ['action', 'model']
    readonly_fields = ['user', 'action', 'model', 'object_id', 'detail', 'ip', 'created_at']
