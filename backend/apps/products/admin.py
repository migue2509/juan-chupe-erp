from django.contrib import admin
from .models import Flavor, CupSize, Product, Topping

@admin.register(Flavor)
class FlavorAdmin(admin.ModelAdmin):
    list_display = ['name', 'category', 'emoji', 'is_active']
    list_filter = ['category', 'is_active']

@admin.register(CupSize)
class CupSizeAdmin(admin.ModelAdmin):
    list_display = ['size', 'ml', 'price', 'is_active']

@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = ['name', 'product_type', 'requires_topping', 'is_active']

@admin.register(Topping)
class ToppingAdmin(admin.ModelAdmin):
    list_display = ['name', 'is_active']
