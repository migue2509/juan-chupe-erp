from django.db import models
from django.db.models import Q
from django.utils import timezone


class Shift(models.Model):
    STATUS_CHOICES = [
        ('open', 'Abierta'),
        ('closed', 'Cerrada'),
    ]

    opened_by = models.ForeignKey(
        'users.User', on_delete=models.PROTECT,
        related_name='shifts_opened', null=True, blank=True
    )
    closed_by = models.ForeignKey(
        'users.User', on_delete=models.PROTECT,
        related_name='shifts_closed', null=True, blank=True
    )
    opened_at = models.DateTimeField(auto_now_add=True)
    closed_at = models.DateTimeField(null=True, blank=True)
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='open')
    notes = models.TextField(blank=True)

    class Meta:
        verbose_name = 'Jornada'
        verbose_name_plural = 'Jornadas'
        ordering = ['-opened_at']
        constraints = [
            models.UniqueConstraint(
                fields=['status'],
                condition=Q(status='open'),
                name='unique_open_shift',
            )
        ]

    def __str__(self):
        return f'Jornada {self.opened_at.strftime("%d/%m/%Y %H:%M")} — {self.get_status_display()}'

    def close(self, user=None):
        if self.status == 'closed':
            return False
        self.status = 'closed'
        self.closed_at = timezone.now()
        self.closed_by = user
        self.save(update_fields=['status', 'closed_at', 'closed_by'])
        return True

    @classmethod
    def get_active(cls):
        return cls.objects.filter(status='open').first()

    @property
    def is_open(self):
        return self.status == 'open'
