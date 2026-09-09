from decimal import Decimal

from django.test import TestCase
from rest_framework.test import APIClient

from apps.billing.models import Invoice
from apps.cash.models import CashAudit, SellerCashDelivery, ShiftAuditItem
from apps.expenses.models import Expense
from apps.inventory.models import CupStock
from apps.products.models import CupSize
from apps.sales.models import Sale
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

    def test_cash_audit_rejects_negative_inventory_counts(self):
        payload = self._payload(actual_cash=10000, closing_stock=-1)

        response = self.client.post('/api/cash/', payload, format='json')

        self.assertEqual(response.status_code, 400, response.data)
        self.assertEqual(CashAudit.objects.count(), 0)

    def test_invalid_audit_update_keeps_existing_items(self):
        audit = CashAudit.objects.create(
            shift=self.shift,
            channel='pos',
            audited_by=self.admin,
            expected_cash=Decimal('10000'),
            expected_transfer=Decimal('0'),
            actual_cash=Decimal('10000'),
            actual_transfer=Decimal('0'),
        )
        ShiftAuditItem.objects.create(
            audit=audit,
            product_name='Vaso 12oz',
            product_type='cup',
            product_id=1,
            unit_price=Decimal('7000'),
            opening_stock=10,
            entries=2,
            closing_stock=6,
        )
        payload = self._payload(actual_cash=9000, closing_stock=4)
        payload['items'][0]['entries'] = -5

        response = self.client.post('/api/cash/', payload, format='json')

        self.assertEqual(response.status_code, 400, response.data)
        audit.refresh_from_db()
        self.assertEqual(audit.items.count(), 1)
        item = audit.items.first()
        self.assertEqual(item.entries, 2)
        self.assertEqual(item.closing_stock, 6)

    def test_post_cash_audit_compares_net_actual_against_gross_cash_less_expenses(self):
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
        SellerCashDelivery.objects.create(
            shift=self.shift,
            seller_id=self.admin.pk,
            seller_name=self.admin.full_name,
            net_delivered=Decimal('8000'),
        )

        response = self.client.post(
            '/api/cash/',
            self._payload(actual_cash=8000, closing_stock=6),
            format='json',
        )

        self.assertEqual(response.status_code, 201, response.data)
        audit = CashAudit.objects.get()
        self.assertEqual(audit.expected_cash, Decimal('10000'))
        self.assertEqual(audit.actual_cash, Decimal('8000'))
        self.assertEqual(audit.cash_difference, Decimal('0'))

    def test_prefill_preserves_saved_inventory_snapshot_for_existing_audit(self):
        cup = CupSize.objects.create(
            size='12oz',
            ml=Decimal('360.00'),
            price=Decimal('7000'),
            min_quantity=0,
            is_active=False,
        )
        CupStock.objects.create(cup_size=cup, quantity=99, min_quantity=0)
        audit = CashAudit.objects.create(
            shift=self.shift,
            channel='pos',
            audited_by=self.admin,
            expected_cash=Decimal('0'),
            expected_transfer=Decimal('0'),
            actual_cash=Decimal('0'),
            actual_transfer=Decimal('0'),
        )
        ShiftAuditItem.objects.create(
            audit=audit,
            product_name='Vaso 12oz',
            product_type='cup',
            product_id=cup.pk,
            unit_price=Decimal('7000'),
            opening_stock=10,
            entries=3,
            closing_stock=4,
        )

        response = self.client.get(f'/api/cash/prefill/?shift_id={self.shift.pk}')

        self.assertEqual(response.status_code, 200, response.data)
        row = next(
            (
                item for item in response.data['catalog']
                if item['product_type'] == 'cup' and item['product_id'] == cup.pk
            ),
            None,
        )
        self.assertIsNotNone(row)
        self.assertEqual(row['prev_closing'], 10)
        self.assertEqual(row['entries'], 3)
        self.assertEqual(row['closing_stock'], 4)

    def test_prefill_includes_saved_audit_items_without_product_id(self):
        audit = CashAudit.objects.create(
            shift=self.shift,
            channel='pos',
            audited_by=self.admin,
            expected_cash=Decimal('0'),
            expected_transfer=Decimal('0'),
            actual_cash=Decimal('0'),
            actual_transfer=Decimal('0'),
        )
        ShiftAuditItem.objects.create(
            audit=audit,
            product_name='Vaso antiguo',
            product_type='cup',
            unit_price=Decimal('5000'),
            opening_stock=8,
            entries=2,
            closing_stock=3,
        )

        response = self.client.get(f'/api/cash/prefill/?shift_id={self.shift.pk}')

        self.assertEqual(response.status_code, 200, response.data)
        row = next(
            (
                item for item in response.data['catalog']
                if item['product_type'] == 'cup' and item['product_name'] == 'Vaso antiguo'
            ),
            None,
        )
        self.assertIsNotNone(row)
        self.assertIsNone(row['product_id'])
        self.assertEqual(row['prev_closing'], 8)
        self.assertEqual(row['entries'], 2)
        self.assertEqual(row['closing_stock'], 3)

    def test_prefill_includes_pos_cash_expense_responsible_without_sales(self):
        Expense.objects.create(
            shift=self.shift,
            registered_by=self.admin,
            category='business',
            origin='pos',
            description='Hielo',
            amount=Decimal('3000'),
            from_daily_cash=True,
            payment_method='cash',
        )

        response = self.client.get(f'/api/cash/prefill/?shift_id={self.shift.pk}')

        self.assertEqual(response.status_code, 200, response.data)
        seller = next(
            item for item in response.data['sellers_breakdown']
            if item['seller_id'] == self.admin.pk
        )
        self.assertEqual(seller['seller_name'], self.admin.full_name)
        self.assertEqual(seller['pos_cash'], 0)
        self.assertEqual(seller['pos_transfer'], 0)
        self.assertEqual(seller['expenses_cash'], 3000)
        self.assertIsNone(seller['net_delivered'])

    def test_prefill_reports_unassigned_pos_sales_separately_from_delivery_cash(self):
        sale = Sale.objects.create(
            shift=self.shift,
            payment_method='cash',
            cash_received=Decimal('9000'),
            total=Decimal('9000'),
        )
        Invoice.objects.create(sale=sale, shift=self.shift)
        SellerCashDelivery.objects.create(
            shift=self.shift,
            seller_id=None,
            seller_name='Domicilios',
            net_delivered=Decimal('5000'),
        )
        Expense.objects.create(
            shift=self.shift,
            registered_by=None,
            category='business',
            origin='pos',
            description='Gasto sin responsable',
            amount=Decimal('2000'),
            from_daily_cash=True,
            payment_method='cash',
        )

        response = self.client.get(f'/api/cash/prefill/?shift_id={self.shift.pk}')

        self.assertEqual(response.status_code, 200, response.data)
        self.assertFalse(
            any(item['seller_id'] is None for item in response.data['sellers_breakdown'])
        )
        self.assertEqual(response.data['delivery_net_delivered'], 5000)
        self.assertEqual(response.data['unassigned_pos']['sales_count'], 1)
        self.assertEqual(response.data['unassigned_pos']['cash'], 9000)
        self.assertEqual(response.data['unassigned_pos']['transfer'], 0)
        self.assertEqual(response.data['unassigned_pos']['total'], 9000)
        self.assertEqual(response.data['unassigned_pos']['expenses_cash'], 2000)

    def test_pos_cash_audit_rejects_unassigned_pos_sales(self):
        sale = Sale.objects.create(
            shift=self.shift,
            payment_method='cash',
            cash_received=Decimal('9000'),
            total=Decimal('9000'),
        )
        Invoice.objects.create(sale=sale, shift=self.shift)

        response = self.client.post(
            '/api/cash/',
            self._payload(actual_cash=9000, closing_stock=6),
            format='json',
        )

        self.assertEqual(response.status_code, 400, response.data)
        self.assertIn('sin responsable', str(response.data))
        self.assertEqual(CashAudit.objects.count(), 0)

    def test_delivery_cash_audit_allows_unassigned_pos_sales(self):
        sale = Sale.objects.create(
            shift=self.shift,
            payment_method='cash',
            cash_received=Decimal('9000'),
            total=Decimal('9000'),
        )
        Invoice.objects.create(sale=sale, shift=self.shift)
        payload = self._payload(actual_cash=0, closing_stock=6)
        payload['channel'] = 'delivery'
        payload['expected_cash'] = 0

        response = self.client.post('/api/cash/', payload, format='json')

        self.assertEqual(response.status_code, 201, response.data)
        audit = CashAudit.objects.get()
        self.assertEqual(audit.channel, 'delivery')

    def test_pos_cash_audit_rejects_missing_seller_delivery(self):
        sale = Sale.objects.create(
            shift=self.shift,
            seller=self.admin,
            seller_name=self.admin.full_name,
            payment_method='cash',
            cash_received=Decimal('9000'),
            total=Decimal('9000'),
        )
        Invoice.objects.create(sale=sale, shift=self.shift)

        response = self.client.post(
            '/api/cash/',
            self._payload(actual_cash=9000, closing_stock=6),
            format='json',
        )

        self.assertEqual(response.status_code, 400, response.data)
        self.assertIn('entrego cada vendedora', str(response.data))
        self.assertEqual(CashAudit.objects.count(), 0)

    def test_pos_cash_audit_rejects_actual_cash_different_from_seller_deliveries(self):
        sale = Sale.objects.create(
            shift=self.shift,
            seller=self.admin,
            seller_name=self.admin.full_name,
            payment_method='cash',
            cash_received=Decimal('9000'),
            total=Decimal('9000'),
        )
        Invoice.objects.create(sale=sale, shift=self.shift)
        SellerCashDelivery.objects.create(
            shift=self.shift,
            seller_id=self.admin.pk,
            seller_name=self.admin.full_name,
            net_delivered=Decimal('8000'),
        )

        response = self.client.post(
            '/api/cash/',
            self._payload(actual_cash=9000, closing_stock=6),
            format='json',
        )

        self.assertEqual(response.status_code, 400, response.data)
        self.assertIn('debe coincidir', str(response.data))
        self.assertEqual(CashAudit.objects.count(), 0)

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
        SellerCashDelivery.objects.create(
            shift=self.shift,
            seller_id=self.admin.pk,
            seller_name=self.admin.full_name,
            net_delivered=Decimal('9000'),
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

    def test_save_seller_deliveries_updates_existing_record(self):
        first = self.client.post(
            '/api/cash/save-seller-deliveries/',
            {
                'shift_id': self.shift.pk,
                'deliveries': [
                    {
                        'seller_id': self.admin.pk,
                        'seller_name': self.admin.full_name,
                        'net_delivered': 5000,
                    },
                ],
            },
            format='json',
        )
        second = self.client.post(
            '/api/cash/save-seller-deliveries/',
            {
                'shift_id': self.shift.pk,
                'deliveries': [
                    {
                        'seller_id': self.admin.pk,
                        'seller_name': 'Admin editado',
                        'net_delivered': 7000,
                    },
                ],
            },
            format='json',
        )

        self.assertEqual(first.status_code, 200, first.data)
        self.assertEqual(second.status_code, 200, second.data)
        self.assertEqual(SellerCashDelivery.objects.count(), 1)
        delivery = SellerCashDelivery.objects.get()
        self.assertEqual(delivery.seller_id, self.admin.pk)
        self.assertEqual(delivery.seller_name, 'Admin editado')
        self.assertEqual(delivery.net_delivered, Decimal('7000'))

    def test_save_seller_deliveries_rejects_negative_amounts(self):
        response = self.client.post(
            '/api/cash/save-seller-deliveries/',
            {
                'shift_id': self.shift.pk,
                'deliveries': [
                    {
                        'seller_id': self.admin.pk,
                        'seller_name': self.admin.full_name,
                        'net_delivered': -1,
                    },
                ],
            },
            format='json',
        )

        self.assertEqual(response.status_code, 400, response.data)
        self.assertEqual(SellerCashDelivery.objects.count(), 0)

    def test_save_delivery_amount_updates_single_channel_record(self):
        first = self.client.post(
            '/api/cash/save-delivery-amount/',
            {'shift_id': self.shift.pk, 'net_delivered': 3000},
            format='json',
        )
        second = self.client.post(
            '/api/cash/save-delivery-amount/',
            {'shift_id': self.shift.pk, 'net_delivered': 4500},
            format='json',
        )

        self.assertEqual(first.status_code, 200, first.data)
        self.assertEqual(second.status_code, 200, second.data)
        self.assertEqual(SellerCashDelivery.objects.count(), 1)
        delivery = SellerCashDelivery.objects.get()
        self.assertIsNone(delivery.seller_id)
        self.assertEqual(delivery.seller_name, 'Domicilios')
        self.assertEqual(delivery.net_delivered, Decimal('4500'))

    def test_save_delivery_amount_rejects_negative_amount(self):
        response = self.client.post(
            '/api/cash/save-delivery-amount/',
            {'shift_id': self.shift.pk, 'net_delivered': -1},
            format='json',
        )

        self.assertEqual(response.status_code, 400, response.data)
        self.assertEqual(SellerCashDelivery.objects.count(), 0)
