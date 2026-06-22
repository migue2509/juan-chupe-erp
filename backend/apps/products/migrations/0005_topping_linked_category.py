from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('products', '0004_flavor_categories'),
    ]

    operations = [
        migrations.AddField(
            model_name='topping',
            name='linked_category',
            field=models.CharField(
                blank=True, null=True, max_length=20,
                choices=[
                    ('creamy',       'Bolsa Cremosos (auto)'),
                    ('refreshing',   'Bolsa Refrescantes (auto)'),
                    ('non_alcoholic','Bolsa Sin Alcohol (auto)'),
                ],
                help_text='Si se define, se descuenta automáticamente en cada venta con esa categoría de sabor',
            ),
        ),
    ]
