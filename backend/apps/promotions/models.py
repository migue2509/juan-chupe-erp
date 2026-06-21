from django.db import models
from decimal import Decimal


class Promotion(models.Model):
    name = models.CharField(max_length=100)
    description = models.TextField(blank=True)
    quantity_included = models.PositiveIntegerField(default=2, help_text='Ej: 2 granizados')
    promo_price = models.DecimalField(max_digits=10, decimal_places=0)
    is_active = models.BooleanField(default=True)
    valid_days = models.CharField(
        max_length=50, blank=True,
        help_text='Ej: lunes,martes o vacío para todos los días'
    )
    created_by = models.ForeignKey('users.User', on_delete=models.SET_NULL, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Promoción'
        verbose_name_plural = 'Promociones'

    def __str__(self):
        return f'{self.name} — {self.quantity_included}x${self.promo_price:,.0f}'

    @property
    def unit_price(self) -> Decimal:
        """Precio unitario proporcional (RN-004)"""
        return self.promo_price / Decimal(str(self.quantity_included))
