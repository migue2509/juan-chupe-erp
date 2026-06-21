from django.contrib import admin
from .models import FlavorBag, CupStock, StockMovement

@admin.register(FlavorBag)
class FlavorBagAdmin(admin.ModelAdmin):
    list_display = ['flavor', 'category', 'stock_ml', 'min_stock_ml', 'is_low_stock']
    list_filter = ['category']

@admin.register(CupStock)
class CupStockAdmin(admin.ModelAdmin):
    list_display = ['cup_size', 'quantity', 'min_quantity', 'is_low_stock']

@admin.register(StockMovement)
class StockMovementAdmin(admin.ModelAdmin):
    list_display = ['movement_type', 'flavor_bag', 'cup_stock', 'quantity_ml', 'quantity_units', 'created_at']
    list_filter = ['movement_type']
    readonly_fields = ['created_at']
