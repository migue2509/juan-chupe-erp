from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('products', '0006_topping_price'),
    ]

    operations = [
        migrations.AddField(
            model_name='flavor',
            name='licores',
            field=models.CharField(blank=True, default='', help_text='Licores separados por coma, ej: Ron, Aguardiente', max_length=300),
        ),
    ]
