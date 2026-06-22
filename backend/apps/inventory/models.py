from django.db import models
from decimal import Decimal


class FlavorBag(models.Model):
    """Bolsa de granizado asociada a un sabor — stock en ml"""
    CATEGORY_CHOICES = [
        ('creamy',       'Cremoso'),
        ('refreshing',   'Refrescante'),
        ('non_alcoholic','Sin Alcohol'),
    ]

    flavor = models.OneToOneField(
        'products.Flavor', on_delete=models.CASCADE, related_name='bag'
    )
    category = models.CharField(max_length=20, choices=CATEGORY_CHOICES)
    stock_ml = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0'))
    min_stock_ml = models.DecimalField(
        max_digits=10, decimal_places=2, default=Decimal('500'),
        help_text='Alerta cuando baje de este valor (ml)'
    )
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Bolsa de Sabor'
        verbose_name_plural = 'Bolsas de Sabores'

    def __str__(self):
        return f'Bolsa {self.flavor.name} — {self.stock_ml:.0f} ml'

    @property
    def is_low_stock(self):
        return self.stock_ml <= self.min_stock_ml

    def consume(self, ml: Decimal):
        """Descuenta ml del stock (llamado por el motor de ventas)"""
        self.stock_ml = max(Decimal('0'), self.stock_ml - ml)
        self.save()

    def add_stock(self, ml: Decimal):
        self.stock_ml += ml
        self.save()


class CupStock(models.Model):
    """Stock de vasos físicos"""
    cup_size = models.OneToOneField(
        'products.CupSize', on_delete=models.CASCADE, related_name='stock'
    )
    quantity = models.IntegerField(default=0)
    min_quantity = models.IntegerField(default=10, help_text='Alerta cuando baje de este valor')
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Stock de Vasos'
        verbose_name_plural = 'Stock de Vasos'

    def __str__(self):
        return f'Vasos {self.cup_size.size} — {self.quantity} unidades'

    @property
    def is_low_stock(self):
        return self.quantity <= self.min_quantity

    def consume(self, qty: int = 1):
        self.quantity = max(0, self.quantity - qty)
        self.save()

    def add_stock(self, qty: int):
        self.quantity += qty
        self.save()


class ToppingStock(models.Model):
    """Stock de toppings físicos"""
    topping = models.OneToOneField(
        'products.Topping', on_delete=models.CASCADE, related_name='stock'
    )
    quantity = models.IntegerField(default=0)
    min_quantity = models.IntegerField(default=0, help_text='Alerta cuando baje de este valor')
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Stock de Topping'
        verbose_name_plural = 'Stock de Toppings'

    def __str__(self):
        return f'Topping {self.topping.name} — {self.quantity} unidades'

    @property
    def is_low_stock(self):
        return self.min_quantity > 0 and self.quantity <= self.min_quantity

    def consume(self, qty: int = 1):
        self.quantity = max(0, self.quantity - qty)
        self.save()

    def add_stock(self, qty: int):
        self.quantity += qty
        self.save()


class StockMovement(models.Model):
    """Historial de movimientos de inventario"""
    MOVEMENT_TYPE = [
        ('in', 'Entrada'),
        ('out', 'Salida'),
        ('sale', 'Venta'),
        ('adjustment', 'Ajuste'),
    ]

    movement_type = models.CharField(max_length=15, choices=MOVEMENT_TYPE)
    flavor_bag = models.ForeignKey(
        FlavorBag, on_delete=models.SET_NULL, null=True, blank=True, related_name='movements'
    )
    cup_stock = models.ForeignKey(
        CupStock, on_delete=models.SET_NULL, null=True, blank=True, related_name='movements'
    )
    topping_stock = models.ForeignKey(
        ToppingStock, on_delete=models.SET_NULL, null=True, blank=True, related_name='movements'
    )
    quantity_ml = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    quantity_units = models.IntegerField(null=True, blank=True)
    purchase_amount = models.DecimalField(max_digits=12, decimal_places=0, null=True, blank=True,
        help_text='Valor pagado en compra (solo para vasos y bolsas)')
    notes = models.CharField(max_length=200, blank=True)
    created_by = models.ForeignKey('users.User', on_delete=models.SET_NULL, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    shift = models.ForeignKey(
        'shifts.Shift', on_delete=models.SET_NULL, null=True, blank=True
    )

    class Meta:
        verbose_name = 'Movimiento de Inventario'
        verbose_name_plural = 'Movimientos de Inventario'
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.get_movement_type_display()} — {self.created_at.strftime("%d/%m/%Y %H:%M")}'
