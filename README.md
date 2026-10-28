# Electricity Monitor

Dashboard para registrar recibos bimestrales CFE y cargas del Tesla Model 3 en casa.

## Ejecutar

```bash
npm install
npm run dev
```

Abre http://localhost:3000.

## Estado

MVP: registro manual de recibos y cargas, gráficas y exportación JSON. Los datos se guardan en localStorage del navegador; no hay sincronización entre dispositivos. No está conectado a CFE ni a Tesla y no debe tratarse como lectura de consumo en tiempo real.

Próximas fases: importación PDF, PostgreSQL, autenticación e integración oficial Tesla Fleet API con secretos del lado servidor.
