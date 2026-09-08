from decimal import Decimal

from django.test import TestCase
from rest_framework.test import APIClient

from apps.attendance.models import AttendanceRecord
from apps.billing.models import Invoice
from apps.cash.models import CashAudit
from apps.deliveries.models import Delivery
from apps.sales.models import Sale
from apps.shifts.models import Shift
from apps.shifts.serializers import ShiftSerializer
from apps.users.models import User


class ShiftLifecycleTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.admin = User.objects.create_user(
            username='admin',
            password='pass',
            full_name='Admin',
            role='admin',
        )
        self.client.force_authenticate(self.admin)

    def _create_audit(self, shift, channel='pos'):
        return CashAudit.objects.create(
            shift=shift,
            channel=channel,
            audited_by=self.admin,
            expected_cash=Decimal('0'),
            expected_transfer=Decimal('0'),
            actual_cash=Decimal('0'),
            actual_transfer=Decimal('0'),
        )

    def _create_delivery_sale(self, shift, status='pending'):
        sale = Sale.objects.create(
            shift=shift,
            seller=self.admin,
            seller_name=self.admin.full_name,
            payment_method='cash',
            cash_received=Decimal('7000'),
            total=Decimal('7000'),
            is_delivery=True,
        )
        Invoice.objects.create(sale=sale, shift=shift)
        Delivery.objects.create(
            sale=sale,
            shift=shift,
            address='Calle 1',
            status=status,
        )
        return sale

    def test_open_shift_does_not_create_duplicate_when_active_exists(self):
        active = Shift.objects.create(opened_by=self.admin)

        response = self.client.post('/api/shifts/open/', format='json')

        self.assertEqual(response.status_code, 400, response.data)
        self.assertEqual(Shift.objects.filter(status='open').count(), 1)
        self.assertEqual(response.data['shift']['id'], active.pk)

    def test_close_shift_closes_open_attendance_records(self):
        employee = User.objects.create_user(
            username='employee',
            password='pass',
            full_name='Employee',
            role='operative',
        )
        shift = Shift.objects.create(opened_by=self.admin)
        attendance = AttendanceRecord.objects.create(user=employee, shift=shift)
        self._create_audit(shift)

        response = self.client.post('/api/shifts/close/', format='json')

        self.assertEqual(response.status_code, 200, response.data)
        shift.refresh_from_db()
        attendance.refresh_from_db()
        self.assertEqual(shift.status, 'closed')
        self.assertEqual(shift.closed_by, self.admin)
        self.assertIsNotNone(attendance.check_out)

    def test_close_shift_requires_pos_audit(self):
        shift = Shift.objects.create(opened_by=self.admin)

        response = self.client.post('/api/shifts/close/', format='json')

        self.assertEqual(response.status_code, 400, response.data)
        self.assertEqual(response.data['missing_audits'], ['pos'])
        shift.refresh_from_db()
        self.assertEqual(shift.status, 'open')

    def test_close_shift_requires_delivery_audit_when_delivery_sales_exist(self):
        shift = Shift.objects.create(opened_by=self.admin)
        self._create_audit(shift, 'pos')
        self._create_delivery_sale(shift)

        response = self.client.post('/api/shifts/close/', format='json')

        self.assertEqual(response.status_code, 400, response.data)
        self.assertEqual(response.data['missing_audits'], ['delivery'])
        shift.refresh_from_db()
        self.assertEqual(shift.status, 'open')

        self._create_audit(shift, 'delivery')
        response = self.client.post('/api/shifts/close/', format='json')

        self.assertEqual(response.status_code, 200, response.data)
        shift.refresh_from_db()
        self.assertEqual(shift.status, 'closed')

    def test_close_shift_ignores_cancelled_delivery_sales_for_audit_requirement(self):
        shift = Shift.objects.create(opened_by=self.admin)
        self._create_audit(shift, 'pos')
        self._create_delivery_sale(shift, status='cancelled')

        response = self.client.post('/api/shifts/close/', format='json')

        self.assertEqual(response.status_code, 200, response.data)
        shift.refresh_from_db()
        self.assertEqual(shift.status, 'closed')

    def test_has_audit_requires_all_close_audits(self):
        shift = Shift.objects.create(opened_by=self.admin)

        data = ShiftSerializer(shift).data
        self.assertFalse(data['has_audit'])
        self.assertFalse(data['has_pos_audit'])
        self.assertFalse(data['requires_delivery_audit'])
        self.assertEqual(data['missing_audits'], ['pos'])

        self._create_audit(shift, 'pos')
        data = ShiftSerializer(shift).data
        self.assertTrue(data['has_audit'])
        self.assertTrue(data['has_pos_audit'])
        self.assertFalse(data['requires_delivery_audit'])
        self.assertEqual(data['missing_audits'], [])

        self._create_delivery_sale(shift)
        data = ShiftSerializer(shift).data
        self.assertFalse(data['has_audit'])
        self.assertTrue(data['requires_delivery_audit'])
        self.assertFalse(data['has_delivery_audit'])
        self.assertEqual(data['missing_audits'], ['delivery'])

        self._create_audit(shift, 'delivery')
        data = ShiftSerializer(shift).data
        self.assertTrue(data['has_audit'])
        self.assertTrue(data['has_delivery_audit'])
        self.assertEqual(data['missing_audits'], [])
