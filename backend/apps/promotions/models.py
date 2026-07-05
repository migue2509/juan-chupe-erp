from django.db import models
from decimal import Decimal


class Promotion(models.Model):
    CATEGORY_CHOICES = [
        ('pos',   'Punto de Venta'),
        ('rappi', 'Rappi'),
        ('didi',  'DiDi'),
    ]

    name = models.CharField(max_length=100)
    description = models.TextField(blank=True)
    category = models.CharField(
        max_length=10, choices=CATEGORY_CHOICES, default='pos',
        help_text='Canal de venta de esta promoción'
    )
    # ── Campos para promos POS (un solo tamaño de vaso) ──
    cup_size = models.ForeignKey(
        'products.CupSize', on_delete=models.SET_NULL,
        null=True, blank=True, related_name='promotions'
    )
    quantity_included = models.PositiveIntegerField(default=2, help_text='Ej: 2 granizados')
    # ── Precio y comisión de plataforma ──
    promo_price = models.DecimalField(max_digits=10, decimal_places=0)
    platform_fee_pct = models.DecimalField(
        max_digits=5, decimal_places=2, default=Decimal('0'),
        help_text='% que cobra la plataforma (ej. 30 = 30%)'
    )
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
        ordering = ['category', 'name']

    def __str__(self):
        return f'{self.name} — {self.quantity_included}x${self.promo_price:,.0f}'

    @property
    def unit_price(self) -> Decimal:
        """Precio unitario proporcional (RN-004)"""
        return self.promo_price / Decimal(str(self.quantity_included))

    @property
    def net_price(self) -> Decimal:
        """Precio neto después del descuento de la plataforma"""
        discount = self.promo_price * (self.platform_fee_pct / Decimal('100'))
        return self.promo_price - discount


class PromotionItem(models.Model):
    """Producto incluido en una promo de plataforma (Rappi/DiDi)."""
    promotion = models.ForeignKey(
        Promotion, on_delete=models.CASCADE, related_name='items'
    )
    cup_size = models.ForeignKey(
        'products.CupSize', on_delete=models.SET_NULL,
        null=True, blank=True
    )
    quantity = models.PositiveIntegerField(default=1)
    custom_name = models.CharField(
        max_length=100, blank=True,
        help_text='Nombre descriptivo del ítem (ej. "Granizado grande")'
    )

    class Meta:
        verbose_name = 'Ítem de promoción'
        verbose_name_plural = 'Ítems de promoción'
        ordering = ['id']

    def __str__(self):
        size = self.cup_size.size if self.cup_size else '—'
        return f'{self.quantity}× {size} ({self.promotion.name})'
