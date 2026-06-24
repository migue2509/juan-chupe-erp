from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('expenses', '0005_expense_origin'),
    ]

    operations = [
        migrations.AddField(
            model_name='expense',
            name='payment_method',
            field=models.CharField(
                choices=[('cash', 'Efectivo'), ('transfer', 'Transferencia')],
                default='cash',
                help_text='Medio de pago del gasto (efectivo o transferencia)',
                max_length=10,
            ),
        ),
    ]
