from django.contrib import admin
from .models import Shift

@admin.register(Shift)
class ShiftAdmin(admin.ModelAdmin):
    list_display = ['id', 'opened_at', 'closed_at', 'status', 'opened_by']
    list_filter = ['status']
    readonly_fields = ['opened_at', 'closed_at']
