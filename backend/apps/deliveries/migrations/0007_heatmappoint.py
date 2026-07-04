from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('deliveries', '0006_delivery_coordinates'),
    ]

    operations = [
        migrations.CreateModel(
            name='HeatmapPoint',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('address', models.CharField(max_length=300)),
                ('latitude', models.DecimalField(decimal_places=7, max_digits=10)),
                ('longitude', models.DecimalField(decimal_places=7, max_digits=10)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
            ],
            options={
                'verbose_name': 'Punto de calor histórico',
                'verbose_name_plural': 'Puntos de calor históricos',
            },
        ),
    ]
