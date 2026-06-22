from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('sales', '0003_saleitem_topping_price'),
        ('products', '0006_topping_price'),
    ]

    operations = [
        migrations.AlterField(
            model_name='saleitem',
            name='cup_size',
            field=models.ForeignKey(
                blank=True, null=True,
                on_delete=django.db.models.deletion.PROTECT,
                to='products.cupsize',
            ),
        ),
    ]
