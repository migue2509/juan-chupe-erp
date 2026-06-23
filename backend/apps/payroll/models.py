from django.db import models
from django.utils import timezone
from decimal import Decimal

DAY_NAMES = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
DAY_LABELS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']


class WorkdaySchedule(models.Model):
    """
    Horario laboral y tarifa diaria de cada empleada.
    works_<day>  → ¿trabaja ese día?  (seguridad: bloquea login si no trabaja)
    <day>_wage   → cuánto gana ese día
    """
    user = models.OneToOneField(
        'users.User', on_delete=models.CASCADE, related_name='schedule'
    )

    # ¿Trabaja ese día?
    works_monday    = models.BooleanField(default=True)
    works_tuesday   = models.BooleanField(default=True)
    works_wednesday = models.BooleanField(default=True)
    works_thursday  = models.BooleanField(default=True)
    works_friday    = models.BooleanField(default=True)
    works_saturday  = models.BooleanField(default=False)
    works_sunday    = models.BooleanField(default=False)

    # Tarifa diaria
    monday_wage    = models.DecimalField(max_digits=10, decimal_places=0, default=Decimal('0'))
    tuesday_wage   = models.DecimalField(max_digits=10, decimal_places=0, default=Decimal('0'))
    wednesday_wage = models.DecimalField(max_digits=10, decimal_places=0, default=Decimal('0'))
    thursday_wage  = models.DecimalField(max_digits=10, decimal_places=0, default=Decimal('0'))
    friday_wage    = models.DecimalField(max_digits=10, decimal_places=0, default=Decimal('0'))
    saturday_wage  = models.DecimalField(max_digits=10, decimal_places=0, default=Decimal('0'))
    sunday_wage    = models.DecimalField(max_digits=10, decimal_places=0, default=Decimal('0'))

    # Seguridad: si True, la cuenta se bloquea en días que no trabaja
    security_enabled = models.BooleanField(default=False)

    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Horario Laboral'

    def __str__(self):
        return f'Horario de {self.user.full_name}'

    def is_work_day(self, date=None):
        """¿Es hoy (o la fecha dada) un día laboral para esta empleada?"""
        if date is None:
            date = timezone.localdate()
        day = DAY_NAMES[date.weekday()]  # weekday() → 0=lunes, 6=domingo
        return getattr(self, f'works_{day}', True)

    def wage_for_day(self, date=None):
        """Tarifa correspondiente al día dado."""
        if date is None:
            date = timezone.localdate()
        day = DAY_NAMES[date.weekday()]
        return getattr(self, f'{day}_wage', Decimal('0'))

    def weekly_total(self):
        """Suma de tarifas de los días que trabaja."""
        total = Decimal('0')
        for day in DAY_NAMES:
            if getattr(self, f'works_{day}', False):
                total += getattr(self, f'{day}_wage', Decimal('0'))
        return total


class WorkLog(models.Model):
    """Un registro por día que la empleada trabajó (creado al hacer login)."""
    user        = models.ForeignKey('users.User', on_delete=models.CASCADE, related_name='work_logs')
    date        = models.DateField()
    wage_earned = models.DecimalField(max_digits=10, decimal_places=0, default=Decimal('0'))
    # FK al pago que cubrió este día (null = pendiente de pago)
    payment     = models.ForeignKey(
        'WagePayment', on_delete=models.SET_NULL,
        null=True, blank=True, related_name='work_logs'
    )
    created_at  = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Día Trabajado'
        verbose_name_plural = 'Días Trabajados'
        unique_together = ['user', 'date']
        ordering = ['-date']

    def __str__(self):
        return f'{self.user.full_name} — {self.date} (${self.wage_earned:,.0f})'


class WagePayment(models.Model):
    """Pago de nómina semanal a una empleada."""
    user         = models.ForeignKey('users.User', on_delete=models.CASCADE, related_name='wage_payments')
    week_start   = models.DateField(help_text='Lunes de la semana pagada')
    week_end     = models.DateField(help_text='Domingo de la semana pagada')
    days_paid    = models.PositiveIntegerField(default=0)
    total_amount = models.DecimalField(max_digits=12, decimal_places=0)
    paid_by      = models.ForeignKey(
        'users.User', on_delete=models.SET_NULL,
        null=True, related_name='payments_made'
    )
    paid_at      = models.DateTimeField(auto_now_add=True)
    notes        = models.CharField(max_length=200, blank=True)

    class Meta:
        verbose_name = 'Pago de Nómina'
        verbose_name_plural = 'Pagos de Nómina'
        ordering = ['-paid_at']

    def __str__(self):
        return f'Pago {self.user.full_name} semana {self.week_start} — ${self.total_amount:,.0f}'
