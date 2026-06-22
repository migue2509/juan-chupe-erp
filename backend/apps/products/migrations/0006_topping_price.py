from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('products', '0005_topping_linked_category'),
    ]

    operations = [
        migrations.AddField(
            model_name='topping',
            name='price',
            field=models.DecimalField(
                decimal_places=0, default=2000, max_digits=10,
                help_text='Precio al vender como topping adicional',
            ),
        ),
    ]
