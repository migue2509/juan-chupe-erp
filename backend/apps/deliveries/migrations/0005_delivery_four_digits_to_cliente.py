from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('deliveries', '0004_domiciliario_change_delivery_person'),
    ]

    operations = [
        migrations.AlterField(
            model_name='delivery',
            name='four_digits',
            field=models.CharField(
                max_length=100,
                blank=True,
                default='',
                help_text='Nombre o identificador del cliente'
            ),
        ),
    ]
