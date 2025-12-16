# Configuración Permanente - IA EDC Connector

## ⚠️ CAMBIOS CRÍTICOS - NO REVERTIR

Este documento describe los cambios críticos que **DEBEN mantenerse** para evitar errores CORS y de funcionamiento.

### 1. CORS Configuration (backend/src/server-edc.js)

**✅ MANTENER:** Configuración de CORS con múltiples orígenes

```javascript
const allowedOrigins = [
  'http://localhost:4200',
  'http://127.0.0.1:4200',
  'http://localhost:3000',
  'http://127.0.0.1:3000'
];

const corsOptions = {
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    // ... validación dinámica de origen
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
  exposedHeaders: ['Content-Range', 'X-Content-Range'],
  maxAge: 86400,
  optionsSuccessStatus: 204
};
```

**❌ NO USAR:**
```javascript
// INCORRECTO - causa problemas CORS
origin: 'http://localhost:4200'  // Solo un string
```

### 2. HttpClient Configuration (src/app/app.config.ts)

**✅ MANTENER:**
```typescript
provideHttpClient(
  withInterceptors([authInterceptor])
)
```

**❌ NO USAR:**
```typescript
// INCORRECTO - withFetch causa problemas CORS en algunos navegadores
provideHttpClient(
  withFetch(),  // ← REMOVER ESTO
  withInterceptors([authInterceptor])
)
```

### 3. Contracts Component (src/app/pages/contracts/contracts.component.ts)

**✅ MANTENER:** Uso de `assetIds`
```typescript
@if (contract.assetIds && contract.assetIds.length > 0) {
  @for (assetId of contract.assetIds; track assetId) {
    <mat-chip>{{ assetId }}</mat-chip>
  }
}
```

**❌ NO USAR:**
```typescript
// INCORRECTO - el backend retorna assetIds, no assets
@if (contract.assets && contract.assets.length > 0) {
  @for (asset of contract.assets; track asset.asset_id) {
    <mat-chip>{{ asset.asset_id }}</mat-chip>
  }
}
```

### 4. Management API Extension (backend/edc-extensions/management-api/extension.manifest.js)

**✅ MANTENER:** Handler explícito de OPTIONS
```javascript
// CORS preflight handler - ensure OPTIONS requests are handled
router.options('*', (req, res) => {
  res.status(204).end();
});
```

**❌ NO REMOVER:** Este handler es crítico para CORS preflight

### 5. Backend Startup

**✅ USAR:** Script automatizado
```bash
cd /home/edmundo/IAModelHub/IAModelHub_EDCUI/ml-browser-app
./start-application.sh
```

**Orden correcto si se inicia manualmente:**
1. Docker (PostgreSQL + MinIO)
2. Backend (puerto 3000)
3. Frontend (puerto 4200)

**❌ NO HACER:**
- Iniciar frontend antes que backend
- Olvidar iniciar Docker containers
- Usar `ng serve` sin verificar que el backend esté corriendo

## 🔒 Archivos Críticos - Protegidos

Los siguientes archivos contienen configuraciones críticas que NO deben modificarse sin verificar:

1. `backend/src/server-edc.js` - CORS configuration
2. `src/app/app.config.ts` - HttpClient configuration  
3. `src/app/pages/contracts/contracts.component.ts` - Template assetIds
4. `backend/edc-extensions/management-api/extension.manifest.js` - OPTIONS handler

## ✅ Verificación Post-Cambio

Si modificas alguno de estos archivos, verifica:

```bash
# 1. Reiniciar backend
cd /home/edmundo/IAModelHub/IAModelHub_Extensiones/backend
pkill -f "node.*server-edc.js"
node src/server-edc.js

# 2. Verificar CORS
curl -I -X OPTIONS http://localhost:3000/auth/login \
  -H "Origin: http://localhost:4200" | grep "Access-Control"

# 3. Probar login
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"user-conn-oeg-demo","password":"a!ulzZ5dJvLJSzvM"}'

# 4. Reiniciar frontend
cd /home/edmundo/IAModelHub/IAModelHub_EDCUI/ml-browser-app
pkill -f "ng serve"
npm run start
```

## 🚨 Síntomas de Problemas

Si aparecen estos errores, verifica los cambios críticos:

| Error | Causa Probable | Archivo a Revisar |
|-------|----------------|-------------------|
| "Failed to fetch" | CORS mal configurado | `backend/src/server-edc.js` |
| CORS blocked | Origin no permitido | `backend/src/server-edc.js` |
| "No assets associated" | Template usa `assets` en vez de `assetIds` | `contracts.component.ts` |
| OPTIONS 404 | Falta handler OPTIONS | `extension.manifest.js` |

## 📝 Notas Adicionales

- **CORS_ORIGIN env variable**: Si se define, se agrega a la lista de orígenes permitidos
- **withFetch()**: Incompatible con algunas configuraciones CORS, mantener removido
- **MaxAge 86400**: Cachea preflight CORS por 24 horas para mejor performance

---

**Última actualización:** 2025-12-12  
**Estado:** ✅ Todos los cambios aplicados y verificados  
**Commit:** c93a8d6
