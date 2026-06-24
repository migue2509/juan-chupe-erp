from django.db import models


class TransferMethod(models.Model):
    PROVIDER_CHOICES = [
        ('bancolombia', 'Bancolombia'),
        ('nequi',       'Nequi'),
        ('daviplata',   'Daviplata'),
        ('other',       'Otro'),
    ]

    provider       = models.CharField(max_length=20, choices=PROVIDER_CHOICES)
    display_name   = models.CharField(max_length=100, help_text='Nombre que verá el cliente')
    account_number = models.CharField(max_length=100, blank=True, help_text='Número de cuenta o celular')
    qr_image       = models.ImageField(upload_to='transfer_qr/', null=True, blank=True)
    is_active      = models.BooleanField(default=True)
    order          = models.PositiveIntegerField(default=0, help_text='Orden de aparición')

    class Meta:
        verbose_name        = 'Método de transferencia'
        verbose_name_plural = 'Métodos de transferencia'
        ordering            = ['order', 'provider']

    def __str__(self):
        return f'{self.display_name} — {self.account_number}'
