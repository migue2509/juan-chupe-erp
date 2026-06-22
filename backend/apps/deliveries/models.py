from django.db import models


class Delivery(models.Model):
    STATUS_CHOICES = [
        ('pending', 'Pendiente'),
        ('on_way', 'En Camino'),
        ('delivered', 'Entregado'),
        ('cancelled', 'Cancelado'),
    ]

    sale = models.OneToOneField('sales.Sale', on_delete=models.CASCADE, related_name='delivery')
    shift = models.ForeignKey('shifts.Shift', on_delete=models.PROTECT, related_name='deliveries')
    delivery_person = models.ForeignKey(
        'users.User', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='deliveries', limit_choices_to={'role': 'delivery'}
    )
    four_digits = models.CharField(max_length=4, blank=True, default='', help_text='Últimos 4 dígitos del cliente')
    address = models.CharField(max_length=300)
    status = models.CharField(max_length=15, choices=STATUS_CHOICES, default='pending')
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    delivered_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        verbose_name = 'Domicilio'
        verbose_name_plural = 'Domicilios'
        ordering = ['-created_at']

    def __str__(self):
        return f'Domicilio #{self.id} — {self.address} — {self.get_status_display()}'
