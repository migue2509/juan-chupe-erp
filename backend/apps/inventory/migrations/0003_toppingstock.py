import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('inventory', '0002_initial'),
        ('products', '0003_timestamps_and_minimums'),
    ]

    operations = [
        # ── ToppingStock model ──
        migrations.CreateModel(
            name='ToppingStock',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('quantity', models.IntegerField(default=0)),
                ('min_quantity', models.IntegerField(default=0, help_text='Alerta cuando baje de este valor')),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('topping', models.OneToOneField(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='stock',
                    to='products.topping',
                )),
            ],
            options={
                'verbose_name': 'Stock de Topping',
                'verbose_name_plural': 'Stock de Toppings',
            },
        ),
        # ── FK en StockMovement ──
        migrations.AddField(
            model_name='stockmovement',
            name='topping_stock',
            field=models.ForeignKey(
                blank=True, null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='movements',
                to='inventory.toppingstock',
            ),
        ),
    ]
