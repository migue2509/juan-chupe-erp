from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('deliveries', '0003_delivery_four_digits'),
    ]

    operations = [
        # Crear tabla Domiciliario
        migrations.CreateModel(
            name='Domiciliario',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=100)),
                ('is_active', models.BooleanField(default=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
            ],
            options={
                'verbose_name': 'Domiciliario',
                'verbose_name_plural': 'Domiciliarios',
                'ordering': ['name'],
            },
        ),
        # Quitar FK anterior (a User)
        migrations.RemoveField(
            model_name='delivery',
            name='delivery_person',
        ),
        # Agregar FK nueva (a Domiciliario)
        migrations.AddField(
            model_name='delivery',
            name='delivery_person',
            field=models.ForeignKey(
                blank=True, null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='deliveries',
                to='deliveries.domiciliario',
            ),
        ),
    ]
