from django.db import models
from decimal import Decimal


class CashAudit(models.Model):
    """Arqueo de caja al cierre de jornada — uno por canal (pos / delivery)"""

    CHANNEL_CHOICES = [
        ('pos',      'POS'),
        ('delivery', 'Domicilios'),
    ]

    shift    = models.ForeignKey(
        'shifts.Shift', on_delete=models.CASCADE, related_name='cash_audits'
    )
    channel  = models.CharField(max_length=20, choices=CHANNEL_CHOICES, default='pos')
    audited_by = models.ForeignKey('users.User', on_delete=models.SET_NULL, null=True)

    # Ventas acumuladas (del sistema)
    expected_cash     = models.DecimalField(max_digits=12, decimal_places=0, default=Decimal('0'))
    expected_transfer = models.DecimalField(max_digits=12, decimal_places=0, default=Decimal('0'))

    # Lo que entregaron físicamente
    actual_cash     = models.DecimalField(max_digits=12, decimal_places=0, default=Decimal('0'))
    actual_transfer = models.DecimalField(max_digits=12, decimal_places=0, default=Decimal('0'))

    cash_difference = models.DecimalField(max_digits=12, decimal_places=0, default=Decimal('0'))
    notes      = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Arqueo de Caja'
        verbose_name_plural = 'Arqueos de Caja'
        unique_together = [('shift', 'channel')]

    def __str__(self):
        return f'Arqueo {self.get_channel_display()} Jornada #{self.shift_id}'

    def calculate_difference(self):
        origin_filter = 'pos' if self.channel == 'pos' else 'delivery'
        total_expenses = sum(
            e.amount for e in self.shift.expenses.filter(
                from_daily_cash=True, payment_method='cash', origin=origin_filter
            )
        )
        self.cash_difference = self.actual_cash - (self.expected_cash - total_expenses)
        self.save()


class ShiftAuditItem(models.Model):
    """Fila del arqueo físico de inventario por jornada"""
    PRODUCT_TYPE_CHOICES = [
        ('cup',     'Vaso'),
        ('topping', 'Topping'),
        ('other',   'Otro'),
    ]

    audit        = models.ForeignKey(CashAudit, on_delete=models.CASCADE, related_name='items')
    product_name = models.CharField(max_length=100)
    product_type = models.CharField(max_length=20, choices=PRODUCT_TYPE_CHOICES, default='cup')
    product_id   = models.PositiveIntegerField(null=True, blank=True, help_text='ID real del CupSize/Topping — para matching por ID sin depender del nombre')
    unit_price   = models.DecimalField(max_digits=10, decimal_places=0, default=0)

    opening_stock = models.IntegerField(default=0, help_text='Stock al iniciar la jornada')
    entries       = models.IntegerField(default=0, help_text='Entradas durante la jornada')
    closing_stock = models.IntegerField(default=0, help_text='Stock al cerrar la jornada')

    @property
    def available(self):
        return self.opening_stock + self.entries

    @property
    def sold(self):
        return max(0, self.available - self.closing_stock)

    class Meta:
        verbose_name = 'Item de Arqueo'
        verbose_name_plural = 'Items de Arqueo'
        ordering = ['product_type', 'product_name']

    def __str__(self):
        return f'{self.product_name} — vendido: {self.sold}'


class SellerCashDelivery(models.Model):
    """Cuánto entregó cada vendedora en efectivo al cerrar la jornada.
    seller_id=None representa el canal de domicilios."""
    shift         = models.ForeignKey(
        'shifts.Shift', on_delete=models.CASCADE, related_name='seller_cash_deliveries'
    )
    seller_id     = models.PositiveIntegerField(null=True, blank=True)
    seller_name   = models.CharField(max_length=200, blank=True)
    net_delivered = models.DecimalField(max_digits=12, decimal_places=0, null=True, blank=True)
    updated_at    = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name          = 'Entrega de caja por vendedora'
        verbose_name_plural   = 'Entregas de caja por vendedora'

    def __str__(self):
        return f'Jornada #{self.shift_id} — {self.seller_name or "Domicilios"}: {self.net_delivered}'
