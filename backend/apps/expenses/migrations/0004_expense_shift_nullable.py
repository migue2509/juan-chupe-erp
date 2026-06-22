import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('expenses', '0003_add_supply_category'),
        ('shifts', '0001_initial'),
    ]

    operations = [
        migrations.AlterField(
            model_name='expense',
            name='shift',
            field=models.ForeignKey(
                blank=True, null=True,
                on_delete=django.db.models.deletion.PROTECT,
                related_name='expenses',
                to='shifts.shift',
            ),
        ),
    ]
