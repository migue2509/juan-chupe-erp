from django.db import migrations, models
from decimal import Decimal


class Migration(migrations.Migration):

    dependencies = [
        ('sales', '0004_saleitem_cup_size_nullable'),
    ]

    operations = [
        migrations.AddField(
            model_name='sale',
            name='is_courtesy',
            field=models.BooleanField(default=False, help_text='Venta marcada como cortesía'),
        ),
        migrations.AddField(
            model_name='sale',
            name='courtesy_paid',
            field=models.DecimalField(
                max_digits=10, decimal_places=0, default=Decimal('0'),
                help_text='Dinero recibido por la cortesía (0 = completamente gratis)'
            ),
        ),
    ]
