from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('sales', '0006_sale_sale_number'),
    ]

    operations = [
        migrations.AddField(
            model_name='sale',
            name='seller_name',
            field=models.CharField(
                blank=True,
                default='',
                help_text='Nombre de la vendedora al momento de la venta (persiste si se elimina el usuario)',
                max_length=120,
            ),
        ),
    ]
