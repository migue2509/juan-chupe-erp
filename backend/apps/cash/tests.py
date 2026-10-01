from decimal import Decimal

from django.test import TestCase
from rest_framework.test import APIClient

from apps.attendance.models import AttendanceRecord
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
        self.worker = User.objects.create_user(
            username='worker', password='pass', full_name='Trabajadora', role='operative',
        )
        AttendanceRecord.objects.create(user=self.worker, shift=self.shift)

    def _payload(self, *, actual_cash, closing_stock):
        return {
            'shift': self.shift.pk,
            'channel': 'pos',
            'delivered_by': self.worker.pk,
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
        Sale.objects.create(shift=self.shift, total=Decimal('10000'), payment_method='cash')
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
        Sale.objects.create(shift=self.shift, total=Decimal('10000'), payment_method='cash')
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

    def test_pos_cash_audit_allows_unassigned_pos_sales(self):
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

        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(CashAudit.objects.get().cash_difference, Decimal('0'))

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

    def test_pos_cash_audit_does_not_require_seller_deliveries(self):
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

        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(CashAudit.objects.get().delivered_by, self.worker)

    def test_pos_cash_audit_ignores_legacy_seller_deliveries(self):
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

        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(CashAudit.objects.get().actual_cash, Decimal('9000'))
        self.assertEqual(SellerCashDelivery.objects.get().net_delivered, Decimal('8000'))

    def test_patch_cash_audit_recalculates_difference(self):
        Sale.objects.create(shift=self.shift, total=Decimal('10000'), payment_method='cash')
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
            {'actual_cash': 9000, 'delivered_by': self.worker.pk},
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

    def test_pos_handover_consolidates_all_users_and_excludes_other_channels(self):
        from apps.promotions.models import Promotion

        Sale.objects.create(shift=self.shift, seller=self.admin, total=Decimal('95000'))
        Sale.objects.create(
            shift=self.shift, seller=self.worker, total=Decimal('40000'),
            payment_method='transfer', transfer_amount=Decimal('40000'),
        )
        Sale.objects.create(shift=self.shift, total=Decimal('50000'), is_delivery=True)
        for category in ('rappi', 'didi'):
            promotion = Promotion.objects.create(name=category, category=category, promo_price=20000)
            Sale.objects.create(shift=self.shift, total=20000, promotion=promotion)
        voided_sale = Sale.objects.create(shift=self.shift, total=60000)
        Invoice.objects.create(sale=voided_sale, shift=self.shift, voided=True)
        for user, amount, origin, method, from_cash in (
            (self.worker, 20000, 'pos', 'cash', True),
            (self.admin, 60000, 'pos', 'cash', True),
            (None, 9000, 'delivery', 'cash', True),
            (self.admin, 7000, 'pos', 'transfer', True),
            (self.admin, 8000, 'pos', 'cash', False),
        ):
            Expense.objects.create(
                shift=self.shift, registered_by=user, amount=amount, category='business',
                origin=origin, payment_method=method, from_daily_cash=from_cash,
            )
        response = self.client.post('/api/cash/', self._payload(actual_cash=15000, closing_stock=6), format='json')
        self.assertEqual(response.status_code, 201, response.data)
        audit = CashAudit.objects.get()
        self.assertEqual(audit.expected_cash, Decimal('95000'))
        self.assertEqual(audit.expected_transfer, Decimal('40000'))
        self.assertEqual(audit.cash_difference, Decimal('0'))
        self.assertEqual(audit.delivered_by, self.worker)
        self.assertEqual(audit.delivered_by_name, self.worker.full_name)
        prefill = self.client.get('/api/cash/prefill/', {'shift_id': self.shift.pk})
        self.assertEqual(prefill.status_code, 200, prefill.data)
        self.assertEqual(prefill.data['pos_total'], 135000)
        self.assertEqual(prefill.data['net_expected_cash'], 15000)
        self.assertEqual(prefill.data['arqueos']['pos']['delivered_by'], self.worker.pk)
        self.assertEqual(prefill.data['arqueos']['pos']['actual_cash'], 15000)
        self.assertFalse(SellerCashDelivery.objects.exists())

    def test_pos_handover_requires_responsible_worker_and_explicit_amount(self):
        for field in ('delivered_by', 'actual_cash'):
            payload = self._payload(actual_cash=0, closing_stock=6)
            del payload[field]
            response = self.client.post('/api/cash/', payload, format='json')
            self.assertEqual(response.status_code, 400, response.data)
            self.assertIn(field, response.data)
        self.assertFalse(CashAudit.objects.exists())

    def test_pos_handover_rejects_invalid_amounts(self):
        for amount in (-1, 'NaN', 'Infinity', '1.5', '1000000000000'):
            response = self.client.post('/api/cash/', self._payload(actual_cash=amount, closing_stock=6), format='json')
            self.assertEqual(response.status_code, 400, response.data)
        self.assertFalse(CashAudit.objects.exists())

    def test_pos_handover_rejects_workers_outside_shift_or_inactive(self):
        outsider = User.objects.create_user(username='outsider', full_name='Otra', role='operative')
        self.worker.is_active = False
        self.worker.save()
        for worker_id in (outsider.pk, self.worker.pk, self.admin.pk, 999999):
            payload = self._payload(actual_cash=0, closing_stock=6)
            payload['delivered_by'] = worker_id
            response = self.client.post('/api/cash/', payload, format='json')
            self.assertEqual(response.status_code, 400, response.data)
        self.assertFalse(CashAudit.objects.exists())

    def test_pos_worker_list_uses_attendance_sales_expenses_and_work_logs(self):
        from apps.payroll.models import WorkLog
        from django.utils import timezone

        expected_ids = {self.worker.pk}
        for source in ('sale', 'expense', 'login', 'absent', 'inactive'):
            worker = User.objects.create_user(
                username=source, full_name=source, role='operative', is_active=source != 'inactive',
            )
            if source == 'sale':
                Sale.objects.create(shift=self.shift, seller=worker, total=0)
            elif source == 'expense':
                Expense.objects.create(shift=self.shift, registered_by=worker, amount=0, category='business')
            elif source == 'login':
                WorkLog.objects.create(user=worker, date=timezone.localdate(self.shift.opened_at))
            elif source == 'inactive':
                AttendanceRecord.objects.create(user=worker, shift=self.shift)
            if source not in ('absent', 'inactive'):
                expected_ids.add(worker.pk)
        response = self.client.get('/api/cash/prefill/', {'shift_id': self.shift.pk})
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual({w['id'] for w in response.data['pos_handover_workers']}, expected_ids)

    def test_pos_handover_retains_name_after_worker_deactivation(self):
        response = self.client.post('/api/cash/', self._payload(actual_cash=0, closing_stock=6), format='json')
        self.assertEqual(response.status_code, 201, response.data)
        name = self.worker.full_name
        self.worker.full_name = 'Nombre editado'
        self.worker.is_active = False
        self.worker.save()
        prefill = self.client.get('/api/cash/prefill/', {'shift_id': self.shift.pk})
        self.assertEqual(prefill.data['arqueos']['pos']['delivered_by_name'], name)
        self.assertEqual(prefill.data['pos_handover_workers'], [])

    def test_operative_cannot_register_pos_handover(self):
        self.client.force_authenticate(self.worker)
        response = self.client.post('/api/cash/', self._payload(actual_cash=0, closing_stock=6), format='json')
        self.assertEqual(response.status_code, 403, response.data)
        self.assertFalse(CashAudit.objects.exists())
