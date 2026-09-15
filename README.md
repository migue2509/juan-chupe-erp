# Juan Chupe ERP

Sistema web para digitalizar y administrar la operación diaria de Juan Chupe Granizados.

El proyecto nació para reemplazar un proceso manual en papel por una herramienta centralizada para ventas, jornadas, inventario, caja, domicilios, facturación, reportes, asistencia y nómina.

## Demo

Estado: no disponible aún.

Espacio reservado para demo del proyecto:

- URL de la aplicación:
- Video demo:
- Capturas principales:

## Descripción

Juan Chupe ERP permite controlar la operación completa de una tienda de granizados desde una sola aplicación. El sistema organiza el flujo diario desde la apertura de jornada hasta el cierre de caja, conectando ventas, inventario, gastos, domicilios y reportes.

El objetivo principal es reducir registros manuales, evitar inconsistencias operativas y mantener trazabilidad sobre el dinero, los productos vendidos y el stock disponible.

## Funcionalidades Principales

- Apertura y cierre de jornadas operativas.
- Punto de venta para registrar ventas de granizados, toppings, promociones y cortesías.
- Control automático de inventario por vasos, sabores y toppings.
- Facturación automática por cada venta.
- Anulación de facturas con devolución de inventario.
- Gestión de domicilios, estados y domiciliarios.
- Arqueo de caja por POS y domicilios.
- Cuadre de dinero entregado por vendedora.
- Registro de gastos y compras.
- Reportes diarios, semanales, mensuales, por rango y por plataformas.
- Mapa de domicilios y puntos de calor.
- Gestión de usuarios, roles y permisos.
- Control de asistencia y nómina básica.
- Configuración de métodos de transferencia y QR de pago.

## Módulos Del Sistema

| Módulo | Descripción |
| --- | --- |
| Dashboard | Estado de jornada, ventas del día, gastos, alertas de stock y resumen operativo. |
| POS | Registro de ventas, sabores, vasos, toppings, promociones, cortesías y pagos. |
| Facturación | Consulta de facturas, filtros, detalle de venta y anulación administrativa. |
| Domicilios | Seguimiento de pedidos, estados, domiciliarios y datos de entrega. |
| Gastos | Registro de gastos por origen, categoría, medio de pago y afectación de caja. |
| Jornadas | Apertura, cierre y detalle financiero de cada día operativo. |
| Productos | Administración de sabores, tamaños de vaso, productos y toppings. |
| Inventario | Stock de bolsas, vasos y toppings, entradas, ajustes y movimientos. |
| Promociones | Promociones POS, Rappi y DiDi con cálculo proporcional y comisión. |
| Arqueo | Validación de efectivo, transferencias, inventario vendido y entregas por vendedora. |
| Reportes | Reportes financieros, comerciales, de inventario y de plataformas. |
| Mapa | Visualización de domicilios con coordenadas y mapa de calor. |
| Usuarios | Administración de usuarios, roles, contraseñas y estado de cuenta. |
| Asistencia | Registro de entrada, salida, horas trabajadas y métricas por empleada. |
| Nómina | Horarios laborales, tarifas por día, días trabajados y pagos. |
| Configuración POS | Métodos de transferencia, cuentas y códigos QR de pago. |

## Reglas De Negocio Relevantes

- Solo puede existir una jornada activa a la vez.
- Una venta solo puede registrarse si existe una jornada activa.
- Cada venta genera una factura automáticamente.
- Las facturas anuladas no cuentan para caja, reportes ni ventas activas.
- Al anular una factura se devuelve el inventario consumido.
- Los domicilios cancelados no cuentan como ventas activas.
- El cierre de jornada requiere arqueo POS.
- Si existen domicilios activos, el cierre requiere arqueo de domicilios.
- El efectivo POS debe coincidir con la suma entregada por las vendedoras.
- Los gastos pueden afectar o no afectar la caja diaria.
- Los gastos se separan por origen: POS o domicilios.
- Las ventas pueden ser en efectivo, transferencia o pago mixto.
- Las cortesías registran el valor pagado y generan gasto por la parte no cobrada.
- El consumo de sabores se calcula en mililitros y se divide entre los sabores seleccionados.
- Los vasos, sabores y toppings se descuentan automáticamente al vender.
- El topping automático solo se descuenta cuando todos los sabores del vaso pertenecen a la misma categoría vinculada.
- Las promociones calculan precio unitario proporcional.
- Las promociones de plataforma separan valor bruto, comisión y valor neto.
- El cambio de precio de un vaso desactiva promociones activas vinculadas.

## Stack Tecnológico

**Frontend**

- React 18
- Vite
- Tailwind CSS
- React Router
- Recharts

**Backend**

- Django 4.2
- Django REST Framework
- Simple JWT
- Django Filter

**Base de datos**

- PostgreSQL

**Infraestructura**

- Gunicorn
- Nginx
- VPS Ubuntu

## Arquitectura General

El sistema está dividido en dos aplicaciones principales:

- `frontend`: aplicación React encargada de la interfaz de usuario.
- `backend`: API Django encargada de reglas de negocio, datos, autenticación y operaciones críticas.

La API expone los módulos del sistema bajo `/api/` y el frontend consume esos endpoints desde una configuración centralizada.

## Ejecución Local

### Requisitos

- Python 3.11 o superior.
- Node.js 18 o superior.
- PostgreSQL 15 o superior.

### Backend

```bash
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
python manage.py migrate
python manage.py shell < ../scripts/seed_data.py
python manage.py runserver
```

Backend disponible en:

```text
http://localhost:8000
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend disponible en:

```text
http://localhost:5173
```

## Variables De Entorno

El backend utiliza variables de entorno para configurar la base de datos, seguridad, CORS y servicios externos.

Archivo base:

```text
backend/.env.example
```

Variables principales:

```text
SECRET_KEY=
DEBUG=
ALLOWED_HOSTS=
DB_NAME=
DB_USER=
DB_PASSWORD=
DB_HOST=
DB_PORT=
CORS_ALLOWED_ORIGINS=
```

El frontend puede configurar la URL del backend con:

```text
VITE_API_URL=
```

Si no se define, el frontend usa `/api` para trabajar con el proxy local de Vite.

## Comandos Útiles

### Backend

```bash
python manage.py check
python manage.py makemigrations
python manage.py migrate
python manage.py test
```

### Frontend

```bash
npm run dev
npm run build
npm run preview
```

## Despliegue

El proyecto incluye archivos de infraestructura para despliegue en VPS con Gunicorn y Nginx.

También puede adaptarse a un despliegue separado, con frontend en un servicio estático y backend en un servicio Python, configurando correctamente `VITE_API_URL`, `ALLOWED_HOSTS` y `CORS_ALLOWED_ORIGINS`.

## Estado Del Proyecto

El sistema cuenta con los módulos principales implementados y se encuentra en proceso de mejora continua, especialmente en validaciones de negocio, pruebas automatizadas, consistencia de caja, control de jornadas y preparación para despliegue.

## Autoría

Desarrollador: Miguel Ospina (OPIA SYSTEMS).
