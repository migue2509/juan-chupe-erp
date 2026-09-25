# Guia de despliegue - Juan Chupe ERP

Fecha de referencia de costos: 2026-09-25.

Esta guia explica como desplegar el frontend y el backend del sistema, que se debe pagar, como funciona el almacenamiento y que opcion conviene mas para este proyecto.

Los precios pueden cambiar, no incluyen impuestos y pueden variar segun pais, moneda, consumo real, banco y proveedor.

Conversion usada como referencia:

- 1 USD = COP 3.329,61 segun TRM vigente del 2026-09-25.
- 1 EUR = COP 3.810 aproximadamente, tomado como referencia de mercado medio.

Para presupuestar en Colombia conviene redondear hacia arriba, porque la tarjeta, el banco, impuestos o comisiones pueden cambiar el valor final.

## Resumen del sistema

Juan Chupe ERP tiene dos partes principales:

- **Frontend:** aplicacion React con Vite. Se compila como archivos estaticos en `frontend/dist`.
- **Backend:** API Django con Django REST Framework, autenticacion JWT, PostgreSQL y archivos media en `backend/media`.

En desarrollo local el frontend usa el proxy de Vite para comunicarse con `http://localhost:8000/api`. En produccion se debe configurar la variable `VITE_API_URL` para apuntar al backend real.

## Volumen esperado del negocio

El negocio esta en Colombia y cobra en pesos colombianos. Segun el uso esperado:

- dias de semana: 60 o mas ventas diarias;
- fines de semana: alrededor de 150 facturas por fin de semana.

Este volumen no exige una infraestructura grande al inicio, pero si exige tratar el sistema como produccion real. Lo importante no es solo soportar la cantidad de facturas, sino proteger ventas, jornadas, inventario, gastos, usuarios y cierres de caja.

## Recomendacion corta

Para este proyecto recomendaria una de estas dos rutas:

1. **VPS todo en uno si quieres pagar menos y tener control:** frontend, backend, PostgreSQL y media en un servidor propio. Es la opcion mas economica a largo plazo, pero exige administrar Linux, Nginx, backups y seguridad.
2. **Vercel + Railway si quieres facilidad:** frontend en Vercel y backend/PostgreSQL en Railway. Es mas simple de operar, pero cuesta mas y hay que controlar el uso.

Si el sistema va a manejar ventas reales del negocio, no usaria planes gratuitos para produccion.

## Como funciona el almacenamiento

### Frontend

El frontend no guarda datos del negocio. Cuando se ejecuta:

```bash
npm run build
```

Vite genera archivos HTML, CSS y JavaScript dentro de `frontend/dist`. Esos archivos se pueden servir desde Vercel, Netlify, Nginx o cualquier hosting de archivos estaticos.

Si se borra el frontend compilado, se puede volver a generar desde el codigo fuente.

### Base de datos

La base de datos PostgreSQL guarda la informacion critica:

- usuarios;
- productos;
- inventario;
- compras;
- ventas;
- jornadas;
- gastos;
- promociones;
- clientes;
- domicilios;
- configuraciones del negocio.

Esta es la parte que mas se debe proteger. Debe tener persistencia, backups y credenciales seguras.

### Archivos media

Actualmente Django guarda los archivos subidos en:

```text
backend/media
```

Segun el codigo actual, estos archivos se sirven con:

```python
MEDIA_URL = '/media/'
MEDIA_ROOT = BASE_DIR / 'media'
```

Esto funciona bien en local o en un VPS, siempre que el disco sea persistente y tenga backups.

En plataformas tipo PaaS, los archivos locales pueden perderse si el contenedor se reinicia, se redepliega o no tiene volumen persistente. Para produccion estable, los media deberian ir a una de estas opciones:

- disco persistente del servidor o volumen del proveedor;
- almacenamiento de objetos como Cloudflare R2, DigitalOcean Spaces o S3 compatible.

El proyecto todavia no tiene configurado almacenamiento de objetos en Django, asi que si se elige R2/S3/Spaces habria que desarrollar esa integracion.

## Opcion A: VPS todo en uno

Esta opcion usa un servidor Linux para ejecutar todo:

- Nginx sirve el frontend compilado;
- Gunicorn ejecuta Django;
- PostgreSQL vive en el mismo servidor;
- Nginx sirve `/static/` y `/media/`;
- Certbot o el proveedor gestionan HTTPS;
- backups programados protegen la base de datos y los archivos media.

El proyecto ya trae archivos que apuntan a este tipo de despliegue:

- `infra/nginx/default.conf`
- `infra/systemd/gunicorn.service`

### Costos aproximados

Opciones de entrada:

- Hetzner CX23 en Europa: desde aproximadamente **EUR 5.49/mes**, cerca de **COP 21.000/mes** antes de impuestos y comisiones.
- DigitalOcean Basic Droplet de 2 GB: desde aproximadamente **USD 12/mes**, cerca de **COP 40.000/mes** antes de impuestos y comisiones.
- DigitalOcean Basic Droplet de USD 6/mes: cerca de **COP 20.000/mes**, pero lo dejaria solo para pruebas o cargas muy pequenas.

Costos adicionales recomendables:

- backups del proveedor o snapshots;
- dominio;
- posible almacenamiento externo si los archivos media crecen.
- margen para comisiones, impuestos y variacion de tasa de cambio.

Para este negocio, presupuestaria una VPS entre **COP 25.000 y COP 60.000/mes** dependiendo del proveedor, backups y margen de conversion.

### Ventajas

- Costo mensual bajo y predecible.
- Control completo del servidor.
- Los archivos media pueden vivir en el disco del servidor.
- La arquitectura coincide con los archivos `infra` que ya existen en el proyecto.

### Desventajas

- Hay que administrar el servidor.
- Hay que configurar firewall, HTTPS, backups y actualizaciones.
- Si el servidor falla y no hay backups, se puede perder informacion.

### Pasos generales de despliegue

1. Crear un VPS Ubuntu.
2. Instalar Python, Node.js, PostgreSQL, Nginx y dependencias del sistema.
3. Crear la base de datos PostgreSQL.
4. Copiar el proyecto al servidor.
5. Crear el archivo de variables de entorno del backend.
6. Instalar dependencias del backend.
7. Ejecutar migraciones y `collectstatic`.
8. Compilar el frontend.
9. Configurar Gunicorn con systemd.
10. Configurar Nginx.
11. Activar HTTPS.
12. Configurar backups.

### Variables del backend

En produccion el backend debe usar un `.env` similar a este:

```env
SECRET_KEY=clave-secreta-larga-y-unica
DEBUG=False
ALLOWED_HOSTS=api.tudominio.com,tudominio.com,IP_DEL_SERVIDOR
DB_NAME=juanchupe_db
DB_USER=juanchupe_user
DB_PASSWORD=password_seguro
DB_HOST=localhost
DB_PORT=5432
CORS_ALLOWED_ORIGINS=https://tudominio.com,https://www.tudominio.com
```

No se debe reutilizar la `SECRET_KEY` de desarrollo.

### Comandos base del backend

Desde `backend`:

```bash
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python manage.py migrate
python manage.py collectstatic --noinput
python manage.py createsuperuser
```

### Comandos base del frontend

Desde `frontend`:

```bash
npm install
npm run build
```

Si el backend queda en `https://api.tudominio.com`, configurar:

```env
VITE_API_URL=https://api.tudominio.com
```

El cliente del frontend ya normaliza la URL y agrega `/api` cuando corresponde.

## Opcion B: Vercel + Railway

Esta opcion separa responsabilidades:

- Vercel sirve el frontend.
- Railway ejecuta Django.
- Railway aloja PostgreSQL.
- Los media se deben manejar con volumen persistente o almacenamiento externo.

### Costos aproximados

Vercel:

- Hobby: gratis, pensado para uso personal y no comercial.
- Pro: aproximadamente **USD 20/mes**, cerca de **COP 67.000/mes** antes de impuestos y comisiones.

Railway:

- Free: USD 0/mes con credito muy limitado.
- Hobby: **USD 5/mes**, cerca de **COP 17.000/mes**, incluye USD 5 de uso.
- Pro: **USD 20/mes**, cerca de **COP 67.000/mes**.

Railway cobra recursos por consumo. Como referencia:

- RAM: aproximadamente USD 10 por GB/mes, cerca de COP 33.000.
- CPU: aproximadamente USD 20 por vCPU/mes, cerca de COP 67.000.
- egress de red: aproximadamente USD 0.05 por GB, cerca de COP 170.
- volumen: aproximadamente USD 0.15 por GB/mes, cerca de COP 500.

Para un negocio real, el punto de entrada razonable seria:

- Vercel Pro: USD 20/mes, cerca de COP 67.000.
- Railway Hobby: desde USD 5/mes mas consumo, cerca de COP 17.000 base.

Total inicial estimado: desde **USD 25/mes mas consumo**, cerca de **COP 83.000/mes**, sin contar dominio, impuestos, comisiones ni almacenamiento externo.

Para presupuestar con margen en Colombia, calcularia esta opcion entre **COP 90.000 y COP 150.000/mes** al inicio.

### Ventajas

- Menos administracion de servidor.
- Despliegues mas simples.
- HTTPS, builds y variables de entorno son mas faciles de manejar.
- Buen camino si se quiere mover rapido.

### Desventajas

- Costo mensual mayor que un VPS pequeno.
- Hay que vigilar el consumo.
- Los archivos media requieren una decision clara de almacenamiento.
- Si el proyecto crece, probablemente haya que subir de plan.

### Backend en Railway

Configuracion recomendada:

1. Crear un proyecto en Railway.
2. Crear un servicio PostgreSQL.
3. Crear un servicio para el backend Django.
4. Configurar el directorio raiz del backend si Railway lo requiere.
5. Agregar variables de entorno.
6. Ejecutar migraciones.
7. Configurar dominio propio si aplica.

Variables necesarias:

```env
SECRET_KEY=clave-secreta-larga-y-unica
DEBUG=False
ALLOWED_HOSTS=nombre-del-backend.up.railway.app,api.tudominio.com
DB_NAME=...
DB_USER=...
DB_PASSWORD=...
DB_HOST=...
DB_PORT=5432
CORS_ALLOWED_ORIGINS=https://frontend.vercel.app,https://tudominio.com
```

Railway normalmente entrega las credenciales de PostgreSQL desde sus variables de entorno. Hay que mapearlas a los nombres que espera `backend/config/settings.py`.

### Frontend en Vercel

Configuracion recomendada:

- Framework: Vite.
- Root directory: `frontend`.
- Build command: `npm run build`.
- Output directory: `dist`.

Variable de entorno:

```env
VITE_API_URL=https://nombre-del-backend.up.railway.app
```

Cuando se configure dominio propio, cambiarla por:

```env
VITE_API_URL=https://api.tudominio.com
```

### Media en Railway

Para archivos subidos por usuarios o generados por el sistema, no conviene depender de almacenamiento temporal.

Opciones:

1. Usar volumen persistente en Railway para `/media`.
2. Implementar almacenamiento de objetos con Cloudflare R2, DigitalOcean Spaces o S3 compatible.

Si se usa volumen, hay que confirmar que `MEDIA_ROOT` apunte al path montado por Railway.

Si se usa almacenamiento de objetos, hay que agregar soporte en Django con una libreria como `django-storages` y configurar credenciales.

## Opcion C: Render

Render tambien puede servir para desplegar Django y PostgreSQL, pero no recomendaria su capa gratuita para produccion.

Puntos importantes:

- Los servicios web gratuitos pueden dormirse por inactividad.
- El filesystem gratuito es efimero.
- PostgreSQL gratuito tiene limites fuertes y no es una base confiable para operacion real.

Render puede funcionar en planes pagos, pero para este proyecto elegiria antes VPS o Vercel + Railway.

## Almacenamiento externo recomendado

Si los archivos media empiezan a crecer o se quiere separar el backend del almacenamiento, las dos opciones mas claras son:

### Cloudflare R2

- Tiene capa gratuita para bajo uso.
- El almacenamiento estandar ronda USD 0.015 por GB/mes, cerca de COP 50 por GB/mes.
- No cobra egress hacia internet.
- Es buena opcion para imagenes, comprobantes, archivos subidos y media del sistema.

### DigitalOcean Spaces

- Costo base aproximado de USD 5/mes, cerca de COP 17.000/mes.
- Incluye una cantidad amplia de almacenamiento y transferencia.
- Es simple si tambien se usa DigitalOcean para el servidor.

Para este proyecto, si se usa VPS y el volumen de archivos es pequeno, empezaria con disco local mas backups. Si despues los media crecen o se busca mas robustez, migraria a Cloudflare R2.

## Comparacion rapida

| Opcion | Costo inicial aproximado | Dificultad | Recomendacion |
| --- | ---: | --- | --- |
| VPS Hetzner todo en uno | EUR 5.49/mes, cerca de COP 21.000/mes | Media | Mejor costo y control |
| VPS DigitalOcean 2 GB | USD 12/mes, cerca de COP 40.000/mes | Media | Mas simple que Hetzner, mas caro |
| Vercel + Railway | Desde USD 25/mes, cerca de COP 83.000/mes mas consumo | Baja | Mejor facilidad |
| Render free | USD 0/mes | Baja | No recomendado para produccion |
| Render pago | Variable | Baja/media | Alternativa valida, no primera opcion |

## Cual recomendaria pagar

Para Juan Chupe ERP recomendaria pagar **un VPS pequeno con backups activados** si el objetivo es reducir costos y tener una operacion estable.

Motivo:

- el sistema necesita base de datos persistente;
- las ventas, jornadas e inventario no deben depender de planes gratuitos;
- el proyecto ya tiene configuracion para Nginx y Gunicorn;
- el costo mensual es bajo;
- los archivos media pueden vivir inicialmente en el mismo servidor;
- se puede crecer despues a almacenamiento externo.

Con el volumen actual de 60 o mas ventas diarias y picos de fin de semana, mi recomendacion concreta seria:

1. **Hetzner CX23 + backups** si se quiere el menor costo mensual. Presupuesto base: cerca de **COP 25.000 a COP 45.000/mes** con margen.
2. **DigitalOcean 2 GB + backups** si se quiere una experiencia mas amigable aunque cueste mas. Presupuesto base: cerca de **COP 45.000 a COP 70.000/mes** con margen.

Si prefieres facilidad sobre costo, pagaria:

- **Vercel Pro** para el frontend, porque el proyecto es comercial;
- **Railway Hobby o Pro** para backend y PostgreSQL;
- **Cloudflare R2** si los archivos media se vuelven importantes.

En ese caso presupuestaria desde **COP 90.000 a COP 150.000/mes** al inicio.

## Checklist antes de produccion

Antes de poner el sistema en uso real, revisaria estos puntos:

- `DEBUG=False`.
- `SECRET_KEY` nueva y segura.
- `ALLOWED_HOSTS` con dominios reales.
- `CORS_ALLOWED_ORIGINS` solo con dominios del frontend.
- HTTPS activo.
- Backups automaticos de PostgreSQL.
- Backup de `backend/media`.
- Logs del backend configurados.
- Usuario administrador creado.
- Migraciones ejecutadas.
- `collectstatic` ejecutado.
- Variables de correo configuradas si se usaran notificaciones.
- Revisar configuracion segura de cookies y HTTPS en Django.
- Probar login, ventas, cierre de jornada, inventario, compras, gastos y reportes en el entorno desplegado.

## Fuentes consultadas

- Vercel Plans: https://vercel.com/docs/plans
- Vercel Pro Plan: https://vercel.com/docs/plans/pro-plan
- Vercel Hobby Plan: https://vercel.com/docs/plans/hobby
- Railway Pricing: https://docs.railway.com/pricing/plans
- Railway Storage Buckets Billing: https://docs.railway.com/storage-buckets/billing
- Render Free Plans: https://render.com/docs/free
- Render Pricing: https://render.com/pricing
- Hetzner price adjustment: https://docs.hetzner.com/general/infrastructure-and-availability/price-adjustment/
- DigitalOcean Droplets: https://www.digitalocean.com/products/droplets
- DigitalOcean Spaces pricing: https://www.digitalocean.com/pricing/spaces-object-storage
- Cloudflare R2 pricing: https://developers.cloudflare.com/r2/pricing/
- TRM Superfinanciera: https://www.superfinanciera.gov.co/publicaciones/10115773/market-representative-exchange-rate-trm/
- API publica Dolar en Colombia: https://dolarencolombia.co/api-publica
- Wise EUR/COP: https://wise.com/us/currency-converter/eur-to-cop-rate
