from decimal import Decimal

from django.test import TestCase
from rest_framework.test import APIClient

from apps.billing.models import Invoice
from apps.inventory.models import CupStock, FlavorBag, StockMovement, ToppingStock
from apps.products.models import CupSize, Flavor, Topping
from apps.promotions.models import Promotion
from apps.sales.models import Sale, SaleItem
from apps.shifts.models import Shift
from apps.users.models import User


class LoncheraInventoryTests(TestCase):
    def setUp(self):
        self.admin = User.objects.create_user(username='admin', full_name='Admin', role='admin')
        self.client = APIClient()
        self.client.force_authenticate(self.admin)
        self.shift = Shift.objects.create(opened_by=self.admin)
        self.cup = CupSize.objects.create(
            size='Nevera', ml=3000, price=65000,
            topping_category='refreshing', topping_bags_per_unit=3,
        )
        self.cups = CupStock.objects.create(cup_size=self.cup, quantity=10)
        self.flavor = Flavor.objects.create(name='Mango', category='refreshing')
        self.bag = FlavorBag.objects.create(flavor=self.flavor, category='refreshing', stock_ml=30000)
        self.topping = Topping.objects.create(name='Bolsa Refrescantes', linked_category='refreshing')
        self.stock = ToppingStock.objects.create(topping=self.topping, quantity=10)
        self.promo = Promotion.objects.create(
            name='Lonchera Chupe', category='didi', promo_price=65000,
            topping_category='refreshing', topping_bags_per_unit=3,
        )

    def sell(self, quantities=(1,), promotion=True):
        payload = {
            'seller_id': self.admin.pk, 'payment_method': 'cash',
            'cash_received': 65000 * sum(quantities),
            'items': [
                {'cup_size_id': self.cup.pk, 'flavor_ids': [self.flavor.pk],
                 'unit_price': 65000, 'quantity': qty}
                for qty in quantities
            ],
        }
        if promotion:
            payload['promotion_id'] = self.promo.pk
        return self.client.post('/api/sales/create-sale/', payload, format='json')

    def test_two_loncheras_consume_six_bags(self):
        response = self.sell((2,))
        self.assertEqual(response.status_code, 201, response.data)
        self.stock.refresh_from_db()
        self.assertEqual(self.stock.quantity, 4)
        self.assertEqual(SaleItem.objects.get().auto_topping_units, 6)
        movement = StockMovement.objects.get(topping_stock=self.stock, movement_type='sale')
        self.assertEqual(movement.quantity_units, 6)

    def test_lonchera_uses_refreshing_topping_even_with_creamy_flavor(self):
        self.flavor.category = 'creamy'
        self.flavor.save()
        response = self.sell()
        self.assertEqual(response.status_code, 201, response.data)
        self.stock.refresh_from_db()
        self.assertEqual(self.stock.quantity, 7)

    def test_insufficient_stock_rolls_back_entire_sale(self):
        self.stock.quantity = 4
        self.stock.save()
        response = self.sell((1, 1))
        self.assertEqual(response.status_code, 400, response.data)
        self.stock.refresh_from_db()
        self.cups.refresh_from_db()
        self.bag.refresh_from_db()
        self.assertEqual(self.stock.quantity, 4)
        self.assertEqual(self.cups.quantity, 10)
        self.assertEqual(self.bag.stock_ml, Decimal('30000'))
        self.assertFalse(Sale.objects.exists())
        self.assertFalse(Invoice.objects.exists())
        self.assertFalse(StockMovement.objects.exists())

    def test_void_restores_recorded_bags_after_recipe_changes(self):
        response = self.sell()
        self.assertEqual(response.status_code, 201, response.data)
        self.promo.topping_bags_per_unit = 5
        self.promo.save()
        invoice = Invoice.objects.get()
        response = self.client.post(f'/api/billing/{invoice.pk}/void/', {'reason': 'Prueba'}, format='json')
        self.assertEqual(response.status_code, 200, response.data)
        self.stock.refresh_from_db()
        self.assertEqual(self.stock.quantity, 10)
        self.assertEqual(StockMovement.objects.get(topping_stock=self.stock, movement_type='adjustment').quantity_units, 3)
        self.assertEqual(self.client.post(f'/api/billing/{invoice.pk}/void/').status_code, 400)
        self.stock.refresh_from_db()
        self.assertEqual(self.stock.quantity, 10)

    def test_regular_sale_still_consumes_one_bag(self):
        self.cup.size = '16oz'
        self.cup.topping_bags_per_unit = 0
        self.cup.topping_category = ''
        self.cup.save()
        response = self.sell(promotion=False)
        self.assertEqual(response.status_code, 201, response.data)
        self.stock.refresh_from_db()
        self.assertEqual(self.stock.quantity, 9)

    def test_individual_neveras_consume_six_bags_and_restore_on_void(self):
        response = self.sell((2,), promotion=False)
        self.assertEqual(response.status_code, 201, response.data)
        self.stock.refresh_from_db()
        self.assertEqual(self.stock.quantity, 4)
        self.assertEqual(SaleItem.objects.get().auto_topping_units, 6)
        self.cup.topping_bags_per_unit = 5
        self.cup.save()
        invoice = Invoice.objects.get()
        response = self.client.post(f'/api/billing/{invoice.pk}/void/', {'reason': 'Prueba'}, format='json')
        self.assertEqual(response.status_code, 200, response.data)
        self.stock.refresh_from_db()
        self.assertEqual(self.stock.quantity, 10)

    def test_individual_nevera_requires_three_refreshing_bags_with_creamy_flavor(self):
        self.flavor.category = 'creamy'
        self.flavor.save()
        self.stock.quantity = 2
        self.stock.save()
        response = self.sell(promotion=False)
        self.assertEqual(response.status_code, 400, response.data)
        self.assertFalse(Sale.objects.exists())
        self.stock.quantity = 3
        self.stock.save()
        response = self.sell(promotion=False)
        self.assertEqual(response.status_code, 201, response.data)
        self.stock.refresh_from_db()
        self.assertEqual(self.stock.quantity, 0)

    def test_missing_refreshing_topping_rejects_individual_nevera(self):
        self.topping.is_active = False
        self.topping.save()
        response = self.sell(promotion=False)
        self.assertEqual(response.status_code, 400, response.data)
        self.assertFalse(Sale.objects.exists())

    def test_missing_refreshing_topping_rejects_lonchera(self):
        self.topping.is_active = False
        self.topping.save()
        response = self.sell()
        self.assertEqual(response.status_code, 400, response.data)
        self.assertFalse(Sale.objects.exists())
