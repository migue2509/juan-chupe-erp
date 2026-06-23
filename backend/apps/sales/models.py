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
    is_delivery  = models.BooleanField(default=False)
    is_courtesy  = models.BooleanField(default=False, help_text='Venta marcada como cortesía')
    courtesy_paid = models.DecimalField(
        max_digits=10, decimal_places=0, default=Decimal('0'),
        help_text='Dinero recibido por la cortesía (0 = completamente gratis)'
    )
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
    cup_size = models.ForeignKey('products.CupSize', on_delete=models.PROTECT, null=True, blank=True)
    flavors = models.ManyToManyField('products.Flavor', through='SaleItemFlavor')
    topping = models.ForeignKey(
        'products.Topping', on_delete=models.SET_NULL, null=True, blank=True
    )
    unit_price    = models.DecimalField(max_digits=10, decimal_places=0)
    topping_price = models.DecimalField(max_digits=10, decimal_places=0, default=0)
    quantity      = models.PositiveIntegerField(default=1)
    subtotal      = models.DecimalField(max_digits=10, decimal_places=0)

    class Meta:
        verbose_name = 'Ítem de Venta'
        verbose_name_plural = 'Ítems de Venta'

    def __str__(self):
        cup_label = self.cup_size.size if self.cup_size else 'Topping'
        return f'Item {cup_label} x{self.quantity} — ${self.subtotal:,.0f}'

    def save(self, *args, **kwargs):
        self.subtotal = (self.unit_price + self.topping_price) * self.quantity
        super().save(*args, **kwargs)

    def reverse_inventory(self):
        """Devuelve al inventario lo que consumió este item (para ediciones/correcciones)"""
        if not self.cup_size:
            # topping-only: devolver al stock del topping
            if self.topping:
                try:
                    from apps.inventory.models import StockMovement
                    from apps.shifts.models import Shift
                    shift = Shift.get_active()
                    ts = self.topping.stock
                    ts.add_stock(self.quantity)
                    StockMovement.objects.create(
                        movement_type='adjustment', topping_stock=ts,
                        quantity_units=self.quantity,
                        notes=f'Corrección venta #{self.sale_id} — topping suelto',
                        created_by=self.sale.seller, shift=shift
                    )
                except Exception:
                    pass
            return
        from apps.inventory.models import FlavorBag, CupStock, StockMovement
        from apps.shifts.models import Shift
        shift = Shift.get_active()
        cup_ml = self.cup_size.ml
        sale_flavors = self.saleitems_flavors.all()
        num_flavors  = sale_flavors.count()
        for sf in sale_flavors:
            try:
                bag = sf.flavor.bag
                ml  = cup_ml / Decimal(str(max(num_flavors, 1))) * self.quantity
                bag.add_stock(ml)
                StockMovement.objects.create(
                    movement_type='adjustment', flavor_bag=bag,
                    quantity_ml=ml,
                    notes=f'Corrección venta #{self.sale_id}',
                    created_by=self.sale.seller, shift=shift
                )
            except Exception:
                pass
        try:
            cup_stock = CupStock.objects.get(cup_size=self.cup_size)
            cup_stock.add_stock(self.quantity)
            StockMovement.objects.create(
                movement_type='adjustment', cup_stock=cup_stock,
                quantity_units=self.quantity,
                notes=f'Corrección venta #{self.sale_id}',
                created_by=self.sale.seller, shift=shift
            )
        except Exception:
            pass
        # Revertir bolsa de topping automática
        try:
            from apps.products.models import Topping as ToppingModel
            categories = {sf.flavor.category for sf in self.saleitems_flavors.select_related('flavor').all()}
            if categories:
                primary_cat = next(iter(categories))
                auto_topping = ToppingModel.objects.get(linked_category=primary_cat, is_active=True)
                auto_ts = auto_topping.stock
                auto_ts.add_stock(self.quantity)
                StockMovement.objects.create(
                    movement_type='adjustment', topping_stock=auto_ts,
                    quantity_units=self.quantity,
                    notes=f'Corrección venta #{self.sale_id} — bolsa auto',
                    created_by=self.sale.seller, shift=shift
                )
        except Exception:
            pass

    def apply_inventory(self):
        """Motor de consumo: descuenta ml por sabor y vasos (RN-008, RN-009)"""
        if not self.cup_size:
            # topping-only: descontar del stock del topping vendido
            if self.topping:
                try:
                    from apps.inventory.models import StockMovement
                    from apps.shifts.models import Shift
                    shift = Shift.get_active()
                    ts = self.topping.stock
                    ts.consume(self.quantity)
                    StockMovement.objects.create(
                        movement_type='sale', topping_stock=ts,
                        quantity_units=self.quantity,
                        notes=f'Venta #{self.sale_id} — topping suelto',
                        created_by=self.sale.seller, shift=shift
                    )
                except Exception:
                    pass
            return
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

        # ── Descuenta bolsa de topping automática según categoría del sabor ──
        try:
            from apps.products.models import Topping as ToppingModel
            categories = {sf.flavor.category for sf in sale_flavors}
            if categories:
                primary_cat = next(iter(categories))
                auto_topping = ToppingModel.objects.get(linked_category=primary_cat, is_active=True)
                auto_ts = auto_topping.stock
                auto_ts.consume(self.quantity)
                StockMovement.objects.create(
                    movement_type='sale', topping_stock=auto_ts,
                    quantity_units=self.quantity,
                    notes=f'Venta #{self.sale_id} — bolsa auto {primary_cat}',
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
