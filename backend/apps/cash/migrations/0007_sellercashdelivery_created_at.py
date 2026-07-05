from django.db import migrations, models


class Migration(migrations.Migration):
    """
    La columna created_at ya existe en la BD pero faltaba en el modelo.
    SeparateDatabaseAndState sincroniza el estado de Django sin tocar la tabla.
    Si por algún motivo la columna NO existe (instalación limpia), el RunSQL la agrega.
    """

    dependencies = [
        ('cash', '0006_sellercashdelivery'),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            # Operación de BD: agregar columna solo si no existe
            database_operations=[
                migrations.RunSQL(
                    sql="""
                        ALTER TABLE cash_sellercashdelivery
                        ADD COLUMN IF NOT EXISTS created_at
                        TIMESTAMPTZ NOT NULL DEFAULT NOW();
                    """,
                    reverse_sql="""
                        ALTER TABLE cash_sellercashdelivery
                        DROP COLUMN IF EXISTS created_at;
                    """,
                ),
            ],
            # Operación de estado: registrar el campo en el ORM
            state_operations=[
                migrations.AddField(
                    model_name='sellercashdelivery',
                    name='created_at',
                    field=models.DateTimeField(auto_now_add=True),
                    preserve_default=False,
                ),
            ],
        ),
    ]
