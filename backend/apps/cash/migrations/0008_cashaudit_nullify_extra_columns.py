from django.db import migrations


class Migration(migrations.Migration):
    """
    La tabla cash_cashaudit tiene columnas extra (ej. cups_16oz_system) que
    existen en la BD pero no en el modelo Django. Al insertar, Django no las
    incluye y la BD rechaza el NULL.

    Este script busca dinámicamente todas las columnas NOT NULL de cash_cashaudit
    que no pertenecen al modelo actual y les quita la restricción NOT NULL.
    No borra datos existentes.
    """

    dependencies = [
        ('cash', '0007_sellercashdelivery_created_at'),
    ]

    operations = [
        migrations.RunSQL(
            sql="""
                DO $$
                DECLARE
                    col_name TEXT;
                BEGIN
                    FOR col_name IN
                        SELECT column_name
                        FROM information_schema.columns
                        WHERE table_name   = 'cash_cashaudit'
                          AND table_schema = 'public'
                          AND is_nullable  = 'NO'
                          AND column_name NOT IN (
                              'id', 'expected_cash', 'expected_transfer',
                              'actual_cash', 'actual_transfer', 'cash_difference',
                              'notes', 'created_at', 'audited_by_id',
                              'shift_id', 'channel'
                          )
                    LOOP
                        EXECUTE format(
                            'ALTER TABLE cash_cashaudit ALTER COLUMN %I DROP NOT NULL',
                            col_name
                        );
                        RAISE NOTICE 'Columna % marcada como nullable', col_name;
                    END LOOP;
                END $$;
            """,
            reverse_sql=migrations.RunSQL.noop,
        ),
    ]
