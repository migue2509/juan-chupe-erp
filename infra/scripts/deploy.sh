#!/bin/bash
# Script de despliegue — Juan Chupe ERP
# Ejecutar desde el servidor VPS como: bash deploy.sh

set -e

PROJECT_DIR="/var/www/juan-chupe-erp"
VENV="$PROJECT_DIR/venv"

echo "🚀 Iniciando deploy Juan Chupe ERP..."

cd "$PROJECT_DIR"

# Pull latest changes
echo "📥 Actualizando código..."
git pull origin main

# Backend
echo "🐍 Actualizando backend..."
source "$VENV/bin/activate"
pip install -r backend/requirements.txt --quiet
cd backend
python manage.py migrate --no-input
python manage.py collectstatic --no-input --clear
cd ..

# Frontend
echo "⚡ Compilando frontend..."
cd frontend
npm install --silent
npm run build
cd ..

# Restart services
echo "🔄 Reiniciando servicios..."
sudo systemctl restart gunicorn
sudo systemctl reload nginx

echo "✅ Deploy completado exitosamente!"
echo "   Accede en: http://$(curl -s ifconfig.me)"
