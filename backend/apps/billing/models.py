from django.db import models
from django.utils import timezone


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

    def void_and_restore_inventory(self, user, reason='', note_prefix=None):
        if self.voided:
            return False

        note = note_prefix or f'Anulacion factura {self.invoice_number}'
        for item in self.sale.items.prefetch_related('saleitems_flavors__flavor__bag').all():
            item.reverse_inventory(note_prefix=note, shift=self.shift)

        self.voided = True
        self.voided_by = user
        self.voided_at = timezone.now()
        self.void_reason = reason
        self.save(update_fields=['voided', 'voided_by', 'voided_at', 'void_reason'])
        return True

    def save(self, *args, **kwargs):
        if not self.invoice_number:
            last = Invoice.objects.order_by('-id').first()
            next_num = (last.id + 1) if last else 1
            self.invoice_number = f'JC-{next_num:06d}'
        super().save(*args, **kwargs)
