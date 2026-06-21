from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('products', '0001_initial'),
    ]

    operations = [
        migrations.AlterField(
            model_name='cupsize',
            name='size',
            field=models.CharField(
                max_length=20,
                unique=True,
                help_text='Nombre libre, ej: 8oz, Grande, XL',
            ),
        ),
    ]
