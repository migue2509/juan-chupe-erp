from django.db import migrations, models
import django.db.models.deletion
from decimal import Decimal


class Migration(migrations.Migration):

    dependencies = [
        ('promotions', '0003_promotion_cup_size'),
        ('products', '0004_flavor_categories'),
    ]

    operations = [
        migrations.AddField(
            model_name='promotion',
            name='category',
            field=models.CharField(
                choices=[('pos', 'Punto de Venta'), ('rappi', 'Rappi'), ('didi', 'DiDi')],
                default='pos',
                help_text='Canal de venta de esta promoción',
                max_length=10,
            ),
        ),
        migrations.AddField(
            model_name='promotion',
            name='platform_fee_pct',
            field=models.DecimalField(
                decimal_places=2,
                default=Decimal('0'),
                help_text='% que cobra la plataforma (ej. 30 = 30%)',
                max_digits=5,
            ),
        ),
        migrations.CreateModel(
            name='PromotionItem',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('quantity', models.PositiveIntegerField(default=1)),
                ('custom_name', models.CharField(
                    blank=True,
                    help_text='Nombre descriptivo del ítem (ej. "Granizado grande")',
                    max_length=100,
                )),
                ('cup_size', models.ForeignKey(
                    blank=True,
                    null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    to='products.cupsize',
                )),
                ('promotion', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='items',
                    to='promotions.promotion',
                )),
            ],
            options={
                'verbose_name': 'Ítem de promoción',
                'verbose_name_plural': 'Ítems de promoción',
                'ordering': ['id'],
            },
        ),
    ]
