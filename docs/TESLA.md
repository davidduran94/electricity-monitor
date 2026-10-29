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

## Vista de cargas

La sección «Última lectura de carga» consulta `vehicle_data_cached` al pulsar el botón. Presenta el timestamp del coche, energía añadida en la sesión reportada, batería, potencia y autonomía convertida de millas a kilómetros. No hace polling, no despierta el coche y no convierte una lectura en un registro histórico.

«Últimas cargas de Tesla» consulta `GET /api/1/dx/charging/history`, filtrado por el VIN que el servidor resuelve a partir de un vehículo de la sesión. Devuelve páginas de 20 eventos y únicamente campos de presentación. Las fechas, energía, importe o moneda ausentes se muestran como no disponibles. Las unidades de energía no explícitas no se adivinan.

El permiso `vehicle_charging_cmds` se solicita solo mediante «Autorizar historial en Tesla». Tesla incluye el historial y los controles en ese mismo permiso; la aplicación no implementa comandos. Puede ser necesario habilitar el permiso en Tesla Developer y volver a consentir. Los tokens actuales siguen funcionando para la lectura de datos del vehículo.

El historial que devuelva Tesla no se presenta como completo ni se mezcla con las cargas manuales en casa o los totales CFE. No se implementa `charging/sessions`, reservado a propietarios empresariales de flotas.

El consumo al conducir (Wh/km y kWh por trayecto) y un historial completo de carga en casa necesitan una fuente persistente: importación de un registrador existente o un receptor Fleet Telemetry que guarde energía y distancia durante los trayectos. Esta versión no tiene esa fuente, no reconstruye trayectos pasados ni calcula consumo a partir de caídas del porcentaje de batería.

Validación local: `node --test scripts/tesla-charging.test.mjs scripts/tesla-partner.test.mjs`, `npx tsc --noEmit` y `npm run build`. La respuesta real del historial requiere la sesión y el consentimiento del propietario; los ejemplos de prueba son sintéticos.

Fuentes: [historial de carga](https://developer.tesla.com/docs/fleet-api/endpoints/charging-endpoints), [datos guardados del vehículo](https://developer.tesla.com/docs/fleet-api/endpoints/vehicle-endpoints), [permisos](https://developer.tesla.com/docs/fleet-api/authentication/overview), [Fleet Telemetry](https://developer.tesla.com/docs/fleet-api/fleet-telemetry).
