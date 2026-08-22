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
    seller_name = models.CharField(
        max_length=120, blank=True, default='',
        help_text='Nombre de la vendedora al momento de la venta (persiste si se elimina el usuario)'
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

    @property
    def paid_total(self):
        """Dinero real que debe entrar por la venta."""
        return self.courtesy_paid if self.is_courtesy else self.total

    @property
    def cash_amount(self):
        """Efectivo real de la venta para arqueos."""
        if self.is_courtesy:
            if self.payment_method == 'cash':
                return self.courtesy_paid
            if self.payment_method == 'mixed':
                return self.cash_received
            return Decimal('0')

        if self.payment_method == 'cash':
            return self.total
        if self.payment_method == 'mixed':
            return self.cash_received
        return Decimal('0')

    @property
    def transfer_paid(self):
        """Transferencia real de la venta para reportes y arqueos."""
        if self.is_courtesy:
            if self.payment_method == 'transfer':
                return self.courtesy_paid
            if self.payment_method == 'mixed':
                return self.transfer_amount
            return Decimal('0')

        if self.payment_method == 'transfer':
            return self.transfer_amount or self.total
        if self.payment_method == 'mixed':
            return self.transfer_amount
        return Decimal('0')

    def calculate_total(self):
        total = sum(item.subtotal for item in self.items.all())
        self.total = total
        if self.payment_method == 'mixed':
            # cash_received = monto efectivo exacto que va a caja; no hay vuelto en mixto
            if self.transfer_amount == Decimal('0'):
                self.transfer_amount = max(Decimal('0'), total - self.cash_received)
            self.change_given = Decimal('0')
        elif self.payment_method == 'transfer':
            # Si no se ingresó transfer_amount, usar el total
            if self.transfer_amount == Decimal('0'):
                self.transfer_amount = total
            self.change_given = Decimal('0')
        else:
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

    def reverse_inventory(self, note_prefix=None, shift=None):
        """Devuelve al inventario lo que consumió este item."""
        from apps.inventory.models import FlavorBag, CupStock, StockMovement
        from apps.shifts.models import Shift
        if shift is None:
            shift = Shift.get_active()
        prefix = note_prefix or f'Corrección venta #{self.sale_id}'

        if not self.cup_size:
            if self.topping:
                ts = self.topping.stock
                ts.add_stock(self.quantity)
                StockMovement.objects.create(
                    movement_type='adjustment', topping_stock=ts,
                    quantity_units=self.quantity,
                    notes=f'{prefix} — topping',
                    created_by=self.sale.seller, shift=shift
                )
            return

        cup_ml = self.cup_size.ml
        sale_flavors = self.saleitems_flavors.select_related('flavor__bag').all()
        num_flavors  = sale_flavors.count()

        for sf in sale_flavors:
            bag = sf.flavor.bag
            ml  = cup_ml / Decimal(str(max(num_flavors, 1))) * self.quantity
            bag.add_stock(ml)
            StockMovement.objects.create(
                movement_type='adjustment', flavor_bag=bag,
                quantity_ml=ml,
                notes=f'{prefix} — {sf.flavor.name}',
                created_by=self.sale.seller, shift=shift
            )

        cup_stock = CupStock.objects.get(cup_size=self.cup_size)
        cup_stock.add_stock(self.quantity)
        StockMovement.objects.create(
            movement_type='adjustment', cup_stock=cup_stock,
            quantity_units=self.quantity,
            notes=f'{prefix} — vaso {self.cup_size.size}',
            created_by=self.sale.seller, shift=shift
        )

        # Revertir topping automático
        try:
            from apps.products.models import Topping as ToppingModel
            categories = {sf.flavor.category for sf in sale_flavors if sf.flavor.category}
            if len(categories) == 1:
                primary_cat = next(iter(categories))
                auto_topping = ToppingModel.objects.get(linked_category=primary_cat, is_active=True)
                auto_ts = auto_topping.stock
                auto_ts.add_stock(self.quantity)
                StockMovement.objects.create(
                    movement_type='adjustment', topping_stock=auto_ts,
                    quantity_units=self.quantity,
                    notes=f'{prefix} — topping auto',
                    created_by=self.sale.seller, shift=shift
                )
        except ToppingModel.DoesNotExist:
            pass  # No hay topping automático para esta categoría, es normal

    def apply_inventory(self, shift=None):
        """Motor de consumo: descuenta ml por sabor y vasos (RN-008, RN-009)"""
        if not self.cup_size:
            # topping-only: descontar del stock del topping vendido
            if self.topping:
                from apps.inventory.models import StockMovement
                from apps.shifts.models import Shift
                if shift is None:
                    shift = Shift.get_active()
                ts = self.topping.stock
                ts.consume(self.quantity)
                StockMovement.objects.create(
                    movement_type='sale', topping_stock=ts,
                    quantity_units=self.quantity,
                    sale=self.sale,
                    notes=f'Venta #{self.sale_id} — topping suelto',
                    created_by=self.sale.seller, shift=shift
                )
            return
        from apps.inventory.models import FlavorBag, CupStock, StockMovement
        from apps.shifts.models import Shift

        if shift is None:
            shift = Shift.get_active()
        cup_ml = self.cup_size.ml
        sale_flavors = list(self.saleitems_flavors.select_related('flavor__bag').all())
        num_flavors = len(sale_flavors)
        if num_flavors == 0:
            raise ValueError(f'La venta #{self.sale_id} no tiene sabores para descontar.')

        for sf in sale_flavors:
            bag = sf.flavor.bag
            ml_per_flavor = cup_ml / Decimal(str(num_flavors)) * self.quantity
            bag.consume(ml_per_flavor)
            StockMovement.objects.create(
                movement_type='sale', flavor_bag=bag,
                quantity_ml=ml_per_flavor,
                sale=self.sale,
                notes=f'Venta #{self.sale_id} — {self.cup_size.size}',
                created_by=self.sale.seller, shift=shift
            )

        # Descuenta vasos
        cup_stock = CupStock.objects.get(cup_size=self.cup_size)
        cup_stock.consume(self.quantity)
        StockMovement.objects.create(
            movement_type='sale', cup_stock=cup_stock,
            quantity_units=self.quantity,
            sale=self.sale,
            notes=f'Venta #{self.sale_id}',
            created_by=self.sale.seller, shift=shift
        )

        # ── Descuenta bolsa de topping automática según categoría del sabor ──
        from apps.products.models import Topping as ToppingModel
        categories = {sf.flavor.category for sf in sale_flavors if sf.flavor.category}
        if len(categories) != 1:
            return

        primary_cat = next(iter(categories))
        try:
            auto_topping = ToppingModel.objects.get(linked_category=primary_cat, is_active=True)
        except ToppingModel.DoesNotExist:
            return
        except ToppingModel.MultipleObjectsReturned:
            raise ValueError(f'Hay mas de un topping automatico activo para la categoria {primary_cat}.')

        auto_ts = auto_topping.stock
        auto_ts.consume(self.quantity)
        StockMovement.objects.create(
            movement_type='sale', topping_stock=auto_ts,
            quantity_units=self.quantity,
            sale=self.sale,
            notes=f'Venta #{self.sale_id} — bolsa auto {primary_cat}',
            created_by=self.sale.seller, shift=shift
        )


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
