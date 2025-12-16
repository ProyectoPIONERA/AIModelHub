# Database Initialization

Este directorio contiene los scripts necesarios para inicializar la base de datos PostgreSQL del proyecto IAModelHub (reorganización de CatalogModelIA_DS).

## 📋 Archivos

- **`init-database.sql`**: Script de inicialización completo (recomendado para nuevas instalaciones)
- **`schema.sql`**: Schema exportado directamente de la base de datos (para referencia)
- **`generate-password-hash.js`**: Utilidad para generar hashes bcrypt de contraseñas

## 🚀 Uso Rápido

### Opción 1: Inicialización automática con Docker Compose

Si usas Docker Compose, la base de datos se inicializa automáticamente al iniciar los contenedores.

### Opción 2: Inicialización manual

Si ya tienes PostgreSQL instalado o quieres crear la base de datos manualmente:

```bash
# 1. Crear la base de datos
createdb -U postgres ml_assets_db

# 2. Crear el usuario
psql -U postgres -c "CREATE USER ml_assets_user WITH PASSWORD 'ml_assets_password';"
psql -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE ml_assets_db TO ml_assets_user;"

# 3. Ejecutar el script de inicialización
psql -U ml_assets_user -d ml_assets_db -f init-database.sql
```

### Opción 3: Desde Docker container

Si ya tienes el contenedor PostgreSQL corriendo:

```bash
# Copiar el script al contenedor
docker cp init-database.sql ml-assets-postgres:/tmp/

# Ejecutar el script
docker exec -it ml-assets-postgres psql -U ml_assets_user -d ml_assets_db -f /tmp/init-database.sql
```

## 📊 Estructura de la Base de Datos

### Tablas Principales

1. **`users`** - Autenticación de usuarios y sistema multi-tenant
   - Campos: id, username, password_hash, connector_id, display_name, email
   - Passwords hasheados con bcrypt

2. **`assets`** - Metadatos de assets ML
   - Campos: id, name, version, content_type, description, keywords, etc.
   - Incluye información del propietario (owner = connector_id)

3. **`data_addresses`** - Configuración de almacenamiento
   - Soporta: HTTP, Amazon S3, DataSpacePrototypeStore
   - Campos específicos para cada tipo de storage

4. **`ml_metadata`** - Metadatos específicos de ML
   - Basado en JS_Pionera_Ontology
   - Campos: task, algorithm, library, framework, input_features (JSONB)

5. **`contract_definitions`** - Definiciones de contratos EDC
   - Vincula assets con políticas de acceso

6. **`policy_definitions`** - Políticas EDC (formato ODRL)
   - Define permisos y restricciones

7. **`s3_upload_sessions`** - Sesiones de upload multipart S3
   - Tracking de uploads en progreso

### Vistas

- **`assets_complete`**: Vista completa de assets con ML metadata y storage
- **`assets_with_owner`**: Assets con información del usuario propietario

### Funciones y Triggers

- **`update_updated_at_column()`**: Función para auto-actualizar timestamps
- Triggers en `users` y `assets` para mantener `updated_at` actualizado

## 🔐 Usuarios por Defecto

El script incluye dos usuarios de demostración:

| Usuario | Password | Connector ID | Display Name |
|---------|----------|--------------|--------------||
| `user-conn-oeg-demo` | `demo123` | `conn-oeg-demo` | OEG Demo User |
| `user-conn-edmundo-demo` | `edmundo123` | `conn-edmundo-demo` | Edmundo Demo User |

**⚠️ IMPORTANTE**: Estas son contraseñas de demostración. Cambiarlas inmediatamente en producción.

### Cambiar Contraseñas

Para generar un nuevo hash de contraseña:

```bash
# Opción 1: Modo interactivo
node generate-password-hash.js

# Opción 2: Pasar contraseña como argumento
node generate-password-hash.js "miNuevaContraseña123!"
```

Luego actualiza la base de datos:

```sql
UPDATE users 
SET password_hash = '$2a$10$...' -- Hash generado
WHERE username = 'user-conn-oeg-demo';
```

### ¿Los hashes funcionan en otras máquinas?

**SÍ**. Los hashes bcrypt son portables porque:
- Incluyen el "salt" dentro del hash mismo
- No dependen del sistema operativo o hardware
- Son estándar criptográfico multiplataforma

Puedes copiar los hashes de `init-database.sql` y funcionarán en cualquier instalación.

## 📝 Notas

### Foreign Keys

Todas las tablas relacionadas tienen foreign keys con `ON DELETE CASCADE`:
- `data_addresses.asset_id` → `assets.id`
- `ml_metadata.asset_id` → `assets.id`
- `s3_upload_sessions.user_id` → `users.id`

### Índices

El script crea índices en campos frecuentemente consultados:
- `assets`: owner, asset_type, created_at
- `data_addresses`: asset_id, type
- `ml_metadata`: task, algorithm
- `s3_upload_sessions`: asset_id, user_id, status

### JSONB Fields

Campos JSON para flexibilidad:
- `ml_metadata.input_features`: Descripción de variables de entrada del modelo
- `ml_metadata.metrics`: Métricas de rendimiento del modelo
- `policy_definitions.policy`: Política ODRL completa
- `contract_definitions.asset_selector`: Selector de assets

## 🔄 Actualización de Schema

Para exportar el schema actual (después de modificaciones):

```bash
# Exportar schema completo
docker exec ml-assets-postgres pg_dump -U ml_assets_user -d ml_assets_db --schema-only --no-owner --no-acl > schema.sql

# Exportar solo estructura (sin datos de ejemplo)
docker exec ml-assets-postgres pg_dump -U ml_assets_user -d ml_assets_db --schema-only --no-owner --no-acl --exclude-table-data='*' > schema-clean.sql
```

## 🧪 Verificación

Después de ejecutar el script, verifica la instalación:

```sql
-- Conectar a la base de datos
psql -U ml_assets_user -d ml_assets_db

-- Listar tablas
\dt

-- Listar vistas
\dv

-- Verificar usuarios creados
SELECT username, connector_id, display_name FROM users;

-- Ver conteo de objetos
SELECT 
    (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE') as tables,
    (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'VIEW') as views;
```

## 🐛 Solución de Problemas

### Error: "relation already exists"

Si la base de datos ya tiene tablas creadas, el script las respeta (usa `CREATE TABLE IF NOT EXISTS`). Para empezar de cero:

```sql
-- CUIDADO: Esto borra TODOS los datos
DROP DATABASE IF EXISTS ml_assets_db;
CREATE DATABASE ml_assets_db;
```

### Error: "password authentication failed"

Verifica las credenciales en `docker-compose.yml` o en tu archivo `.env`:

```yaml
POSTGRES_USER: ml_assets_user
POSTGRES_PASSWORD: ml_assets_password
POSTGRES_DB: ml_assets_db
```

### Error: "could not connect to server"

Verifica que PostgreSQL esté corriendo:

```bash
# Con Docker
docker ps | grep postgres

# Verificar logs
docker logs ml-assets-postgres
```

## 📚 Más Información

- Ver `../docker-compose.yml` para configuración de PostgreSQL
- Ver `../backend/edc-extensions/` para uso de las tablas
- Ver `../../CREDENTIALS.md` para todas las credenciales del sistema
