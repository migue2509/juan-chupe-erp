from django.db import migrations


def configure_lonchera(apps, schema_editor):
    Promotion = apps.get_model('promotions', 'Promotion')
    Promotion.objects.using(schema_editor.connection.alias).filter(
        name__iexact='Lonchera Chupe',
    ).update(topping_category='refreshing', topping_bags_per_unit=3)


def remove_lonchera_recipe(apps, schema_editor):
    Promotion = apps.get_model('promotions', 'Promotion')
    Promotion.objects.using(schema_editor.connection.alias).filter(
        name__iexact='Lonchera Chupe', topping_category='refreshing', topping_bags_per_unit=3,
    ).update(topping_category='', topping_bags_per_unit=0)


class Migration(migrations.Migration):
    dependencies = [('promotions', '0006_promotion_topping_bags_per_unit_and_more')]
    operations = [migrations.RunPython(configure_lonchera, remove_lonchera_recipe)]
