from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('cash', '0005_shiftaudititem_product_id'),
        ('shifts', '0001_initial'),
    ]

    operations = [
        migrations.CreateModel(
            name='SellerCashDelivery',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('seller_id', models.PositiveIntegerField(blank=True, null=True)),
                ('seller_name', models.CharField(blank=True, max_length=200)),
                ('net_delivered', models.DecimalField(blank=True, decimal_places=0, max_digits=12, null=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('shift', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='seller_cash_deliveries',
                    to='shifts.shift',
                )),
            ],
            options={
                'verbose_name': 'Entrega de caja por vendedora',
                'verbose_name_plural': 'Entregas de caja por vendedora',
            },
        ),
    ]
