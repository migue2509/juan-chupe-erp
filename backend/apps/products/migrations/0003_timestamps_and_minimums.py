import django.utils.timezone
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('products', '0002_cupsize_free_size'),
    ]

    operations = [
        # ── Flavor ──
        migrations.AddField(
            model_name='flavor',
            name='updated_at',
            field=models.DateTimeField(auto_now=True),
        ),

        # ── CupSize ──
        migrations.AddField(
            model_name='cupsize',
            name='min_quantity',
            field=models.IntegerField(default=10, help_text='Alerta cuando el stock baje de este número'),
        ),
        migrations.AddField(
            model_name='cupsize',
            name='created_at',
            field=models.DateTimeField(auto_now_add=True, default=django.utils.timezone.now),
            preserve_default=False,
        ),
        migrations.AddField(
            model_name='cupsize',
            name='updated_at',
            field=models.DateTimeField(auto_now=True),
        ),

        # ── Topping ──
        migrations.AddField(
            model_name='topping',
            name='min_stock',
            field=models.IntegerField(default=0, help_text='Cantidad mínima de referencia'),
        ),
        migrations.AddField(
            model_name='topping',
            name='created_at',
            field=models.DateTimeField(auto_now_add=True, default=django.utils.timezone.now),
            preserve_default=False,
        ),
        migrations.AddField(
            model_name='topping',
            name='updated_at',
            field=models.DateTimeField(auto_now=True),
        ),
    ]
