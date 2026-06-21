from django.db import models
from decimal import Decimal
from core.utils import oz_to_ml


class Sale(models.Model):
    PAYMENT_CHOICES = [
        ('cash', 'Efectivo'),
        ('transfer', 'Transferencia'),
        ('mixed', 'Mixto'),
    ]

    shift = models.ForeignKey('shifts.Shift', on_delete=models.PROTECT, related_name='sales')
    seller = models.ForeignKey(
        'users.User', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='sales', help_text='Vendedora seleccionada'
    )
    promotion = models.ForeignKey(
        'promotions.Promotion', on_delete=models.SET_NULL, null=True, blank=True
    )
    payment_method = models.CharField(max_length=15, choices=PAYMENT_CHOICES, default='cash')
    cash_received = models.DecimalField(max_digits=10, decimal_places=0, default=Decimal('0'))
    transfer_amount = models.DecimalField(max_digits=10, decimal_places=0, default=Decimal('0'))
    transfer_reference = models.CharField(max_length=100, blank=True)
    total = models.DecimalField(max_digits=10, decimal_places=0, default=Decimal('0'))
    change_given = models.DecimalField(max_digits=10, decimal_places=0, default=Decimal('0'))
    is_delivery = models.BooleanField(default=False)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Venta'
        verbose_name_plural = 'Ventas'
        ordering = ['-created_at']

    def __str__(self):
        return f'Venta #{self.id} — ${self.total:,.0f} — {self.created_at.strftime("%d/%m %H:%M")}'

    def calculate_total(self):
        total = sum(item.subtotal for item in self.items.all())
        self.total = total
        self.change_given = max(Decimal('0'), self.cash_received - total)
        self.save()


class SaleItem(models.Model):
    sale = models.ForeignKey(Sale, on_delete=models.CASCADE, related_name='items')
    cup_size = models.ForeignKey('products.CupSize', on_delete=models.PROTECT)
    flavors = models.ManyToManyField('products.Flavor', through='SaleItemFlavor')
    topping = models.ForeignKey(
        'products.Topping', on_delete=models.SET_NULL, null=True, blank=True
    )
    unit_price = models.DecimalField(max_digits=10, decimal_places=0)
    quantity = models.PositiveIntegerField(default=1)
    subtotal = models.DecimalField(max_digits=10, decimal_places=0)

    class Meta:
        verbose_name = 'Ítem de Venta'
        verbose_name_plural = 'Ítems de Venta'

    def __str__(self):
        return f'Item {self.cup_size.size} x{self.quantity} — ${self.subtotal:,.0f}'

    def save(self, *args, **kwargs):
        self.subtotal = self.unit_price * self.quantity
        super().save(*args, **kwargs)

    def apply_inventory(self):
        """Motor de consumo: descuenta ml por sabor y vasos (RN-008, RN-009)"""
        from apps.inventory.models import FlavorBag, CupStock, StockMovement
        from apps.shifts.models import Shift

        shift = Shift.get_active()
        cup_ml = self.cup_size.ml
        sale_flavors = self.saleitems_flavors.all()
        num_flavors = sale_flavors.count()

        for sf in sale_flavors:
            try:
                bag = sf.flavor.bag
                ml_per_flavor = cup_ml / Decimal(str(num_flavors)) * self.quantity
                bag.consume(ml_per_flavor)
                StockMovement.objects.create(
                    movement_type='sale', flavor_bag=bag,
                    quantity_ml=ml_per_flavor,
                    notes=f'Venta #{self.sale_id} — {self.cup_size.size}',
                    created_by=self.sale.seller, shift=shift
                )
            except Exception:
                pass

        # Descuenta vasos
        try:
            cup_stock = CupStock.objects.get(cup_size=self.cup_size)
            cup_stock.consume(self.quantity)
            StockMovement.objects.create(
                movement_type='sale', cup_stock=cup_stock,
                quantity_units=self.quantity,
                notes=f'Venta #{self.sale_id}',
                created_by=self.sale.seller, shift=shift
            )
        except Exception:
            pass


class SaleItemFlavor(models.Model):
    """Tabla intermedia: sabores de un item con ml descontados"""
    sale_item = models.ForeignKey(
        SaleItem, on_delete=models.CASCADE, related_name='saleitems_flavors'
    )
    flavor = models.ForeignKey('products.Flavor', on_delete=models.PROTECT)
    ml_consumed = models.DecimalField(max_digits=8, decimal_places=2, default=Decimal('0'))

    class Meta:
        verbose_name = 'Sabor de Item'
        unique_together = ['sale_item', 'flavor']
