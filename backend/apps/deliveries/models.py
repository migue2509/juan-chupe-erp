from django.db import models


class Domiciliario(models.Model):
    name       = models.CharField(max_length=100)
    is_active  = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Domiciliario'
        verbose_name_plural = 'Domiciliarios'
        ordering = ['name']

    def __str__(self):
        return self.name


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
        Domiciliario, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='deliveries'
    )
    four_digits = models.CharField(max_length=4, blank=True, default='', help_text='Últimos 4 dígitos del cliente')
    address = models.CharField(max_length=300)
    status = models.CharField(max_length=1