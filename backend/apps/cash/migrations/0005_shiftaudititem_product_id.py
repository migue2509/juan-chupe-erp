from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('cash', '0004_cashaudit_channel'),
    ]

    operations = [
        migrations.AddField(
            model_name='shiftaudititem',
            name='product_id',
            field=models.PositiveIntegerField(
                blank=True, null=True,
                help_text='ID real del CupSize/Topping — para matching por ID sin depender del nombre'
            ),
        ),
    ]
