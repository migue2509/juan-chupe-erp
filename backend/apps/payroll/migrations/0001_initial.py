from django.db import migrations, models
import django.db.models.deletion
from decimal import Decimal


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ('users', '0001_initial'),
    ]

    operations = [
        migrations.CreateModel(
            name='WagePayment',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('week_start', models.DateField(help_text='Lunes de la semana pagada')),
                ('week_end', models.DateField(help_text='Domingo de la semana pagada')),
                ('days_paid', models.PositiveIntegerField(default=0)),
                ('total_amount', models.DecimalField(decimal_places=0, max_digits=12)),
                ('paid_at', models.DateTimeField(auto_now_add=True)),
                ('notes', models.CharField(blank=True, max_length=200)),
                ('paid_by', models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='payments_made', to='users.user')),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='wage_payments', to='users.user')),
            ],
            options={'verbose_name': 'Pago de Nómina', 'verbose_name_plural': 'Pagos de Nómina', 'ordering': ['-paid_at']},
        ),
        migrations.CreateModel(
            name='WorkdaySchedule',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('works_monday',    models.BooleanField(default=True)),
                ('works_tuesday',   models.BooleanField(default=True)),
                ('works_wednesday', models.BooleanField(default=True)),
                ('works_thursday',  models.BooleanField(default=True)),
                ('works_friday',    models.BooleanField(default=True)),
                ('works_saturday',  models.BooleanField(default=False)),
                ('works_sunday',    models.BooleanField(default=False)),
                ('monday_wage',    models.DecimalField(decimal_places=0, default=Decimal('0'), max_digits=10)),
                ('tuesday_wage',   models.DecimalField(decimal_places=0, default=Decimal('0'), max_digits=10)),
                ('wednesday_wage', models.DecimalField(decimal_places=0, default=Decimal('0'), max_digits=10)),
                ('thursday_wage',  models.DecimalField(decimal_places=0, default=Decimal('0'), max_digits=10)),
                ('friday_wage',    models.DecimalField(decimal_places=0, default=Decimal('0'), max_digits=10)),
                ('saturday_wage',  models.DecimalField(decimal_places=0, default=Decimal('0'), max_digits=10)),
                ('sunday_wage',    models.DecimalField(decimal_places=0, default=Decimal('0'), max_digits=10)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('user', models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name='schedule', to='users.user')),
            ],
            options={'verbose_name': 'Horario Laboral'},
        ),
        migrations.CreateModel(
            name='WorkLog',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('date', models.DateField()),
                ('wage_earned', models.DecimalField(decimal_places=0, default=Decimal('0'), max_digits=10)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('payment', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='work_logs', to='payroll.wagepayment')),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='work_logs', to='users.user')),
            ],
            options={'verbose_name': 'Día Trabajado', 'verbose_name_plural': 'Días Trabajados', 'ordering': ['-date'], 'unique_together': {('user', 'date')}},
        ),
    ]
