"""
Script de datos iniciales para Juan Chupe ERP
Ejecutar: python manage.py shell < scripts/seed_data.py
"""
import django
import os
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')

from apps.users.models import User
from apps.products.models import Flavor, CupSize, Topping
from apps.inventory.models import FlavorBag, CupStock

# Usuarios iniciales
print("Creando usuarios...")
if not User.objects.filter(username='juanchupe').exists():
    User.objects.create_superuser('juanchupe', 'admin123', full_name='Juan Chupe Admin', role='admin')
    print("  ✅ Admin: juanchupe / admin123")

for name, username in [('Mafe Agudelo', 'mafe'), ('Sofía Mejia', 'sofia'), ('Catalina Salgado', 'catalina')]:
    if not User.objects.filter(username=username).exists():
        User.objects.create_user(username, 'vendedora123', full_name=name, role='operative')
        print(f"  ✅ Vendedora: {username} / vendedora123")

# Tamaños de vaso
print("\nCreando tamaños de vaso...")
CupSize.objects.get_or_create(size='8oz', defaults={'price': 5000, 'ml': 236.59})
CupSize.objects.get_or_create(size='12oz', defaults={'price': 7000, 'ml': 354.88})
CupSize.objects.get_or_create(size='16oz', defaults={'price': 9000, 'ml': 473.18})
CupSize.objects.get_or_create(size='24oz', defaults={'price': 13000, 'ml': 709.76})
print("  ✅ Tamaños creados")

# Toppings
Topping.objects.get_or_create(name='Paquete de Dulces')
print("  ✅ Topping creado")

# Sabores con sus bolsas
print("\nCreando sabores e inventario...")
FLAVORS = [
    ('Smirnoff', 'refreshing', '🍸', '#00B4FF'),
    ('Manzana Verde', 'refreshing', '🍏', '#4CD964'),
    ('Uva', 'refreshing', '🍇', '#8B2FC9'),
    ('Tussi', 'refreshing', '🩷', '#FF69B4'),
    ('Mango Tequila', 'refreshing', '🥭', '#FF8C00'),
    ('Lulo', 'refreshing', '🍏', '#9DC435'),
    ('Fresa', 'creamy', '🍓', '#FF3366'),
    ('Maracuyá', 'creamy', '🍊', '#FF9500'),
    ('Limón', 'water', '🍋', '#AAFF00'),
    ('Mora', 'water', '🫐', '#7B2FFF'),
]

for name, cat, emoji, color in FLAVORS:
    flavor, created = Flavor.objects.get_or_create(
        name=name,
        defaults={'category': cat, 'emoji': emoji, 'color': color}
    )
    bag_cat = 'refreshing' if cat == 'refreshing' else 'creamy' if cat == 'creamy' else 'water'
    FlavorBag.objects.get_or_create(
        flavor=flavor,
        defaults={'category': bag_cat, 'stock_ml': 5000, 'min_stock_ml': 500}
    )
    if created:
        print(f"  ✅ {emoji} {name}")

# Cup stocks
for cup in CupSize.objects.all():
    CupStock.objects.get_or_create(cup_size=cup, defaults={'quantity': 100, 'min_quantity': 10})

print("\n🎉 Datos iniciales creados exitosamente!")
print("\nCredenciales:")
print("  Admin:     juanchupe / admin123")
print("  Vendedora: mafe / vendedora123")
