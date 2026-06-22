from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('inventory', '0003_toppingstock'),
    ]

    operations = [
        migrations.AddField(
            model_name='stockmovement',
            name='purchase_amount',
            field=models.DecimalField(
                blank=True, null=True, max_digits=12, decimal_places=0,
                help_text='Valor pagado en compra (solo para vasos y bolsas)',
            ),
        ),
    ]
