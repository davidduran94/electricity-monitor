# Integración Tesla Fleet API (fase inicial)

Esta fase añade endpoints de solo lectura. No envía comandos ni despierta el vehículo.

## Configuración
1. Registra una aplicación en el portal oficial Tesla Developer y completa los requisitos de Fleet API.
2. Autoriza tu propia cuenta mediante el flujo OAuth de Tesla y obtén un access token con permiso de datos del vehículo.
3. Configura `TESLA_ACCESS_TOKEN`, `TESLA_VIN` y opcionalmente `TESLA_FLEET_API_BASE_URL` como secretos del proyecto en Vercel.
4. Redeploy y consulta `/api/tesla/status` y `/api/tesla/charge`.

**Importante:** El token temporal caduca; la integración de producción debe implementar OAuth Authorization Code + PKCE, refresh tokens cifrados y sesiones autenticadas. Estos endpoints no deben exponerse públicamente con un token real: añade autenticación de usuario antes de habilitar la integración. No guardes tokens en Git ni en localStorage.

Los datos de carga de Tesla no equivalen a la energía facturada por CFE. No se realizan cálculos de costo automático.

## Seguridad
Los endpoints no devuelven credenciales ni VIN completo. Antes de configurar un token real en producción, protege las rutas con autenticación; el código inicial es un scaffold de desarrollo.
