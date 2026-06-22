from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('products', '0003_timestamps_and_minimums'),
    ]

    operations = [
        migrations.AlterField(
            model_name='flavor',
            name='category',
            field=models.CharField(
                max_length=20,
                choices=[
                    ('creamy',       'Cremoso'),
                    ('refreshing',   'Refrescante'),
                    ('non_alcoholic','Sin Alcohol'),
                ],
                default='creamy',
            ),
        ),
    ]
