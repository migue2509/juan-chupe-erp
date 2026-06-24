from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('cash', '0002_initial'),
    ]

    operations = [
        migrations.CreateModel(
            name='ShiftAuditItem',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('product_name', models.CharField(max_length=100)),
                ('product_type', models.CharField(
                    choices=[('cup', 'Vaso'), ('topping', 'Topping'), ('other', 'Otro')],
                    default='cup', max_length=20,
                )),
                ('unit_price', models.DecimalField(decimal_places=0, default=0, max_digits=10)),
                ('opening_stock', models.IntegerField(default=0, help_text='Stock al iniciar la jornada')),
                ('entries', models.IntegerField(default=0, help_text='Entradas durante la jornada')),
                ('closing_stock', models.IntegerField(default=0, help_text='Stock al cerrar la jornada')),
                ('audit', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='items',
                    to='cash.cashaudit',
                )),
            ],
            options={
                'verbose_name': 'Item de Arqueo',
                'verbose_name_plural': 'Items de Arqueo',
                'ordering': ['product_type', 'product_name'],
            },
        ),
    ]
