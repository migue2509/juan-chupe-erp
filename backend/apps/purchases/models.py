from django.db import models


class Purchase(models.Model):
    shift = models.ForeignKey('shifts.Shift', on_delete=models.PROTECT, related_name='purchases')
    registered_by = models.ForeignKey('users.User', on_delete=models.SET_NULL, null=True)
    description = models.CharField(max_length=200)
    amount = models.DecimalField(max_digits=10, decimal_places=0)
    from_daily_cash = models.BooleanField(
        default=True,
        help_text='¿Este gasto sale de la plata del negocio del día?'
    )
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Compra'
        verbose_name_plural = 'Compras'
        ordering = ['-created_at']

    def __str__(self):
        return f'Compra — {self.description} — ${self.amount:,.0f}'
