from django.db import models
from decimal import Decimal


class CashAudit(models.Model):
    """Arqueo de caja al cierre de jornada"""
    shift = models.OneToOneField('shifts.Shift', on_delete=models.CASCADE, related_name='cash_audit')
    audited_by = models.ForeignKey('users.User', on_delete=models.SET_NULL, null=True)

    # Ventas acumuladas (del sistema)
    expected_cash = models.DecimalField(max_digits=12, decimal_places=0, default=Decimal('0'))
    expected_transfer = models.DecimalField(max_digits=12, decimal_places=0, default=Decimal('0'))

    # Lo que entregaron físicamente
    actual_cash = models.DecimalField(max_digits=12, decimal_places=0, default=Decimal('0'))
    actual_transfer = models.DecimalField(max_digits=12, decimal_places=0, default=Decimal('0'))

    # Diferencia
    cash_difference = models.DecimalField(max_digits=12, decimal_places=0, default=Decimal('0'))
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    # Vasos físicos vs sistema
    cups_16oz_system = models.IntegerField(default=0)
    cups_16oz_actual = models.IntegerField(default=0)
    cups_24oz_system = models.IntegerField(default=0)
    cups_24oz_actual = models.IntegerField(default=0)

    # Bolsas
    bags_creamy_system = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal('0'))
    bags_creamy_actual = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal('0'))
    bags_refreshing_system = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal('0'))
    bags_refreshing_actual = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal('0'))

    class Meta:
        verbose_name = 'Arqueo de Caja'
        verbose_name_plural = 'Arqueos de Caja'

    def __str__(self):
        return f'Arqueo Jornada #{self.shift_id} — Diferencia: ${self.cash_difference:,.0f}'

    def calculate_difference(self):
        total_expenses = sum(
            e.amount for e in self.shift.expenses.filter(from_daily_cash=True)
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
    unit_price   = models.DecimalField(max_digits=10, decimal_places=0, default=0)

    # Columnas del arqueo físico
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
