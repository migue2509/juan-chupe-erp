from django.contrib import admin
from .models import Sale, SaleItem

class SaleItemInline(admin.TabularInline):
    model = SaleItem
    extra = 0
    readonly_fields = ['subtotal']

@admin.register(Sale)
class SaleAdmin(admin.ModelAdmin):
    list_display = ['id', 'seller', 'total', 'payment_method', 'is_delivery', 'created_at']
    list_filter = ['payment_method', 'is_delivery', 'shift']
    inlines = [SaleItemInline]
    readonly_fields = ['total', 'change_given', 'created_at']
