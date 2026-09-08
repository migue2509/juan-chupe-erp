from django.db import migrations, models
from django.db.models import Q


def dedupe_seller_cash_deliveries(apps, schema_editor):
    SellerCashDelivery = apps.get_model('cash', 'SellerCashDelivery')
    seen = set()
    queryset = SellerCashDelivery.objects.order_by(
        'shift_id',
        'seller_id',
        '-updated_at',
        '-created_at',
        '-id',
    )
    for delivery in queryset:
        key = (delivery.shift_id, delivery.seller_id)
        if key in seen:
            delivery.delete()
        else:
            seen.add(key)


class Migration(migrations.Migration):

    dependencies = [
        ('cash', '0008_cashaudit_nullify_extra_columns'),
    ]

    operations = [
        migrations.RunPython(dedupe_seller_cash_deliveries, migrations.RunPython.noop),
        migrations.AddConstraint(
            model_name='sellercashdelivery',
            constraint=models.UniqueConstraint(
                fields=('shift', 'seller_id'),
                condition=Q(seller_id__isnull=False),
                name='uniq_seller_cash_per_shift_seller',
            ),
        ),
        migrations.AddConstraint(
            model_name='sellercashdelivery',
            constraint=models.UniqueConstraint(
                fields=('shift',),
                condition=Q(seller_id__isnull=True),
                name='uniq_delivery_cash_per_shift',
            ),
        ),
    ]
