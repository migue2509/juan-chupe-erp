from django.db import models


class Invoice(models.Model):
    sale = models.OneToOneField('sales.Sale', on_delete=models.CASCADE, related_name='invoice')
    shift = models.ForeignKey('shifts.Shift', on_delete=models.PROTECT, related_name='invoices')
    invoice_number = models.CharField(max_length=20, unique=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    voided = models.BooleanField(default=False)
    voided_by = models.ForeignKey(
        'users.User', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='voided_invoices'
    )
    voided_at = models.DateTimeField(null=True, blank=True)
    void_reason = models.TextField(blank=True)

    class Meta:
        verbose_name = 'Factura'
        verbose_name_plural = 'Facturas'
        ordering = ['-created_at']

    def __str__(self):
        return f'Factura {self.invoice_number}'

    def save(self, *args, **kwargs):
        if not self.invoice_number:
            last = Invoice.objects.order_by('-id').first()
            next_num = (last.id + 1) if last else 1
            self.invoice_number = f'JC-{next_num:06d}'
        super().save(*args, **kwargs)
