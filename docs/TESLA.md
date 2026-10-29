# Integración Tesla Fleet API

El dashboard usa OAuth Authorization Code, cookies HttpOnly cifradas con AES-256-GCM y renovación de tokens. Solicita `openid offline_access vehicle_device_data`: no envía comandos ni despierta el vehículo. Los registros manuales de energía y costo se conservan en el navegador y no se sustituyen por datos del vehículo.

## Configuración

- En Vercel: `TESLA_CLIENT_ID`, `TESLA_CLIENT_SECRET` y `TESLA_SESSION_SECRET` (64 caracteres hexadecimales aleatorios). Los tres ya existen en producción y preview.
- En Tesla Developer: origen `https://electricity-monitor-smoky.vercel.app` y callback `https://electricity-monitor-smoky.vercel.app/login`.
- El origen Fleet API de Norteamérica es `https://fleet-api.prd.na.vn.cloud.tesla.com`, sin barra final.
- La clave P-256 existente debe responder HTTP 200 sin autenticación en `/.well-known/appspecific/com.tesla.3p.public-key.pem`. No reemplazar la pareja de claves existente.

## Diagnóstico y registro

Ejecutar con las credenciales en el entorno, sin pegarlas en comandos ni compartirlas en chats:

```sh
node scripts/register-tesla-partner.mjs --check-token
node scripts/register-tesla-partner.mjs --check
node scripts/register-tesla-partner.mjs
node --test scripts/tesla-partner.test.mjs
```

`--check-token` solamente obtiene y descarta un Partner Token; `--check` además valida el acceso anónimo y la curva de la clave. Sin opciones, registra el dominio después de comparar la clave alojada con la revisada en este repositorio. Si existe `TESLA_PARTNER_PRIVATE_KEY` en el entorno, verifica también la pareja. La clave privada no se envía a Tesla y no hace falta recuperarla para registrar el dominio.

El scope es opcional para el Partner Token; el registro no solicita permisos de comandos. Los errores muestran HTTP y un código OAuth de una lista permitida, nunca el cuerpo completo de Tesla, tokens ni claves.

Después del registro, el propietario debe usar **Conectar Tesla** y aprobar el consentimiento en Tesla. El Partner Token sirve para registrar la aplicación; el token OAuth del usuario sirve para consultar su Model 3. No son intercambiables.

## Verificación del 29 de octubre de 2026

- Repositorio base: `4a23d177f48b6ef94cbc9ad2d56f9ba546cf6051`.
- Ambas solicitudes del Partner Token (con los scopes originales y sin scope) se obtuvieron correctamente usando los secretos existentes de preview en Vercel. El HTTP 400 anterior no se reprodujo; no hay evidencia para atribuirlo a los scopes.
- La URL pública de la clave respondió HTTP 302 hacia Vercel SSO: la protección `all` impide el acceso anónimo de Tesla. Requiere ajustar la protección antes de registrar el dominio.
- Los logs históricos del HTTP 400 exceden la retención del plan. No atribuir una causa definitiva a ese fallo sin reproducirlo.

Los datos Tesla no equivalen a energía facturada por CFE; no se calcula costo automáticamente. La sesión del usuario debe autorizar cada consulta y los endpoints no deben devolver tokens o VIN completos.
