from decimal import Decimal

from django.test import TestCase
from rest_framework.test import APIClient

from apps.cash.models import CashAudit
from apps.expenses.models import Expense
from apps.shifts.models import Shift
from apps.users.models import User


class CashAuditSaveTests(TestCase):
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

    def _payload(self, *, actual_cash, closing_stock):
        return {
            'shift': self.shift.pk,
            'channel': 'pos',
            'expected_cash': 10000,
            'expected_transfer': 0,
            'actual_cash': actual_cash,
            'actual_transfer': 0,
            'items': [
                {
                    'product_name': 'Vaso 12oz',
                    'product_type': 'cup',
                    'product_id': 1,
                    'unit_price': 7000,
                    'opening_stock': 10,
                    'entries': 2,
                    'closing_stock': closing_stock,
                }
            ],
        }

    def test_post_existing_cash_audit_updates_record_and_replaces_items(self):
        first = self.client.post(
            '/api/cash/',
            self._payload(actual_cash=9000, closing_stock=6),
            format='json',
        )
        second = self.client.post(
            '/api/cash/',
            self._payload(actual_cash=11000, closing_stock=4),
            format='json',
        )

        self.assertEqual(first.status_code, 201, first.data)
        self.assertEqual(second.status_code, 201, second.data)
        self.assertEqual(CashAudit.objects.count(), 1)
        audit = CashAudit.objects.get()
        self.assertEqual(audit.actual_cash, Decimal('11000'))
        self.assertEqual(audit.cash_difference, Decimal('1000'))
        self.assertEqual(audit.items.count(), 1)
        self.assertEqual(audit.items.first().closing_stock, 4)

    def test_patch_cash_audit_recalculates_difference(self):
        Expense.objects.create(
            shift=self.shift,
            registered_by=self.admin,
            category='business',
            origin='pos',
            description='Hielo',
            amount=Decimal('2000'),
            from_daily_cash=True,
            payment_method='cash',
        )
        audit = CashAudit.objects.create(
            shift=self.shift,
            channel='pos',
            audited_by=self.admin,
            expected_cash=Decimal('10000'),
            expected_transfer=Decimal('0'),
            actual_cash=Decimal('8000'),
            actual_transfer=Decimal('0'),
            cash_difference=Decimal('999'),
        )

        response = self.client.patch(
            f'/api/cash/{audit.pk}/',
            {'actual_cash': 9000},
            format='json',
        )

        self.assertEqual(response.status_code, 200, response.data)
        audit.refresh_from_db()
        self.assertEqual(audit.cash_difference, Decimal('1000'))
