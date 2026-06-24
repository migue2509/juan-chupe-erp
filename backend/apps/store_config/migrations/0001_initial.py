from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = []

    operations = [
        migrations.CreateModel(
            name='TransferMethod',
            fields=[
                ('id',             models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('provider',       models.CharField(choices=[('bancolombia', 'Bancolombia'), ('nequi', 'Nequi'), ('daviplata', 'Daviplata'), ('other', 'Otro')], max_length=20)),
                ('display_name',   models.CharField(help_text='Nombre que verá el cliente', max_length=100)),
                ('account_number', models.CharField(blank=True, help_text='Número de cuenta o celular', max_length=100)),
                ('qr_image',       models.ImageField(blank=True, null=True, upload_to='transfer_qr/')),
                ('is_active',      models.BooleanField(default=True)),
                ('order',          models.PositiveIntegerField(default=0, help_text='Orden de aparición')),
            ],
            options={
                'verbose_name':        'Método de transferencia',
                'verbose_name_plural': 'Métodos de transferencia',
                'ordering':            ['order', 'provider'],
            },
        ),
    ]
