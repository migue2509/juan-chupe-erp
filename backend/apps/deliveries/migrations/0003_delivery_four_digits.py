from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('deliveries', '0002_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='delivery',
            name='four_digits',
            field=models.CharField(max_length=4, blank=True, default='', help_text='Últimos 4 dígitos del cliente'),
        ),
    ]
