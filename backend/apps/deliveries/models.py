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
    four_digits = models.CharField(max_length=100, blank=True, default='', help_text='Nombre o identificador del cliente')
    address   = models.CharField(max_length=300)
    latitude  = models.DecimalField(max_digits=10, decimal_places=7, null=True, blank=True)
    longitude = models.DecimalField(max_digits=10, decimal_places=7, null=True, blank=True)
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


class HeatmapPoint(models.Model):
    """Punto histórico para el mapa de calor (sin venta asociada)."""
    address    = models.CharField(max_length=300)
    latitude   = models.DecimalField(max_digits=10, decimal_places=7)
    longitude  = models.DecimalField(max_digits=10, decimal_places=7)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Punto de calor histórico'
        verbose_name_plural = 'Puntos de calor históricos'

    def __str__(self):
        return f'HeatmapPoint {self.address} ({self.latitude}, {self.longitude})'
