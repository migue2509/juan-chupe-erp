from django.db import models
from django.core.validators import MinValueValidator
from decimal import Decimal


class Expense(models.Model):
    CATEGORY_CHOICES = [
        ('business',  'Gasto del Negocio'),
        ('personal',  'Gasto Personal'),
        ('petty_cash','Caja Menor'),
        ('supply',    'Ingreso de Mercancía'),
    ]

    ORIGIN_CHOICES = [
        ('pos',      'Punto de Venta'),
        ('delivery', 'Domicilios'),
    ]

    PAYMENT_METHOD_CHOICES = [
        ('cash',     'Efectivo'),
        ('transfer', 'Transferencia'),
    ]

    shift = models.ForeignKey('shifts.Shift', on_delete=models.PROTECT, related_name='expenses', null=True, blank=True)
    registered_by = models.ForeignKey('users.User', on_delete=models.SET_NULL, null=True)
    category = models.CharField(max_length=20, choices=CATEGORY_CHOICES)
    origin = models.CharField(max_length=10, choices=ORIGIN_CHOICES, default='pos',
        help_text='¿Este gasto es del punto de venta o de domicilios?')
    description = models.CharField(max_length=200)
    amount = models.DecimalField(
        max_digits=10,
        decimal_places=0,
        validators=[MinValueValidator(Decimal('0'))],
    )
    from_daily_cash = models.BooleanField(
        default=True,
        help_text='¿Este gasto sale de la plata del negocio del día?'
    )
    payment_method = models.CharField(
        max_length=10,
        choices=PAYMENT_METHOD_CHOICES,
        default='cash',
        help_text='Medio de pago del gasto (efectivo o transferencia)',
    )
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Gasto'
        verbose_name_plural = 'Gastos'
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.get_category_display()} — {self.description} — ${self.amount:,.0f}'
