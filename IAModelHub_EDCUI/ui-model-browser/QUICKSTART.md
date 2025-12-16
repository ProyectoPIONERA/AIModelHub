# IA EDC Connector - Quick Start Guide

## 🚀 Iniciar la Aplicación

### Opción 1: Usar el Script Automático (Recomendado)

```bash
cd /home/edmundo/IAModelHub/IAModelHub_EDCUI/ml-browser-app
./start-application.sh
```

Este script:
- ✅ Inicia PostgreSQL y MinIO (Docker)
- ✅ Detiene procesos anteriores
- ✅ Inicia el backend EDC (puerto 3000)
- ✅ Inicia el frontend Angular (puerto 4200)
- ✅ Verifica que todo esté funcionando

### Opción 2: Inicio Manual

```bash
# 1. Iniciar contenedores Docker
cd /home/edmundo/IAModelHub/IAModelHub_Extensiones
docker compose up -d postgres minio minio-setup

# 2. Iniciar Backend
cd /home/edmundo/IAModelHub/IAModelHub_Extensiones/backend
node src/server-edc.js

# 3. Iniciar Frontend (en otra terminal)
cd /home/edmundo/IAModelHub/IAModelHub_EDCUI/ml-browser-app
npm run start
```

## 🛑 Detener la Aplicación

```bash
cd /home/edmundo/IAModelHub/IAModelHub_EDCUI/ml-browser-app
./stop-application.sh
```

## 🌐 URLs de Acceso

- **Frontend:** http://localhost:4200
- **Backend API:** http://localhost:3000
- **Health Check:** http://localhost:3000/health
- **MinIO Console:** http://localhost:9001

## 🔐 Credenciales

### Usuario 1: OEG Demo
- Username: `user-conn-oeg-demo`
- Password: `a!ulzZ5dJvLJSzvM`

### Usuario 2: Edmundo Demo
- Username: `user-conn-edmundo-demo`
- Password: `D1S*ty@!UFTmr6U^`

## 🐛 Solución de Problemas

### Error: "Failed to fetch" en el login

Este error generalmente ocurre cuando:

1. **El backend no está corriendo**
   ```bash
   # Verificar si el backend está corriendo
   curl http://localhost:3000/health
   
   # Si falla, reiniciar el backend
   cd /home/edmundo/IAModelHub/IAModelHub_Extensiones/backend
   node src/server-edc.js
   ```

2. **CORS no está configurado correctamente**
   - ✅ **YA CORREGIDO:** El backend ahora tiene configuración completa de CORS
   - Los headers CORS incluyen: Origin, Methods, Headers, MaxAge
   - OPTIONS preflight requests están manejados explícitamente

3. **Cache del navegador**
   ```bash
   # Solución: Limpiar cache del navegador
   - Presiona Ctrl+Shift+R (forzar recarga)
   - O abre DevTools (F12) → Network → Disable cache
   ```

4. **Frontend compiló con errores**
   ```bash
   # Verificar logs del frontend
   tail -50 /home/edmundo/IAModelHub/IAModelHub_EDCUI/ml-browser-app/frontend.log
   
   # Buscar "✔ Compiled successfully"
   ```

### Verificar Estado de Servicios

```bash
# Verificar puertos en uso
ss -tlnp | grep -E "3000|4200|5432|9000"

# Verificar procesos Node.js
ps aux | grep node

# Verificar contenedores Docker
cd /home/edmundo/IAModelHub/IAModelHub_Extensiones
docker compose ps
```

### Logs en Tiempo Real

```bash
# Backend
tail -f /home/edmundo/IAModelHub/IAModelHub_Extensiones/backend/server.log

# Frontend
tail -f /home/edmundo/IAModelHub/IAModelHub_EDCUI/ml-browser-app/frontend.log
```

## 📝 Endpoints Principales

### Autenticación
```bash
# Login
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"user-conn-oeg-demo","password":"a!ulzZ5dJvLJSzvM"}'

# Get current user
curl -X GET http://localhost:3000/auth/me \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Assets
```bash
# Get all assets
curl -X POST http://localhost:3000/v3/assets/request \
  -H "Authorization: Bearer YOUR_TOKEN"

# Get asset by ID
curl -X GET http://localhost:3000/v3/assets/ML_Model_001 \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Contract Definitions
```bash
# Get all contracts
curl -X POST http://localhost:3000/v3/contractdefinitions/request \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Catalog
```bash
# Get catalog (assets with contracts)
curl -X POST http://localhost:3000/v3/catalog/request \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## 🔧 Configuración

### Variables de Entorno (Backend)

El backend usa las siguientes variables de entorno (con valores por defecto):

```bash
# Server
PORT=3000
NODE_ENV=development

# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=ml_assets_db
DB_USER=ml_assets_user
DB_PASSWORD=ml_assets_password

# S3/MinIO
S3_ENDPOINT=http://localhost:9000
S3_ACCESS_KEY=minioadmin
S3_SECRET_KEY=minioadmin123
S3_BUCKET=ml-assets
S3_REGION=us-east-1

# CORS
CORS_ORIGIN=http://localhost:4200
```

### Frontend Environment

Configurado en `src/environments/environment.ts`:
- `managementApiUrl`: `http://localhost:3000`
- `catalogUrl`: `http://localhost:3000`

## 🏗️ Arquitectura

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (Angular)                        │
│                   http://localhost:4200                      │
└────────────────────────┬────────────────────────────────────┘
                         │ HTTP + CORS
                         ↓
┌─────────────────────────────────────────────────────────────┐
│              Backend EDC Runtime (Node.js)                   │
│                   http://localhost:3000                      │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Extensions:                                         │   │
│  │  - Identity Extension (JWT Auth)                     │   │
│  │  - Management API Extension (REST Endpoints)         │   │
│  │  - ML Metadata Extension                             │   │
│  │  - S3 Storage Extension (MinIO)                      │   │
│  └──────────────────────────────────────────────────────┘   │
└────────────┬─────────────────────────┬──────────────────────┘
             │                         │
             ↓                         ↓
    ┌────────────────┐        ┌────────────────┐
    │   PostgreSQL   │        │     MinIO      │
    │   port 5432    │        │   port 9000    │
    └────────────────┘        └────────────────┘
```

## 📚 Más Información

- **Credenciales completas:** Ver `CREDENTIALS.md`
- **Arquitectura EDC:** Ver `backend/edc-extensions/`
- **Guías de desarrollo:** Ver carpeta `docs/` (si existe)

---

**Última actualización:** 2025-12-11
