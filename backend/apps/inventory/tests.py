from decimal import Decimal

from django.test import TestCase
from rest_framework.test import APIClient

from apps.inventory.models import CupStock, FlavorBag, ToppingStock
from apps.products.models import CupSize, Flavor, Topping
from apps.users.models import User


class StockMutationTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.admin = User.objects.create_user(
            username='admin',
            password='pass',
            full_name='Admin',
            role='admin',
        )
        self.client.force_authenticate(self.admin)
        self.flavor = Flavor.objects.create(name='Mango', category='refreshing')
        self.bag = FlavorBag.objects.create(
            flavor=self.flavor,
            category='refreshing',
            stock_ml=Decimal('1000.00'),
            min_stock_ml=Decimal('0'),
        )
        self.cup = CupSize.objects.create(
            size='12oz',
            ml=Decimal('360.00'),
            price=Decimal('7000'),
            min_quantity=0,
        )
        self.cup_stock = CupStock.objects.create(
            cup_size=self.cup,
            quantity=2,
            min_quantity=0,
        )
        self.topping = Topping.objects.create(name='Gomitas', price=Decimal('2000'))
        self.topping_stock = ToppingStock.objects.create(
            topping=self.topping,
            quantity=4,
            min_quantity=0,
        )

    def test_add_stock_uses_current_database_value(self):
        stale_cup_stock = CupStock.objects.get(pk=self.cup_stock.pk)
        CupStock.objects.filter(pk=self.cup_stock.pk).update(quantity=5)

        stale_cup_stock.add_stock(3)

        self.cup_stock.refresh_from_db()
        self.assertEqual(self.cup_stock.quantity, 8)

    def test_consume_uses_current_database_value(self):
        stale_bag = FlavorBag.objects.get(pk=self.bag.pk)
        FlavorBag.objects.filter(pk=self.bag.pk).update(stock_ml=Decimal('500.00'))

        stale_bag.consume(Decimal('125.00'))

        self.bag.refresh_from_db()
        self.assertEqual(self.bag.stock_ml, Decimal('375.00'))

    def test_consume_insufficient_stock_does_not_go_negative(self):
        with self.assertRaises(ValueError):
            self.topping_stock.consume(5)

        self.topping_stock.refresh_from_db()
        self.assertEqual(self.topping_stock.quantity, 4)

    def test_negative_manual_adjustment_reuses_stock_validation(self):
        response = self.client.post(
            f'/api/inventory/cups/{self.cup_stock.pk}/adjust/',
            {'delta': -3, 'notes': 'Conteo fisico'},
            format='json',
        )

        self.assertEqual(response.status_code, 400, response.data)
        self.cup_stock.refresh_from_db()
        self.assertEqual(self.cup_stock.quantity, 2)
