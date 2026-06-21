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
