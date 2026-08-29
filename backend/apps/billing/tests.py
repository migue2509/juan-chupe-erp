from decimal import Decimal

from django.test import TestCase
from rest_framework.test import APIClient

from apps.billing.models import Invoice
from apps.deliveries.models import Delivery
from apps.inventory.models import CupStock, FlavorBag, StockMovement
from apps.products.models import CupSize, Flavor
from apps.sales.models import Sale, SaleItem, SaleItemFlavor
from apps.shifts.models import Shift
from apps.users.models import User


class InvoiceInventoryRestoreTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.admin = User.objects.create_user(
            username='admin',
            password='pass',
            full_name='Admin',
            role='admin',
        )
        self.client.force_authenticate(self.admin)
        self.shift = Shift.objects.create(opened_by=self.admin)
        self.cup = CupSize.objects.create(
            size='12oz',
            ml=Decimal('360.00'),
            price=Decimal('7000'),
            min_quantity=0,
        )
        self.cup_stock = CupStock.objects.create(
            cup_size=self.cup,
            quantity=4,
            min_quantity=0,
        )
        self.flavor = Flavor.objects.create(
            name='Mango',
            category='refreshing',
        )
        self.bag = FlavorBag.objects.create(
            flavor=self.flavor,
            category='refreshing',
            stock_ml=Decimal('1000.00'),
            min_stock_ml=Decimal('0'),
        )

    def _sale_with_invoice(self, *, is_delivery=False):
        sale = Sale.objects.create(
            shift=self.shift,
            seller=self.admin,
            seller_name=self.admin.full_name,
            payment_method='cash',
            cash_received=Decimal('7000'),
            is_delivery=is_delivery,
        )
        sale_item = SaleItem.objects.create(
            sale=sale,
            cup_size=self.cup,
            unit_price=Decimal('7000'),
            topping_price=Decimal('0'),
            quantity=1,
        )
        SaleItemFlavor.objects.create(
            sale_item=sale_item,
            flavor=self.flavor,
            ml_consumed=Decimal('360.00'),
        )
        sale.calculate_total()
        invoice = Invoice.objects.create(sale=sale, shift=self.shift)
        delivery = None
        if is_delivery:
            delivery = Delivery.objects.create(
                sale=sale,
                shift=self.shift,
                address='Calle 1',
                latitude=Decimal('6.2500000'),
                longitude=Decimal('-75.5700000'),
            )
        return sale, invoice, delivery

    def test_void_invoice_restores_inventory(self):
        _, invoice, _ = self._sale_with_invoice()

        response = self.client.post(
            f'/api/billing/{invoice.pk}/void/',
            {'reason': 'Prueba'},
            format='json',
        )

        self.assertEqual(response.status_code, 200, response.data)
        invoice.refresh_from_db()
        self.cup_stock.refresh_from_db()
        self.bag.refresh_from_db()
        self.assertTrue(invoice.voided)
        self.assertEqual(self.cup_stock.quantity, 5)
        self.assertEqual(self.bag.stock_ml, Decimal('1360.00'))

    def test_cancel_delivery_does_not_restore_inventory_twice(self):
        _, invoice, delivery = self._sale_with_invoice(is_delivery=True)
        url = f'/api/deliveries/{delivery.pk}/cancel/'

        first = self.client.post(url, format='json')
        second = self.client.post(url, format='json')

        self.assertEqual(first.status_code, 200, first.data)
        self.assertEqual(second.status_code, 200, second.data)
        invoice.refresh_from_db()
        delivery.refresh_from_db()
        self.cup_stock.refresh_from_db()
        self.bag.refresh_from_db()
        self.assertTrue(invoice.voided)
        self.assertEqual(delivery.status, 'cancelled')
        self.assertEqual(self.cup_stock.quantity, 5)
        self.assertEqual(self.bag.stock_ml, Decimal('1360.00'))
        self.assertEqual(
            StockMovement.objects.filter(cup_stock=self.cup_stock, movement_type='adjustment').count(),
            1,
        )
