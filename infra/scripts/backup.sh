#!/bin/bash
# Backup de base de datos — Juan Chupe ERP
# Agregar a cron: 0 2 * * * /var/www/juan-chupe-erp/infra/scripts/backup.sh

set -e
source /var/www/juan-chupe-erp/backend/.env

BACKUP_DIR="/var/backups/juanchupe"
DATE=$(date +%Y%m%d_%H%M%S)
FILENAME="$BACKUP_DIR/db_$DATE.sql.gz"

mkdir -p "$BACKUP_DIR"

echo "💾 Iniciando backup: $FILENAME"
PGPASSWORD="$DB_PASSWORD" pg_dump -U "$DB_USER" -h "$DB_HOST" "$DB_NAME" | gzip > "$FILENAME"

# Keep only last 14 days
find "$BACKUP_DIR" -name "*.sql.gz" -mtime +14 -delete

echo "✅ Backup completado: $FILENAME"
