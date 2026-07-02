from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('deliveries', '0005_delivery_four_digits_to_cliente'),
    ]

    operations = [
        migrations.AddField(
            model_name='delivery',
            name='latitude',
            field=models.DecimalField(blank=True, decimal_places=7, max_digits=10, null=True),
        ),
        migrations.AddField(
            model_name='delivery',
            name='longitude',
            field=models.DecimalField(blank=True, decimal_places=7, max_digits=10, null=True),
        ),
    ]
