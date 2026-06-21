# 🧊 Juan Chupe Granizados — ERP

Sistema de gestión completo para tiendas de granizados.  
**Stack:** React + Vite + Tailwind · Django + DRF · PostgreSQL · VPS (Nginx + Gunicorn)

---

## Ejecución Local (tu PC)

### Requisitos
- Python 3.11+
- Node.js 18+
- PostgreSQL 15+

### 1. Backend

```bash
cd backend

# Crear entorno virtual
python -m venv venv
venv\Scripts\activate          # Windows
# source venv/bin/activate     # Mac/Linux

# Instalar dependencias
pip install -r requirements.txt

# Configurar variables de entorno
copy .env.example .env
# Edita .env con tus datos de BD

# Crear base de datos en PostgreSQL
# En psql:
#   CREATE USER juanchupe_user WITH PASSWORD 'tu_password';
#   CREATE DATABASE juanchupe_db OWNER juanchupe_user;

# Migraciones
python manage.py migrate

# Cargar datos iniciales (sabores, usuarios, vasos)
python manage.py shell < ../scripts/seed_data.py

# Iniciar servidor
python manage.py runserver
# Backend disponible en: http://localhost:8000
```

### 2. Frontend

```bash
cd frontend

# Instalar dependencias
npm install

# Iniciar servidor de desarrollo
npm run dev
# Frontend disponible en: http://localhost:5173
```

### 3. Acceder

Abrir `http://localhost:5173` en el navegador.

**Credenciales iniciales:**
| Usuario | Contraseña | Rol |
|---------|-----------|-----|
| `juanchupe` | `admin123` | Administrador |
| `mafe` | `vendedora123` | Vendedora |
| `sofia` | `vendedora123` | Vendedora |
| `catalina` | `vendedora123` | Vendedora |

> ⚠️ Cambia las contraseñas desde el panel de Usuarios antes de usar en producción.

---

## Despliegue en VPS (Ubuntu 22.04)

### Requisitos del servidor
- VPS Ubuntu 22.04 (mínimo $10/mes en DigitalOcean o Hetzner)
- Acceso SSH

### 1. Conectar al servidor

```bash
ssh root@TU_IP_DEL_VPS
```

### 2. Instalar dependencias del sistema

```bash
apt update && apt upgrade -y
apt install -y python3 python3-pip python3-venv nodejs npm postgresql nginx git
```

### 3. Configurar PostgreSQL

```bash
sudo -u postgres psql
```
```sql
CREATE USER juanchupe_user WITH PASSWORD 'tu_password_seguro';
CREATE DATABASE juanchupe_db OWNER juanchupe_user;
\q
```

### 4. Clonar el proyecto

```bash
mkdir -p /var/www
cd /var/www
git clone https://github.com/TU_USUARIO/juan-chupe-erp.git
cd juan-chupe-erp
```

> Si no usas Git, sube los archivos con `scp -r ./juan-chupe-erp root@TU_IP:/var/www/`

### 5. Configurar backend

```bash
cd /var/www/juan-chupe-erp/backend
python3 -m venv /var/www/juan-chupe-erp/venv
source /var/www/juan-chupe-erp/venv/bin/activate

pip install -r requirements.txt

cp .env.example .env
nano .env
# Editar: SECRET_KEY, DEBUG=False, ALLOWED_HOSTS=TU_IP, DB_PASSWORD
```

```bash
python manage.py migrate
python manage.py collectstatic --no-input
python manage.py shell < ../scripts/seed_data.py
```

### 6. Configurar Gunicorn

```bash
cp /var/www/juan-chupe-erp/infra/systemd/gunicorn.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable gunicorn
systemctl start gunicorn
```

### 7. Compilar frontend

```bash
cd /var/www/juan-chupe-erp/frontend
npm install
npm run build
```

### 8. Configurar Nginx

```bash
cp /var/www/juan-chupe-erp/infra/nginx/default.conf /etc/nginx/sites-available/juanchupe
ln -s /etc/nginx/sites-available/juanchupe /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx
```

### 9. Acceder

Abre `http://TU_IP` desde cualquier navegador (PC, celular, tablet).

---

## Actualizaciones (desde tu PC)

Cada vez que hagas cambios:

```bash
# Opción 1: Con Git (recomendado)
# En el servidor:
cd /var/www/juan-chupe-erp
bash infra/scripts/deploy.sh

# Opción 2: Manual
# Sube archivos con scp y ejecuta en el servidor:
cd /var/www/juan-chupe-erp/backend
source ../venv/bin/activate
python manage.py migrate
python manage.py collectstatic --no-input
sudo systemctl restart gunicorn

# Para cambios de frontend:
cd /var/www/juan-chupe-erp/frontend
npm run build
sudo systemctl reload nginx
```

---

## Backup automático

```bash
# Agregar al cron del servidor:
crontab -e
# Agregar esta línea (backup cada día a las 2 AM):
0 2 * * * /var/www/juan-chupe-erp/infra/scripts/backup.sh
```

---

## Módulos del sistema

| Módulo | Descripción |
|--------|-------------|
| 🏠 Dashboard | Estado de jornada, ventas del día, alertas de stock |
| 🧊 POS | Punto de venta táctil: sabores, tamaños, toppings, promociones |
| 🧾 Facturación | Historial de facturas, reimpresión, anulación (solo admin) |
| 🛵 Domicilios | Gestión de pedidos a domicilio y su estado |
| 💸 Gastos | Registro de gastos con validación de origen |
| 📅 Jornadas | Apertura y cierre manual del día operativo |
| 🍧 Productos | Sabores, tamaños de vaso, toppings |
| 📦 Inventario | Stock de bolsas (ml) y vasos, alertas de mínimos |
| 🎉 Promociones | CRUD de promociones con liquidación proporcional |
| 💰 Arqueo | Arqueo de caja al cierre: vasos, bolsas y efectivo |
| 📊 Reportes | Diario, semanal y mensual con gráficas |
| 👥 Usuarios | CRUD de usuarios y roles |
| 🕐 Asistencia | Control de tiempo de vendedoras |

---

## Reglas de negocio implementadas

- **RN-001/002**: Cierre manual de jornada (cierre automático 2AM como fallback)
- **RN-003**: Toppings afectan inventario pero no precio
- **RN-004**: Liquidación proporcional de promociones (precio ÷ cantidad)
- **RN-006**: Anulación de facturas solo por administrador
- **RN-008/009**: Motor de consumo oz→ml con distribución proporcional entre sabores

---

## Tecnologías

```
Frontend:  React 18 · Vite · Tailwind CSS · Recharts · React Router
Backend:   Django 4.2 · DRF · Simple JWT · Django Filter
Base datos: PostgreSQL 15
Servidor:  Ubuntu 22.04 · Nginx · Gunicorn
Email:     Resend (envío automático de reportes)
```

---

*Desarrollado por ARQEL TECH para Juan Chupe Granizados · 2026*
