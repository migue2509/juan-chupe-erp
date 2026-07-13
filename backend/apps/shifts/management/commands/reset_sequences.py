"""
Comando: python manage.py reset_sequences

Resetea las secuencias de IDs de PostgreSQL a 1 en todas las tablas
operativas que fueron limpiadas con reset_operational_data.

También renombra la jornada activa actual a ID 1 si su ID es mayor que 1.
"""
from django.core.management.base import BaseCommand
from django.db import connection


# Tablas operativas cuya secuencia se reinicia a 1
TABLES = [
    'shifts_shift',
    'billing_invoice',
    'sales_sale',
    'sales_saleitem',
    'sales_saleitemflavor',
    'expenses_expense',
    'purchases_purchase',
    'deliveries_delivery',
    'deliveries_heatmappoint',
    'inventory_stockmovement',
    'attendance_attendancerecord',
    'payroll_worklog',
    'payroll_wagepayment',
    'cash_cashaudit',
    'cash_shiftaudititem',
    'cash_sellercashdelivery',
]


class Command(BaseCommand):
    help = 'Resetea secuencias de IDs a 1 y renombra la jornada activa a ID 1.'

    def handle(self, *args, **options):
        with connection.cursor() as cursor:

            # ── 1. Renombrar jornada actual a ID 1 ───────────────────────────
            cursor.execute("SELECT id FROM shifts_shift ORDER BY id LIMIT 1")
            row = cursor.fetchone()

            if row and row[0] != 1:
                current_id = row[0]
                self.stdout.write(f'  Renombrando jornada #{current_id} → #1 ...')
                # Deshabilitar temporalmente FK checks no es posible en PG,
                # pero como no hay datos hijo podemos actualizar directo.
                cursor.execute(
                    "UPDATE shifts_shift SET id = 1 WHERE id = %s",
                    [current_id]
                )
                self.stdout.write(self.style.SUCCESS('  ✓ Jornada renombrada a ID 1'))
            elif row and row[0] == 1:
                self.stdout.write('  ✓ Jornada ya tiene ID 1 — sin cambios')
            else:
                self.stdout.write('  (no hay jornadas activas)')

            # ── 2. Resetear secuencias ────────────────────────────────────────
            self.stdout.write('\nReseteando secuencias...')
            for table in TABLES:
                try:
                    # Cuenta cuántos registros hay (para saber si poner 1 o n+1)
                    cursor.execute(f"SELECT COUNT(*), MAX(id) FROM {table}")
                    count, max_id = cursor.fetchone()

                    if count == 0:
                        # Tabla vacía → próximo ID será 1
                        cursor.execute(
                            f"SELECT setval(pg_get_serial_sequence('{table}', 'id'), 1, false)"
                        )
                        self.stdout.write(f'  ✓ {table}: secuencia → 1')
                    else:
                        # Tabla con datos → próximo ID será max_id + 1
                        cursor.execute(
                            f"SELECT setval(pg_get_serial_sequence('{table}', 'id'), %s, true)",
                            [max_id]
                        )
                        self.stdout.write(f'  ✓ {table}: secuencia → {max_id + 1} (hay {count} registros)')

                except Exception as e:
                    self.stdout.write(self.style.WARNING(f'  ⚠ {table}: {e}'))

        self.stdout.write(self.style.SUCCESS(
            '\n✅ Secuencias reseteadas. La próxima jornada será #2, '
            'la próxima factura será JC-000001.\n'
        ))
