from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('expenses', '0004_expense_shift_nullable'),
    ]

    operations = [
        migrations.AddField(
            model_name='expense',
            name='origin',
            field=models.CharField(
                max_length=10,
                choices=[('pos', 'Punto de Venta'), ('delivery', 'Domicilios')],
                default='pos',
                help_text='¿Este gasto es del punto de venta o de domicilios?',
            ),
        ),
    ]
