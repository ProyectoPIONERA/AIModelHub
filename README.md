# IAModelHub

Plataforma de gestión de modelos de IA con runtime EDC-Style en Node.js y frontend Angular para explorar, registrar y operar assets de ML con almacenamiento S3 y metadata avanzada.

## Estado del proyecto

Primera entrega funcional del ciclo de gestión de modelos de IA en espacios de datos: ya permite registrar y descubrir modelos, crear políticas y contratos EDC-style, y habilitar negociaciones entre proveedores y consumidores tanto para consumo como servicio o descarga directa desde almacenamiento S3. La siguiente fase incorporará ejecución y evaluación de modelos dentro del espacio de datos, completando el ciclo de comparación y scoring.

## Contenido

- Descripción general y características
- Estructura del repositorio
- Requisitos y dependencias
- Instalación y compilación
- Uso con ejemplos
- Contribución
- Agradecimientos y financiación
- Autores y licencia

## Características principales

- Backend EDC-compatible en Node.js con extensiones modularizadas (gestión de assets, metadata ML, S3, autenticación).
- Frontend Angular 17 para navegación, creación y detalle de assets.
- Base de datos PostgreSQL + MinIO S3 para artefactos.
- Scripts listos para despliegue local y restauración de datos de ejemplo.

## Estructura del repositorio

```
IAModelHub/
├── deploy.sh                       # Despliegue automatizado
├── IAModelHub_Extensiones/         # Lógica y servicios (symlinks mantienen rutas previas)
│   ├── runtime-edc-backend/        # Backend EDC + API (symlink: backend)
│   ├── database-scripts/           # SQL init/backup (symlink: database)
│   ├── model-serving/              # Servidor HTTP de modelos (symlink: model-server)
│   └── infra-docker/               # Docker Compose (symlink: docker-compose.yml)
├── IAModelHub_EDCUI/               # Interfaces
│   └── ui-model-browser/           # Angular UI (symlink: ml-browser-app)
├── DEPLOYMENT.md
└── README.md
```

## Requisitos y dependencias

- Docker y Docker Compose (para PostgreSQL + MinIO).
- Node.js 18+ y npm 10+.
- Python 3 (opcional, para `model-serving`).

## Instalación y compilación

```bash
# 1) Entrar al proyecto
cd IAModelHub

# 2) Despliegue automatizado (requiere permisos Docker)
./deploy.sh

# 3) Manual (resultado equivalente a ./deploy.sh)
# Infraestructura (PostgreSQL + MinIO)
cd IAModelHub_Extensiones
docker compose up -d

# Backend
cd runtime-edc-backend
npm install
nohup node src/server-edc.js > ../../backend.log 2>&1 &

# Frontend
cd ../../IAModelHub_EDCUI/ui-model-browser
npm install
nohup npm run start > ../../frontend.log 2>&1 &

# Verificación
curl http://localhost:3000/health
```

## Uso con ejemplos

- Backend salud: `curl http://localhost:3000/health`
- Listar assets: `curl -X POST http://localhost:3000/v3/assets/request -H "Authorization: Bearer <token>"`
- Frontend: abrir `http://localhost:4200`
  - Usuario 1: `user-conn-oeg-demo / demo123`
  - Usuario 2: `user-conn-edmundo-demo / edmundo123`
- MinIO Console: `http://localhost:9001` (`minioadmin/minioadmin123`).

## Contribución

1. Abrir issue con descripción clara.
2. Hacer fork y crear rama (`feature/...` o `fix/...`).
3. Enviar pull request con resumen, pasos de prueba y checklist de impactos.

## Agradecimientos y financiación

- Inspirado en Eclipse Dataspace Components (EDC): extensiones de esta arquitectura para aplicarlas en cualquier espacio de datos.
- Tecnologías base: Angular para UI, Express/Node.js para servicios, PostgreSQL para metadata, MinIO para artefactos S3.
- Financiación: Proyecto PIONERA.

## Autores y contacto

- Mantenimiento principal: Edmundo Mori, Jiayun Liu.
- Contacto: edmundo.mori.orrillo@upm.es, jiayun.liu@alumnos.upm.es.

## Licencia

Código licenciado bajo Apache 2.0. Ver `LICENSE` en el repositorio original.
