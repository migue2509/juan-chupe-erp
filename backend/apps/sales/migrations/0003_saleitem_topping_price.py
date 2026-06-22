from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('sales', '0002_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='saleitem',
            name='topping_price',
            field=models.DecimalField(decimal_places=0, default=0, max_digits=10),
        ),
    ]
