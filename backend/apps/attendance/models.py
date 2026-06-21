from django.db import models
from django.utils import timezone


class AttendanceRecord(models.Model):
    user = models.ForeignKey('users.User', on_delete=models.CASCADE, related_name='attendance')
    shift = models.ForeignKey('shifts.Shift', on_delete=models.CASCADE, related_name='attendance')
    check_in = models.DateTimeField(auto_now_add=True)
    check_out = models.DateTimeField(null=True, blank=True)
    notes = models.CharField(max_length=200, blank=True)

    class Meta:
        verbose_name = 'Registro de Asistencia'
        verbose_name_plural = 'Registros de Asistencia'
        ordering = ['-check_in']

    def __str__(self):
        return f'{self.user.full_name} — {self.check_in.strftime("%d/%m/%Y %H:%M")}'

    @property
    def hours_worked(self):
        if self.check_out:
            delta = self.check_out - self.check_in
            return round(delta.total_seconds() / 3600, 2)
        return None

    def checkout(self):
        self.check_out = timezone.now()
        self.save()
