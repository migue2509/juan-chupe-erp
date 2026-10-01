from django.db import migrations


def configure_nevera(apps, schema_editor):
    CupSize = apps.get_model('products', 'CupSize')
    CupSize.objects.using(schema_editor.connection.alias).filter(size__iexact='Nevera').update(
        topping_category='refreshing', topping_bags_per_unit=3,
    )


def remove_nevera_recipe(apps, schema_editor):
    CupSize = apps.get_model('products', 'CupSize')
    CupSize.objects.using(schema_editor.connection.alias).filter(
        size__iexact='Nevera', topping_category='refreshing', topping_bags_per_unit=3,
    ).update(topping_category='', topping_bags_per_unit=0)


class Migration(migrations.Migration):
    dependencies = [('products', '0008_cupsize_topping_bags_per_unit_and_more')]
    operations = [migrations.RunPython(configure_nevera, remove_nevera_recipe)]
