from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('inventory', '0004_stockmovement_purchase_amount'),
    ]

    operations = [
        migrations.AlterField(
            model_name='flavorbag',
            name='category',
            field=models.CharField(
                max_length=20,
                choices=[
                    ('creamy',       'Cremoso'),
                    ('refreshing',   'Refrescante'),
                    ('non_alcoholic','Sin Alcohol'),
                ],
            ),
        ),
    ]
