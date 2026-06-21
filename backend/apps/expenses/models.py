from django.db import models
from decimal import Decimal


class Expense(models.Model):
    CATEGORY_CHOICES = [
        ('business', 'Gasto del Negocio'),
        ('personal', 'Gasto Personal'),
        ('petty_cash', 'Caja Menor'),
    ]

    shift = models.ForeignKey('shifts.Shift', on_delete=models.PROTECT, related_name='expenses')
    registered_by = models.ForeignKey('users.User', on_delete=models.SET_NULL, null=True)
    category = models.CharField(max_length=20, choices=CATEGORY_CHOICES)
    description = models.CharField(max_length=200)
    amount = models.DecimalField(max_digits=10, decimal_places=0)
    from_daily_cash = models.BooleanField(
        default=True,
        help_text='¿Este gasto sale de la plata del negocio del día?'
    )
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Gasto'
        verbose_name_plural = 'Gastos'
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.get_category_display()} — {self.description} — ${self.amount:,.0f}'
