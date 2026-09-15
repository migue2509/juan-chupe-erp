from django.test import TestCase
from rest_framework.test import APIClient

from apps.expenses.models import Expense
from apps.shifts.models import Shift
from apps.users.models import User


class ExpenseValidationTests(TestCase):
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

    def test_create_expense_rejects_negative_amount(self):
        response = self.client.post(
            '/api/expenses/',
            {
                'category': 'business',
                'origin': 'pos',
                'description': 'Ajuste invalido',
                'amount': '-1000',
                'from_daily_cash': True,
                'payment_method': 'cash',
            },
            format='json',
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn('amount', response.data)
        self.assertEqual(Expense.objects.count(), 0)
