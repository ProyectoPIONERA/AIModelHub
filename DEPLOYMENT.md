# 🚀 Guía de Despliegue - IAModelHub

Reorganización de `CatalogModelIA_DS` con lógica y UI separadas. Esta guía describe cómo desplegar el sistema ML Assets Catalog con la nueva estructura.

---

## 📋 Requisitos Previos

| Componente | Versión Mínima | Verificar |
|------------|----------------|-----------|
| **Docker** | 20.10+ | `docker --version` |
| **Node.js** | 18+ | `node --version` |
| **npm** | 9+ | `npm --version` |
| **Git** | 2.0+ | `git --version` |

**Recursos mínimos recomendados:**
- CPU: 2 cores
- RAM: 4 GB
- Disco: 10 GB libres

---

## ⚡ Despliegue Automático (Recomendado)

### Opción 1: Script Completo

```bash
# 1. Preparar carpeta del proyecto
cd IAModelHub

# 2. Ejecutar script de despliegue
./deploy.sh   # Asegúrate de tener permisos para usar Docker (usuario en grupo docker o sudo)
```

**El script automáticamente:**
- ✅ Verifica dependencias
- ✅ Detiene servicios existentes
- ✅ Inicia PostgreSQL + MinIO en Docker
- ✅ Restaura base de datos completa (estructura + datos)
- ✅ Configura bucket MinIO
- ✅ Instala dependencias npm
- ✅ Inicia backend (EDC + API)
- ✅ Inicia frontend (Angular)

**Tiempo estimado:** 3-5 minutos

---

## 🔧 Despliegue Manual

### Paso 1: Ubicarse en el proyecto

```bash
cd IAModelHub
```

### Paso 2: Iniciar Infraestructura Docker

```bash
# PostgreSQL
docker run -d \
  --name ml-assets-postgres \
  -e POSTGRES_USER=ml_assets_user \
  -e POSTGRES_PASSWORD=ml_assets_password \
  -e POSTGRES_DB=ml_assets_db \
  -p 5432:5432 \
  -v ml-assets-postgres-data:/var/lib/postgresql/data \
  postgres:16-alpine

# MinIO S3
docker run -d \
  --name ml-assets-minio \
  -e MINIO_ROOT_USER=minioadmin \
  -e MINIO_ROOT_PASSWORD=minioadmin123 \
  -p 9000:9000 -p 9001:9001 \
  -v ml-assets-minio-data:/data \
  minio/minio:latest server /data --console-address ":9001"
```

### Paso 3: Inicializar Base de Datos

**Opción A: Con datos de ejemplo** (recomendado)
```bash
docker exec -i ml-assets-postgres psql -U ml_assets_user -d ml_assets_db \
  < IAModelHub_Extensiones/database/full-backup.sql
```

Incluye:
- 2 usuarios (demo123, edmundo123)
- 13 assets ML
- 10 registros de metadata ML

**Opción B: Solo estructura**
```bash
docker exec -i ml-assets-postgres psql -U ml_assets_user -d ml_assets_db \
  < IAModelHub_Extensiones/database/init-database.sql
```

### Paso 4: Configurar MinIO

```bash
# Crear bucket
docker exec ml-assets-minio mkdir -p /data/ml-assets
```

### Paso 5: Instalar Dependencias

```bash
# Backend
cd IAModelHub_Extensiones/backend
npm install

# Frontend
cd ../../IAModelHub_EDCUI/ml-browser-app
npm install
```

### Paso 6: Iniciar Servicios

**Terminal 1 - Backend:**
```bash
cd IAModelHub_Extensiones/backend
node src/server-edc.js
```

**Terminal 2 - Frontend:**
```bash
cd IAModelHub_EDCUI/ml-browser-app
npm run start
```

> ℹ️ Nota: Los chequeos de salud contra `localhost` (por ejemplo `curl http://localhost:3000/health`) pueden requerir permisos elevados si tu entorno restringe llamadas locales.

---

## 🌐 URLs y Credenciales

### Servicios

| Servicio | URL | Descripción |
|----------|-----|-------------|
| **Frontend** | http://localhost:4200 | Aplicación Angular |
| **Backend API** | http://localhost:3000 | API EDC + Management |
| **MinIO Console** | http://localhost:9001 | Interfaz web MinIO |
| **PostgreSQL** | localhost:5432 | Base de datos |

### Credenciales por Defecto

**Aplicación Web:**
```
Usuario: user-conn-oeg-demo
Password: demo123

Usuario: user-conn-edmundo-demo  
Password: edmundo123
```

**MinIO:**
```
Usuario: minioadmin
Password: minioadmin123
```

**PostgreSQL:**
```
Usuario: ml_assets_user
Password: ml_assets_password
Base de datos: ml_assets_db
```

---

## ✅ Verificación

### 1. Verificar Contenedores Docker

```bash
docker ps | grep ml-assets
```

Debe mostrar 2 contenedores: `ml-assets-postgres` y `ml-assets-minio`

### 2. Verificar Base de Datos

```bash
docker exec ml-assets-postgres psql -U ml_assets_user -d ml_assets_db -c "\dt"
```

Debe mostrar 9 tablas.

### 3. Verificar Backend

```bash
curl http://localhost:3000/v3/assets
```

Debe retornar JSON con assets.

### 4. Verificar Frontend

Abrir http://localhost:4200 en navegador. Debe cargar la aplicación.

### 5. Prueba de Login

1. Ir a http://localhost:4200
2. Login con `user-conn-oeg-demo` / `demo123`
3. Debe acceder al catálogo de assets

---

## 📦 Estructura de Archivos Clave

```
IAModelHub/
├── deploy.sh                           # Script de despliegue automático
├── IAModelHub_Extensiones/
│   ├── runtime-edc-backend/            # Backend EDC + API (symlink: backend)
│   ├── database-scripts/               # Scripts SQL (init, backup) (symlink: database)
│   ├── infra-docker/                   # Postgres + MinIO (symlink: docker-compose.yml)
│   └── model-serving/                  # Servidor HTTP de modelos (Python) (symlink: model-server)
├── IAModelHub_EDCUI/
│   └── ui-model-browser/               # Frontend Angular (symlink: ml-browser-app)
│       ├── src/                        # Código fuente Angular
│       └── package.json                # Dependencias frontend
├── CREDENTIALS.md                      # Todas las credenciales
└── DEPLOYMENT.md
```

---

## 🔄 Backup y Restauración

### Crear Backup Completo

```bash
# Backup con datos
docker exec ml-assets-postgres pg_dump -U ml_assets_user -d ml_assets_db \
  --clean --if-exists --inserts > backup-$(date +%Y%m%d).sql

# Backup de archivos MinIO
docker exec ml-assets-minio tar czf /tmp/minio-backup.tar.gz /data/ml-assets
docker cp ml-assets-minio:/tmp/minio-backup.tar.gz ./
```

### Restaurar Backup

```bash
# Restaurar base de datos
docker exec -i ml-assets-postgres psql -U ml_assets_user -d ml_assets_db \
  < backup-20251212.sql

# Restaurar archivos MinIO
docker cp minio-backup.tar.gz ml-assets-minio:/tmp/
docker exec ml-assets-minio tar xzf /tmp/minio-backup.tar.gz -C /
```

---

## 🛑 Detener Servicios

```bash
# Detener aplicaciones (si usaste deploy.sh)
kill $(pgrep -f "server-edc.js")
kill $(pgrep -f "ng serve")

# Detener Docker
docker stop ml-assets-postgres ml-assets-minio

# Eliminar contenedores (mantiene datos)
docker rm ml-assets-postgres ml-assets-minio

# Eliminar TODO incluyendo datos (CUIDADO)
docker rm -f ml-assets-postgres ml-assets-minio
docker volume rm ml-assets-postgres-data ml-assets-minio-data
```

---

## 🐛 Troubleshooting

### Error: "Puerto 5432 en uso"

```bash
# Ver qué proceso usa el puerto
sudo lsof -i :5432

# Cambiar puerto en deploy.sh o comando docker
-p 5433:5432  # Usar puerto 5433 en host
```

### Error: "Cannot connect to database"

```bash
# Verificar que PostgreSQL está listo
docker exec ml-assets-postgres pg_isready -U ml_assets_user

# Ver logs
docker logs ml-assets-postgres
```

### Error: "Frontend no compila"

```bash
# Limpiar cache npm
cd IAModelHub_EDCUI/ml-browser-app
rm -rf node_modules package-lock.json
npm install

# Verificar versión Node.js
node --version  # Debe ser 18+
```

### Error: "Backend no inicia"

```bash
# Ver logs
cat IAModelHub_Extensiones/backend/server.log

# Verificar que PostgreSQL está corriendo
docker ps | grep postgres

# Probar conexión manual
docker exec -it ml-assets-postgres psql -U ml_assets_user -d ml_assets_db
```

---

## 🔐 Seguridad para Producción

**⚠️ IMPORTANTE:** Las credenciales por defecto son para desarrollo. En producción:

1. **Cambiar passwords de base de datos:**
```bash
# Generar nuevo hash
node IAModelHub_Extensiones/database/generate-password-hash.js "newSecurePass123!"

# Actualizar en BD
docker exec -i ml-assets-postgres psql -U ml_assets_user -d ml_assets_db <<EOF
UPDATE users SET password_hash = '\$2a\$10$...' WHERE username = 'user-conn-oeg-demo';
EOF
```

2. **Cambiar credenciales MinIO:**
```bash
docker run ... -e MINIO_ROOT_USER=admin -e MINIO_ROOT_PASSWORD=SecurePass123! ...
```

3. **Cambiar password PostgreSQL:**
```bash
docker run ... -e POSTGRES_PASSWORD=SecureDBPass123! ...
```

4. **Usar variables de entorno:**
```bash
export DB_PASSWORD="SecureDBPass123!"
export MINIO_PASSWORD="SecureMinIOPass!"
```

---

## 📚 Documentación Adicional

- **[CREDENTIALS.md](./CREDENTIALS.md)** - Todas las credenciales del sistema
- **[IAModelHub_Extensiones/database/README.md](./IAModelHub_Extensiones/database/README.md)** - Gestión de base de datos
- **[README.md](./README.md)** - Documentación general del proyecto

---

## ✨ Resumen de 3 Comandos

```bash
cd IAModelHub
./deploy.sh
```

**Resultado:** Sistema completo funcionando en 3-5 minutos.

- Frontend: http://localhost:4200
- Backend: http://localhost:3000
- Login: `user-conn-oeg-demo` / `demo123`
