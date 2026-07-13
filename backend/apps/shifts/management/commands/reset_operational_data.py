"""
Comando: python manage.py reset_operational_data

Borra todos los datos operativos (ventas, jornadas, facturas, gastos,
domicilios, inventario, asistencia, nómina, arqueos) y resetea stocks a 0.

Conserva: Usuarios · Productos · Promociones · Config pagos.
"""
from django.core.management.base import BaseCommand
from django.db import transaction


class Command(BaseCommand):
    help = 'Limpia datos operativos conservando productos, promociones, usuarios y config pagos.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--confirmar',
            action='store_true',
            help='Confirmar la operación (sin este flag solo muestra lo que haría)',
        )

    def handle(self, *args, **options):
        confirmar = options['confirmar']

        if not confirmar:
            self.stdout.write(self.style.WARNING(
                '\n⚠️  MODO SIMULACIÓN — agrega --confirmar para ejecutar de verdad.\n'
                'Se eliminarán:\n'
                '  • Ventas, ítems y sabores de ítems\n'
                '  • Facturas\n'
                '  • Jornadas\n'
                '  • Gastos y compras\n'
                '  • Domicilios y heatmap\n'
                '  • Movimientos de inventario (stocks se resetean a 0)\n'
                '  • Arqueos de caja\n'
                '  • Asistencia\n'
                '  • Registros de nómina (logs y pagos — horarios se conservan)\n'
                '  • Audit log\n'
                '\nSe conservarán:\n'
                '  ✓ Usuarios\n'
                '  ✓ Productos (sabores, vasos, toppings)\n'
                '  ✓ Promociones\n'
                '  ✓ Métodos de pago / Config POS\n'
                '  ✓ Horarios de nómina (WorkdaySchedule)\n'
            ))
            return

        self.stdout.write('Iniciando limpieza...')

        with transaction.atomic():

            # ── 1. Movimientos de inventario ──────────────────────────────
            from apps.inventory.models import StockMovement, FlavorBag, CupStock, ToppingStock
            n, _ = StockMovement.objects.all().delete()
            self._ok(f'StockMovement: {n} eliminados')

            # ── 2. Arqueos de caja ────────────────────────────────────────
            from apps.cash.models import CashAudit, ShiftAuditItem, SellerCashDelivery
            ShiftAuditItem.objects.all().delete()
            SellerCashDelivery.objects.all().delete()
            n, _ = CashAudit.objects.all().delete()
            self._ok(f'CashAudit: {n} eliminados')

            # ── 3. Asistencia ─────────────────────────────────────────────
            from apps.attendance.models import AttendanceRecord
            n, _ = AttendanceRecord.objects.all().delete()
            self._ok(f'Attendance: {n} eliminados')

            # ── 4. Nómina — logs y pagos (horarios se conservan) ──────────
            from apps.payroll.models import WorkLog, WagePayment
            WagePayment.objects.all().delete()
            n, _ = WorkLog.objects.all().delete()
            self._ok(f'Payroll WorkLog/Payment: {n} eliminados')

            # ── 5. Facturas ───────────────────────────────────────────────
            from apps.billing.models import Invoice
            n, _ = Invoice.objects.all().delete()
            self._ok(f'Invoice: {n} eliminados')

            # ── 6. Domicilios ─────────────────────────────────────────────
            from apps.deliveries.models import Delivery, HeatmapPoint
            HeatmapPoint.objects.all().delete()
            n, _ = Delivery.objects.all().delete()
            self._ok(f'Delivery: {n} eliminados')

            # ── 7. Ventas ─────────────────────────────────────────────────
            from apps.sales.models import SaleItemFlavor, SaleItem, Sale
            SaleItemFlavor.objects.all().delete()
            SaleItem.objects.all().delete()
            n, _ = Sale.objects.all().delete()
            self._ok(f'Sale: {n} eliminados')

            # ── 8. Gastos y compras ───────────────────────────────────────
            from apps.expenses.models import Expense
            n, _ = Expense.objects.all().delete()
            self._ok(f'Expense: {n} eliminados')
            from apps.purchases.models import Purchase
            n, _ = Purchase.objects.all().delete()
            self._ok(f'Purchase: {n} eliminados')

            # ── 9. Jornadas ───────────────────────────────────────────────
            from apps.shifts.models import Shift
            n, _ = Shift.objects.all().delete()
            self._ok(f'Shift: {n} eliminados')

            # ── 10. Audit log ─────────────────────────────────────────────
            try:
                from apps.audit.models import AuditLog
                n, _ = AuditLog.objects.all().delete()
                self._ok(f'AuditLog: {n} eliminados')
            except Exception:
                pass

            # ── 11. Reset stocks a 0 ──────────────────────────────────────
            FlavorBag.objects.all().update(stock_ml=0)
            CupStock.objects.all().update(quantity=0)
            ToppingStock.objects.all().update(quantity=0)
            self._ok('Stocks reseteados a 0')

        self.stdout.write(self.style.SUCCESS(
            '\n✅ Listo. Se conservaron: Usuarios · Productos · Promociones · Config pagos.\n'
        ))

    def _ok(self, msg):
        self.stdout.write(f'  ✓ {msg}')
