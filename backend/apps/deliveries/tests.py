from django.test import TestCase
from rest_framework.test import APIClient

from apps.billing.models import Invoice
from apps.deliveries.models import Delivery
from apps.sales.models import Sale
from apps.shifts.models import Shift
from apps.users.models import User


class DeliveryStatusTransitionTests(TestCase):
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
        self.sale = Sale.objects.create(
            shift=self.shift,
            seller=self.admin,
            seller_name=self.admin.full_name,
            payment_method='cash',
        )
        self.invoice = Invoice.objects.create(sale=self.sale, shift=self.shift)

    def test_cancelled_delivery_cannot_be_reactivated(self):
        delivery = Delivery.objects.create(
            sale=self.sale,
            shift=self.shift,
            address='Calle 1',
            status='cancelled',
        )

        response = self.client.patch(
            f'/api/deliveries/{delivery.pk}/',
            {'status': 'pending'},
            format='json',
        )

        self.assertEqual(response.status_code, 400)
        delivery.refresh_from_db()
        self.assertEqual(delivery.status, 'cancelled')

    def test_delivered_status_sets_delivered_at_when_missing(self):
        delivery = Delivery.objects.create(
            sale=self.sale,
            shift=self.shift,
            address='Calle 1',
            status='pending',
        )

        response = self.client.patch(
            f'/api/deliveries/{delivery.pk}/',
            {'status': 'delivered'},
            format='json',
        )

        self.assertEqual(response.status_code, 200, response.data)
        delivery.refresh_from_db()
        self.assertEqual(delivery.status, 'delivered')
        self.assertIsNotNone(delivery.delivered_at)
