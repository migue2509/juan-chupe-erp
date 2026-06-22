from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('promotions', '0002_initial'),
        ('products', '0004_flavor_categories'),
    ]

    operations = [
        migrations.AddField(
            model_name='promotion',
            name='cup_size',
            field=models.ForeignKey(
                blank=True, null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='promotions',
                to='products.cupsize',
            ),
        ),
    ]
