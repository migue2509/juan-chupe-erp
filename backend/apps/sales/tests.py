from decimal import Decimal

from django.test import TestCase
from rest_framework.test import APIClient

from apps.billing.models import Invoice
from apps.deliveries.models import Delivery
from apps.inventory.models import CupStock, FlavorBag
from apps.products.models import CupSize, Flavor
from apps.sales.models import Sale, SaleItem, SaleItemFlavor
from apps.shifts.models import Shift
from apps.users.models import User


class SaleDeliveryEditTests(TestCase):
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
        self.flavor = Flavor.objects.create(name='Mango', category='refreshing')
        self.cup_stock = CupStock.objects.create(cup_size=self.cup, quantity=10, min_quantity=0)
        self.flavor_bag = FlavorBag.objects.create(
            flavor=self.flavor,
            category=self.flavor.category,
            stock_ml=Decimal('5000.00'),
            min_stock_ml=Decimal('0'),
        )

    def _sale(self, *, is_delivery=False):
        sale = Sale.objects.create(
            shift=self.shift,
            seller=self.admin,
            seller_name=self.admin.full_name,
            payment_method='cash',
            cash_received=Decimal('7000'),
            is_delivery=is_delivery,
        )
        item = SaleItem.objects.create(
            sale=sale,
            cup_size=self.cup,
            unit_price=self.cup.price,
            topping_price=Decimal('0'),
            quantity=1,
        )
        SaleItemFlavor.objects.create(
            sale_item=item,
            flavor=self.flavor,
            ml_consumed=self.cup.ml,
        )
        sale.calculate_total()
        Invoice.objects.create(sale=sale, shift=self.shift)
        return sale

    def test_edit_sale_to_delivery_creates_delivery_record(self):
        sale = self._sale()

        response = self.client.patch(
            f'/api/sales/{sale.pk}/edit/',
            {
                'is_delivery': True,
                'delivery_address': 'Calle 10 #20-30',
                'delivery_client': '1234',
                'delivery_notes': 'Porteria',
                'delivery_lat': 6.25,
                'delivery_lng': -75.57,
            },
            format='json',
        )

        self.assertEqual(response.status_code, 200, response.data)
        sale.refresh_from_db()
        delivery = Delivery.objects.get(sale=sale)
        self.assertTrue(sale.is_delivery)
        self.assertEqual(delivery.address, 'Calle 10 #20-30')
        self.assertEqual(delivery.four_digits, '1234')
        self.assertEqual(delivery.notes, 'Porteria')
        self.assertEqual(response.data['delivery_address'], 'Calle 10 #20-30')
        self.assertEqual(response.data['delivery_client'], '1234')

    def test_edit_sale_to_pos_removes_delivery_record(self):
        sale = self._sale(is_delivery=True)
        Delivery.objects.create(
            sale=sale,
            shift=self.shift,
            address='Calle 1',
            status='pending',
        )

        response = self.client.patch(
            f'/api/sales/{sale.pk}/edit/',
            {'is_delivery': False},
            format='json',
        )

        self.assertEqual(response.status_code, 200, response.data)
        sale.refresh_from_db()
        self.assertFalse(sale.is_delivery)
        self.assertFalse(Delivery.objects.filter(sale=sale).exists())
        self.assertIsNone(response.data['delivery_status'])

    def test_create_sale_rejects_invalid_seller_id(self):
        response = self.client.post(
            '/api/sales/create-sale/',
            {
                'seller_id': 999999,
                'payment_method': 'cash',
                'cash_received': '7000',
                'items': [
                    {
                        'cup_size_id': self.cup.pk,
                        'flavor_ids': [self.flavor.pk],
                        'unit_price': '7000',
                        'quantity': 1,
                    }
                ],
            },
            format='json',
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn('seller_id', response.data)
        self.assertEqual(Sale.objects.count(), 0)

    def test_edit_sale_rejects_invalid_seller_id(self):
        sale = self._sale()

        response = self.client.patch(
            f'/api/sales/{sale.pk}/edit/',
            {'seller_id': 999999},
            format='json',
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn('seller_id', response.data)
        sale.refresh_from_db()
        self.assertEqual(sale.seller, self.admin)

    def test_edit_sale_updates_seller_snapshot(self):
        seller = User.objects.create_user(
            username='seller',
            password='pass',
            full_name='Nueva Vendedora',
            role='operative',
        )
        sale = self._sale()

        response = self.client.patch(
            f'/api/sales/{sale.pk}/edit/',
            {'seller_id': seller.pk},
            format='json',
        )

        self.assertEqual(response.status_code, 200, response.data)
        sale.refresh_from_db()
        self.assertEqual(sale.seller, seller)
        self.assertEqual(sale.seller_name, 'Nueva Vendedora')

    def test_edit_sale_rejects_invalid_promotion_id(self):
        sale = self._sale()

        response = self.client.patch(
            f'/api/sales/{sale.pk}/edit/',
            {'promotion_id': 999999},
            format='json',
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn('promotion_id', response.data)

    def test_edit_sale_rejects_voided_invoice(self):
        sale = self._sale()
        sale.invoice.voided = True
        sale.invoice.save(update_fields=['voided'])

        response = self.client.patch(
            f'/api/sales/{sale.pk}/edit/',
            {'notes': 'No deberia cambiar'},
            format='json',
        )

        self.assertEqual(response.status_code, 400)
        sale.refresh_from_db()
        self.assertEqual(sale.notes, '')
