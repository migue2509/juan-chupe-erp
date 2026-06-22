from django.db import models
from decimal import Decimal


class Flavor(models.Model):
    CATEGORY_CHOICES = [
        ('creamy',       'Cremoso'),
        ('refreshing',   'Refrescante'),
        ('non_alcoholic','Sin Alcohol'),
    ]

    name = models.CharField(max_length=100, unique=True)
    description = models.TextField(blank=True)
    category = models.CharField(max_length=20, choices=CATEGORY_CHOICES, default='water')
    color = models.CharField(max_length=7, default='#00E5FF', help_text='Color hex para UI')
    emoji = models.CharField(max_length=10, blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Sabor'
        verbose_name_plural = 'Sabores'
        ordering = ['name']

    def __str__(self):
        return f'{self.emoji} {self.name}' if self.emoji else self.name


class CupSize(models.Model):
    size = models.CharField(max_length=20, unique=True, help_text='Nombre libre, ej: 8oz, Grande, XL')
    ml = models.DecimalField(max_digits=8, decimal_places=2, help_text='Mililitros equivalentes')
    price = models.DecimalField(max_digits=10, decimal_places=0)
    min_quantity = models.IntegerField(default=10, help_text='Alerta cuando el stock baje de este número')
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Tamaño de Vaso'
        verbose_name_plural = 'Tamaños de Vaso'
        ordering = ['price']

    def __str__(self):
        return f'{self.size} — ${self.price:,.0f}'


class Product(models.Model):
    TYPE_CHOICES = [
        ('single', 'Sabor único'),
        ('combo', 'Combinado'),
        ('bomb', 'Bomba'),
    ]

    name = models.CharField(max_length=100)
    product_type = models.CharField(max_length=10, choices=TYPE_CHOICES, default='single')
    requires_topping = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Producto'
        verbose_name_plural = 'Productos'
        ordering = ['name']

    def __str__(self):
        return f'{self.name} ({self.get_product_type_display()})'


class Topping(models.Model):
    LINKED_CATEGORY_CHOICES = [
        ('creamy',       'Bolsa Cremosos (auto)'),
        ('refreshing',   'Bolsa Refrescantes (auto)'),
        ('non_alcoholic','Bolsa Sin Alcohol (auto)'),
    ]

    name = models.CharField(max_length=100, unique=True)
    price = models.DecimalField(max_digits=10, decimal_places=0, default=2000, help_text='Precio al vender como topping adicional')
    is_active = models.BooleanField(default=True)
    min_stock = models.IntegerField(default=0, help_text='Cantidad mínima de referencia')
    linked_category = models.CharField(
        max_length=20, choices=LINKED_CATEGORY_CHOICES,
        null=True, blank=True,
        help_text='Si se define, se descuenta automáticamente en cada venta con esa categoría de sabor'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Topping'
        verbose_name_plural = 'Toppings'

    def __str__(self):
        return self.name
