from django.db import migrations, models
from django.db.models import Q
from django.utils import timezone


def close_duplicate_open_shifts(apps, schema_editor):
    Shift = apps.get_model('shifts', 'Shift')
    open_shifts = list(Shift.objects.filter(status='open').order_by('-opened_at', '-id'))
    if len(open_shifts) <= 1:
        return

    note = 'Cerrada automaticamente antes de activar jornada unica abierta.'
    now = timezone.now()
    for shift in open_shifts[1:]:
        shift.status = 'closed'
        if shift.closed_at is None:
            shift.closed_at = now
        shift.notes = f'{shift.notes}\n{note}'.strip() if shift.notes else note
        shift.save(update_fields=['status', 'closed_at', 'notes'])


class Migration(migrations.Migration):

    dependencies = [
        ('shifts', '0002_initial'),
    ]

    operations = [
        migrations.RunPython(close_duplicate_open_shifts, migrations.RunPython.noop),
        migrations.AddConstraint(
            model_name='shift',
            constraint=models.UniqueConstraint(
                condition=Q(status='open'),
                fields=('status',),
                name='unique_open_shift',
            ),
        ),
    ]
