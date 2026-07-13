# Guía de Despliegue en la Nube — Juan Chupe ERP
### Guía paso a paso para principiantes

---

## ¿Qué es desplegar y por qué hacerlo?

Ahora el sistema solo funciona en tu computador. **Desplegar** significa subirlo a internet para que:
- Los vendedores accedan desde su celular o cualquier PC
- El sistema esté disponible 24/7 sin depender de tu computador
- Múltiples personas puedan usarlo al mismo tiempo

---

## La arquitectura: qué va dónde

Tu sistema tiene **dos partes separadas** que se suben a lugares distintos:

```
┌─────────────────────────────────────────────────────────────┐
│                    INTERNET                                  │
│                                                             │
│   FRONTEND (React)          BACKEND (Django + Base datos)   │
│   ┌─────────────────┐       ┌─────────────────────────────┐ │
│   │  Vercel          │ ────▶ │  Railway / Render / VPS     │ │
│   │  (GRATIS)        │       │  (~$5–10 / mes)             │ │
│   │                  │       │                             │ │
│   │  Lo que el       │       │  La lógica, los datos,      │ │
│   │  usuario ve      │       │  las ventas, los usuarios   │ │
│   └─────────────────┘       └─────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

| Parte | ¿Qué es? | ¿Dónde va? | Costo |
|-------|----------|-----------|-------|
| **Frontend** | Las pantallas (React) | Vercel o Netlify | **Gratis** |
| **Backend** | La API y la lógica (Django) | Railway, Render, o VPS | $5–10/mes |
| **Base de datos** | PostgreSQL | Incluida en Railway/Render | Incluida |

---

## OPCIÓN A — La más fácil: Vercel + Railway

> Recomendada si nunca has desplegado antes. Todo se hace desde el navegador.

---

### PARTE 1: Subir el código a GitHub

> ⚠️ **Desde tu computador**, en la terminal (PowerShell o CMD), dentro de la carpeta del proyecto.

Primero necesitas el código en GitHub para que Vercel y Railway lo lean:

```powershell
# Ir a la carpeta del proyecto
cd "C:\Users\Miguel\OneDrive\Documentos\Juan chupe granizados\juan-chupe-erp"

# Inicializar git si no lo has hecho
git init
git add .
git commit -m "Initial commit"
```

Luego:
1. Ve a **https://github.com** → inicia sesión → **New repository**
2. Nómbralo `juan-chupe-erp` → **Create repository**
3. Copia los comandos que GitHub te muestra y pégalos en la terminal:

```powershell
git remote add origin https://github.com/TU_USUARIO/juan-chupe-erp.git
git branch -M main
git push -u origin main
```

✅ El código ya está en GitHub.

---

### PARTE 2: Desplegar el Backend en Railway

> 🌐 **Desde el navegador**, en railway.app

Railway es una plataforma que corre Django y PostgreSQL automáticamente.

**Paso 1 — Crear cuenta**
1. Ve a **https://railway.app**
2. Haz clic en **Login with GitHub** (usa la misma cuenta de GitHub)

**Paso 2 — Crear proyecto**
1. Haz clic en **New Project**
2. Selecciona **Deploy from GitHub repo**
3. Busca y selecciona `juan-chupe-erp`
4. Railway detectará que hay un backend en `/backend`

**Paso 3 — Agregar PostgreSQL**
1. En tu proyecto de Railway, haz clic en **+ New**
2. Selecciona **Database → Add PostgreSQL**
3. Railway crea la base de datos y la conecta automáticamente

**Paso 4 — Configurar variables de entorno**

Haz clic en tu servicio Django → pestaña **Variables** → agrega cada una:

```
SECRET_KEY        = (genera una en https://djecrety.ir/)
DEBUG             = False
ALLOWED_HOSTS     = tuproyecto.up.railway.app
DB_NAME           = ${{Postgres.PGDATABASE}}
DB_USER           = ${{Postgres.PGUSER}}
DB_PASSWORD       = ${{Postgres.PGPASSWORD}}
DB_HOST           = ${{Postgres.PGHOST}}
DB_PORT           = ${{Postgres.PGPORT}}
CORS_ALLOWED_ORIGINS = https://tu-app.vercel.app
```

> Las variables con `${{Postgres...}}` Railway las rellena solas — no las cambies.

**Paso 5 — Configurar el comando de inicio**

En tu servicio Django → **Settings** → **Start Command**:

```
cd backend && gunicorn config.wsgi:application --bind 0.0.0.0:$PORT
```

**Paso 6 — Ejecutar migraciones**

En Railway → tu servicio → pestaña **Deploy** → **New Deployment** → cuando termine:

Haz clic en los tres puntos `...` → **Run Command** → escribe:

```
cd backend && python manage.py migrate && python manage.py createsuperuser
```

Sigue las instrucciones para crear el usuario administrador.

✅ El backend ya está en internet. Railway te da una URL como `https://juan-chupe-erp-production.up.railway.app`

---

### PARTE 3: Desplegar el Frontend en Vercel

> 🌐 **Desde el navegador**, en vercel.com

**Paso 1 — Crear cuenta**
1. Ve a **https://vercel.com**
2. Haz clic en **Continue with GitHub**

**Paso 2 — Importar proyecto**
1. Haz clic en **Add New → Project**
2. Busca `juan-chupe-erp` → **Import**
3. En **Root Directory** escribe `frontend` (⚠️ importante)
4. En **Framework Preset** selecciona **Vite**

**Paso 3 — Configurar la URL del backend**

En **Environment Variables** agrega:

```
VITE_API_URL = https://juan-chupe-erp-production.up.railway.app
```

> Reemplaza con la URL real que Railway te asignó.

**Paso 4 — Desplegar**

Haz clic en **Deploy**. Vercel compila React y en ~2 minutos te da una URL como:

`https://juan-chupe-erp.vercel.app`

✅ ¡El sistema ya está en internet con dominio gratis!

---

### Dominios gratis que obtienes

| Servicio | Dominio gratuito | Ejemplo |
|----------|-----------------|---------|
| Vercel | `*.vercel.app` | `juan-chupe.vercel.app` |
| Netlify | `*.netlify.app` | `juan-chupe.netlify.app` |
| Railway | `*.up.railway.app` | `juan-chupe-api.up.railway.app` |

Si quieres un dominio propio (ej. `juanchupe.com`), cuesta ~$12/año en Namecheap o Google Domains y lo conectas en 5 minutos.

---

## OPCIÓN B — VPS (más control, más barato a largo plazo)

> Para cuando quieras todo en un solo servidor que controlas tú.  
> Costo: desde €3.79/mes en Hetzner.  
> Requiere más conocimiento técnico.

### ¿Qué es un VPS?

Es un computador en la nube que rentas por mes. Tú instalas todo lo que necesitas. Es como tener un PC virtual en internet funcionando 24/7.

**Proveedores recomendados:**
- **Hetzner** (https://hetzner.com) — Mejor precio para Colombia, servidores en Europa
- **DigitalOcean** (https://digitalocean.com) — Muy fácil de usar, $6/mes
- **AWS Lightsail** (https://aws.amazon.com/lightsail) — $3.50/mes, con Free Tier

---

### Paso 1 — Crear el servidor

En Hetzner (ejemplo):
1. Crea cuenta en https://hetzner.com/cloud
2. **New Project** → dale un nombre
3. **Add Server**:
   - **Location**: cualquiera (Falkenstein o Helsinki son los más baratos)
   - **Image**: Ubuntu 22.04
   - **Type**: CX11 (1 vCPU, 2 GB RAM) — €3.79/mes
   - **SSH Key**: haz clic en "Add SSH Key" (explicado abajo)
4. **Create & Buy Now**

**Crear tu clave SSH** (desde PowerShell en tu computador):

```powershell
ssh-keygen -t ed25519 -C "juanchupe-deploy"
# Presiona Enter 3 veces (sin contraseña está bien)

# Ver la clave pública para copiarla a Hetzner:
cat $env:USERPROFILE\.ssh\id_ed25519.pub
```

Copia todo el texto que aparece y pégalo en Hetzner al agregar la SSH Key.

---

### Paso 2 — Conectarse al servidor

> ⚠️ **Desde PowerShell en tu computador**

```powershell
ssh root@IP_DEL_SERVIDOR
# Ejemplo: ssh root@65.21.143.22
```

Verás algo como `root@ubuntu-2gb-hel1-1:~#` — ya estás dentro del servidor.

---

### Paso 3 — Instalar todo (dentro del servidor)

> ⚠️ **Todos estos comandos se ejecutan EN EL SERVIDOR**, no en tu computador.

```bash
# Actualizar el sistema
apt update && apt upgrade -y

# Instalar dependencias
apt install -y python3.11 python3.11-venv python3-pip python3.11-dev \
               postgresql postgresql-contrib nginx redis-server \
               libpq-dev build-essential libjpeg-dev zlib1g-dev git curl

# Instalar Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs
```

---

### Paso 4 — Configurar la base de datos (dentro del servidor)

```bash
sudo -u postgres psql
```

Se abre una consola especial de PostgreSQL. Escribe esto (cambia el password):

```sql
CREATE DATABASE juanchupe_db;
CREATE USER juanchupe_user WITH PASSWORD 'ELIGE_UN_PASSWORD_SEGURO';
GRANT ALL PRIVILEGES ON DATABASE juanchupe_db TO juanchupe_user;
\c juanchupe_db
GRANT ALL ON SCHEMA public TO juanchupe_user;
\q
```

---

### Paso 5 — Descargar el proyecto (dentro del servidor)

```bash
mkdir -p /var/www/juan-chupe-erp
cd /var/www/juan-chupe-erp
git clone https://github.com/TU_USUARIO/juan-chupe-erp.git .
```

---

### Paso 6 — Configurar el backend (dentro del servidor)

```bash
# Crear entorno virtual de Python
python3.11 -m venv /var/www/juan-chupe-erp/venv
source /var/www/juan-chupe-erp/venv/bin/activate

# Instalar paquetes Python
pip install -r /var/www/juan-chupe-erp/backend/requirements.txt

# Crear el archivo de configuración
cp /var/www/juan-chupe-erp/backend/.env.example /var/www/juan-chupe-erp/backend/.env
nano /var/www/juan-chupe-erp/backend/.env
```

Edita el archivo y rellena los valores:

```env
SECRET_KEY=pega-aqui-una-clave-larga-y-aleatoria
DEBUG=False
ALLOWED_HOSTS=IP_DEL_SERVIDOR,tudominio.com

DB_NAME=juanchupe_db
DB_USER=juanchupe_user
DB_PASSWORD=EL_PASSWORD_QUE_ELEGISTE
DB_HOST=127.0.0.1
DB_PORT=5432

CORS_ALLOWED_ORIGINS=http://IP_DEL_SERVIDOR,https://tudominio.com
```

Guarda con `Ctrl+O`, `Enter`, `Ctrl+X`.

```bash
cd /var/www/juan-chupe-erp/backend

# Crear tablas en la base de datos
python manage.py migrate

# Copiar archivos estáticos (CSS/JS del admin)
python manage.py collectstatic --no-input

# Crear usuario administrador
python manage.py createsuperuser
```

---

### Paso 7 — Compilar el frontend (dentro del servidor)

```bash
cd /var/www/juan-chupe-erp/frontend
npm install
npm run build
# Los archivos quedan en /var/www/juan-chupe-erp/frontend/dist/
```

---

### Paso 8 — Configurar Gunicorn como servicio automático

```bash
# Copiar el archivo de servicio incluido en el proyecto
cp /var/www/juan-chupe-erp/infra/systemd/gunicorn.service /etc/systemd/system/gunicorn.service

# Activar e iniciar
systemctl daemon-reload
systemctl enable gunicorn
systemctl start gunicorn

# Verificar que esté corriendo
systemctl status gunicorn
# Debe decir "active (running)"
```

---

### Paso 9 — Configurar Nginx

```bash
# Copiar la configuración de Nginx incluida en el proyecto
cp /var/www/juan-chupe-erp/infra/nginx/default.conf /etc/nginx/sites-available/juanchupe

# Editar y poner tu IP o dominio
nano /etc/nginx/sites-available/juanchupe
# Cambia: server_name _;
# Por:    server_name IP_DEL_SERVIDOR;  (o tudominio.com si tienes dominio)

# Activar el sitio
ln -s /etc/nginx/sites-available/juanchupe /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# Verificar y aplicar
nginx -t
systemctl reload nginx
```

---

### Paso 10 — SSL gratuito con Let's Encrypt (solo si tienes dominio)

```bash
apt install -y certbot python3-certbot-nginx

# Reemplaza con tu dominio real
certbot --nginx -d tudominio.com -d www.tudominio.com
```

Certbot configura HTTPS automáticamente. El certificado se renueva solo.

---

### Paso 11 — Configurar firewall

```bash
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw enable
```

✅ El sistema ya está en línea en `http://IP_DEL_SERVIDOR`

---

## Actualizaciones: cómo subir cambios nuevos

Cuando hagas cambios en el código y quieras actualizarlos en producción:

**Desde tu computador:**
```powershell
git add .
git commit -m "descripción del cambio"
git push origin main
```

**Luego:**

- **Si usas Vercel + Railway**: los cambios se despliegan automáticamente al hacer `git push` ✨
- **Si usas VPS**: conéctate al servidor y ejecuta:

```bash
ssh root@IP_DEL_SERVIDOR
cd /var/www/juan-chupe-erp
bash infra/scripts/deploy.sh
```

El script hace todo: descarga el código nuevo, migra la BD, recompila el frontend y reinicia los servicios.

---

## Limpiar datos de prueba antes de salir en vivo

Cuando el sistema esté en la nube y quieras borrar los datos de prueba:

**En Railway/Render:** desde el panel → tu servicio → **Run Command**:
```
cd backend && python manage.py reset_operational_data --confirmar
```

**En VPS:** conectado al servidor:
```bash
cd /var/www/juan-chupe-erp/backend
source ../venv/bin/activate
python manage.py reset_operational_data --confirmar
```

---

## Comparativa de opciones

| | Vercel + Railway | VPS Hetzner |
|--|--|--|
| **Dificultad** | ⭐ Fácil | ⭐⭐⭐ Técnico |
| **Costo mensual** | $5–10 | €3.79 |
| **Dominio gratis** | ✅ Sí (vercel.app) | ❌ Solo IP |
| **Deploys automáticos** | ✅ Sí (git push) | ❌ Manual |
| **Control total** | ❌ Limitado | ✅ Total |
| **Copias de seguridad BD** | ✅ Automáticas | ❌ Manual |
| **Escalar si crece** | ✅ Fácil | ⭐⭐ Posible |

**Recomendación:** empieza con **Vercel + Railway** para salir rápido. Si el negocio crece o quieres reducir costos, migra al VPS.

---

## Preguntas frecuentes

**¿Necesito dominio propio?**
No. Tanto Vercel como Railway te dan dominios gratuitos (`*.vercel.app`, `*.railway.app`) que funcionan perfectamente. Si quieres un dominio como `juanchupe.com`, cuesta ~$12/año.

**¿Qué pasa si se va la luz en el servidor?**
En Vercel y Railway los servidores son de ellos — no les afecta tu luz. En un VPS, el servidor sigue corriendo independientemente.

**¿Se pierden los datos si el servidor se reinicia?**
No. Los datos están en PostgreSQL que persiste en disco. Un reinicio del servicio no borra nada.

**¿Cómo hago copia de seguridad de los datos?**
En Railway: automático (Railway hace backups diarios en el plan pagado).
En VPS: ejecuta periódicamente:
```bash
pg_dump -U juanchupe_user juanchupe_db > backup_$(date +%Y%m%d).sql
```

**¿Puedo probarlo gratis antes de pagar?**
Sí. Railway tiene un plan gratuito con $5 de crédito mensual que es suficiente para pruebas. Vercel es siempre gratis para proyectos pequeños.

---

*Última actualización: julio 2026*
