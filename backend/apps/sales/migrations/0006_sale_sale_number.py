from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('sales', '0005_sale_is_courtesy'),
    ]

    operations = [
        migrations.AddField(
            model_name='sale',
            name='sale_number',
            field=models.PositiveIntegerField(blank=True, editable=False, null=True, unique=True),
        ),
    ]
