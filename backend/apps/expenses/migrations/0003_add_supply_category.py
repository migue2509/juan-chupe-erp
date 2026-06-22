from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('expenses', '0002_initial'),
    ]

    operations = [
        migrations.AlterField(
            model_name='expense',
            name='category',
            field=models.CharField(
                max_length=20,
                choices=[
                    ('business',   'Gasto del Negocio'),
                    ('personal',   'Gasto Personal'),
                    ('petty_cash', 'Caja Menor'),
                    ('supply',     'Ingreso de Mercancía'),
                ],
            ),
        ),
    ]
