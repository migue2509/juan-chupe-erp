from decimal import Decimal

from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from apps.billing.models import Invoice
from apps.deliveries.models import Delivery
from apps.products.models import CupSize, Flavor
from apps.sales.models import Sale, SaleItem, SaleItemFlavor
from apps.shifts.models import Shift
from apps.users.models import User


class ActiveSalesReportTests(TestCase):
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

    def _sale(self, *, quantity=1, is_delivery=False, delivery_status='pending', voided=False):
        sale = Sale.objects.create(
            shift=self.shift,
            seller=self.admin,
            seller_name=self.admin.full_name,
            payment_method='cash',
            cash_received=Decimal('0'),
            is_delivery=is_delivery,
        )
        item = SaleItem.objects.create(
            sale=sale,
            cup_size=self.cup,
            unit_price=self.cup.price,
            topping_price=Decimal('0'),
            quantity=quantity,
        )
        SaleItemFlavor.objects.create(
            sale_item=item,
            flavor=self.flavor,
            ml_consumed=self.cup.ml * quantity,
        )
        sale.calculate_total()
        invoice = Invoice.objects.create(sale=sale, shift=self.shift, voided=voided)
        if is_delivery:
            Delivery.objects.create(
                sale=sale,
                shift=self.shift,
                address='Calle 1',
                status=delivery_status,
            )
        return sale, invoice

    def _seed_sales(self):
        self._sale(quantity=2)
        self._sale(quantity=3, is_delivery=True, delivery_status='cancelled')
        self._sale(quantity=4, voided=True)

    def test_daily_report_counts_only_active_sales_and_cup_units(self):
        self._seed_sales()

        response = self.client.get(f'/api/reports/daily/?shift_id={self.shift.pk}')

        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data['total_sales'], 14000.0)
        self.assertEqual(response.data['sales_count'], 1)
        self.assertEqual(response.data['deliveries_count'], 0)
        self.assertEqual(len(response.data['cup_sales']), 1)
        self.assertEqual(response.data['cup_sales'][0]['count'], 2)

    def test_shift_detail_and_cash_prefill_ignore_cancelled_delivery_sales(self):
        self._seed_sales()

        detail = self.client.get(f'/api/shifts/{self.shift.pk}/detail/')
        prefill = self.client.get(f'/api/cash/prefill/?shift_id={self.shift.pk}')

        self.assertEqual(detail.status_code, 200, detail.data)
        self.assertEqual(detail.data['summary']['all_total'], 14000)
        self.assertEqual(detail.data['summary']['dom_total'], 0)
        self.assertEqual(detail.data['summary']['sales_count'], 1)

        self.assertEqual(prefill.status_code, 200, prefill.data)
        self.assertEqual(prefill.data['pos_total'], Decimal('14000'))
        self.assertEqual(prefill.data['delivery_total'], Decimal('0'))
        cup_row = next(row for row in prefill.data['catalog'] if row['product_id'] == self.cup.pk)
        self.assertEqual(cup_row['sales_qty'], 2)

    def test_range_report_ignores_cancelled_delivery_sales(self):
        self._seed_sales()
        today = timezone.localdate().isoformat()

        response = self.client.get(f'/api/reports/range/?date_from={today}&date_to={today}')

        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data['total_sales'], 14000.0)
        self.assertEqual(response.data['sales_count'], 1)
        self.assertEqual(response.data['deliveries']['revenue'], 0)
        self.assertEqual(response.data['cup_sales'][0]['count'], 2)
