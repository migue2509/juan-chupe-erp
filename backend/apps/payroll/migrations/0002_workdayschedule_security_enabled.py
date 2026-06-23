from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('payroll', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='workdayschedule',
            name='security_enabled',
            field=models.BooleanField(default=False),
        ),
    ]
