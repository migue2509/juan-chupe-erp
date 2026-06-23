from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('inventory', '0005_flavorbag_categories'),
        ('sales', '0005_sale_is_courtesy'),
    ]

    operations = [
        migrations.AddField(
            model_name='stockmovement',
            name='sale',
            field=models.ForeignKey(
                blank=True, null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='inventory_movements',
                to='sales.sale',
                help_text='Venta que originó esta salida',
            ),
        ),
    ]
