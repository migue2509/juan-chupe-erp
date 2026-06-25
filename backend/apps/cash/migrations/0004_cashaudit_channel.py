from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('cash', '0003_shiftaudititem'),
        ('shifts', '0001_initial'),
    ]

    operations = [
        # Agregar campo channel con default 'pos'
        migrations.AddField(
            model_name='cashaudit',
            name='channel',
            field=models.CharField(
                choices=[('pos', 'POS'), ('delivery', 'Domicilios')],
                default='pos',
                max_length=20,
            ),
        ),
        # Eliminar la restricción OneToOne del campo shift
        migrations.AlterField(
            model_name='cashaudit',
            name='shift',
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.CASCADE,
                related_name='cash_audits',
                to='shifts.shift',
            ),
        ),
        # Nueva restricción única por (shift, channel)
        migrations.AlterUniqueTogether(
            name='cashaudit',
            unique_together={('shift', 'channel')},
        ),
    ]
