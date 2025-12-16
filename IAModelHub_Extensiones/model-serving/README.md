# ML Model HTTP Server

Servidor HTTP simple para exponer modelos de ML almacenados localmente a través de endpoints HTTP con autenticación.

## Características

- ✅ Expone modelos `.pkl` (y otros formatos) vía HTTP
- ✅ Autenticación con API Key
- ✅ CORS habilitado para acceso desde frontend
- ✅ Metadata de modelos
- ✅ Descarga de archivos de modelo
- ✅ Health check endpoint

## Instalación

No requiere dependencias externas, solo Python 3.7+

## Configuración

Edita `model_http_server.py` y ajusta:

```python
# Puerto del servidor
SERVER_PORT = 8080

# Ruta base donde están tus modelos en Windows
# En WSL: /mnt/d/ruta/a/tus/modelos
MODEL_BASE_PATH = '/mnt/d/Codigos_en_Python/Proyectos_en_Python/SistemaPricing/ModuloElasticidad/4_Entrenamiento'

# API Key para autenticación
API_KEY = 'ml-model-key-2024'  # ¡Cámbialo!

# Registra tus modelos
AVAILABLE_MODELS = {
    'lgbm-classifier-1': {
        'path': 'LGBM Classifier/LGBM_Classifier_1.pkl',
        'content_type': 'application/octet-stream',
        'description': 'LGBM Classifier Model v1',
        'version': '1.0'
    }
}
```

## Uso

### 1. Inicia el servidor

```bash
cd /home/edmundo/IAModelHub/IAModelHub_Extensiones/model-server
python3 model_http_server.py
```

### 2. Verifica que funciona

```bash
# Health check
curl http://localhost:8080/health

# Lista de modelos disponibles
curl http://localhost:8080/models

# Metadata de un modelo específico
curl http://localhost:8080/metadata/lgbm-classifier-1

# Descargar modelo (requiere autenticación)
curl -H "X-API-Key: ml-model-key-2024" \
  http://localhost:8080/download/lgbm-classifier-1 \
  --output modelo.pkl
```

## Endpoints Disponibles

### GET /health
Health check del servidor

**Respuesta:**
```json
{
  "status": "healthy",
  "service": "ML Model HTTP Server",
  "available_models": 1
}
```

### GET /models
Lista todos los modelos disponibles

**Respuesta:**
```json
{
  "models": {
    "lgbm-classifier-1": {
      "id": "lgbm-classifier-1",
      "description": "LGBM Classifier Model v1",
      "version": "1.0",
      "content_type": "application/octet-stream",
      "available": true,
      "size_bytes": 1048576,
      "download_url": "http://localhost:8080/download/lgbm-classifier-1"
    }
  },
  "total": 1
}
```

### GET /metadata/{model_id}
Obtiene metadata de un modelo específico

**Respuesta:**
```json
{
  "id": "lgbm-classifier-1",
  "description": "LGBM Classifier Model v1",
  "version": "1.0",
  "content_type": "application/octet-stream",
  "path": "LGBM Classifier/LGBM_Classifier_1.pkl",
  "exists": true,
  "size_bytes": 1048576,
  "endpoints": {
    "download": "http://localhost:8080/download/lgbm-classifier-1",
    "metadata": "http://localhost:8080/metadata/lgbm-classifier-1"
  }
}
```

### GET /download/{model_id}
Descarga el archivo del modelo

**Headers requeridos:**
- `X-API-Key: tu-api-key` o
- `Authorization: Bearer tu-api-key`

**Respuesta:** Archivo binario del modelo

## Registro en EDC Connector

Para registrar un modelo como asset en tu EDC Connector:

### Usando la UI (ML Assets Browser)

1. Ve a "Create Asset"
2. Llena los campos básicos:
   - **Name:** LGBM Classifier Model v1
   - **Version:** 1.0
   - **Description:** LGBM Classifier para predicción de elasticidad
   - **Asset Type:** Model
   - **Format:** pickle

3. En "Storage Information", selecciona **HTTP Data**:
   - **Name:** lgbm-classifier-http
   - **URL:** `http://localhost:8080/download/lgbm-classifier-1`
   - **Content Type:** application/octet-stream
   - **Auth Key:** X-API-Key
   - **Auth Code:** ml-model-key-2024

4. Llena ML Metadata:
   - **Task:** Classification
   - **Algorithm:** LightGBM
   - **Library:** lightgbm
   - **Framework:** scikit-learn
   - **Programming Language:** Python
   - **License:** Proprietary

### Usando la API

```bash
TOKEN="tu-jwt-token"

curl -X POST http://localhost:3000/v3/assets \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "@id": "lgbm-classifier-http-1",
    "properties": {
      "name": "LGBM Classifier Model v1",
      "version": "1.0",
      "description": "LGBM Classifier para predicción de elasticidad",
      "contentType": "application/octet-stream",
      "format": "pickle",
      "assetType": "Model"
    },
    "dataAddress": {
      "type": "HttpData",
      "baseUrl": "http://localhost:8080",
      "path": "/download/lgbm-classifier-1",
      "contentType": "application/octet-stream",
      "authKey": "X-API-Key",
      "authCode": "ml-model-key-2024"
    },
    "mlMetadata": {
      "task": "Classification",
      "algorithm": "LightGBM",
      "library": "lightgbm",
      "framework": "scikit-learn",
      "programmingLanguage": "Python",
      "license": "Proprietary"
    }
  }'
```

## Seguridad

### En desarrollo:
- API Key simple en headers
- Sin HTTPS (usa HTTP)

### En producción (recomendaciones):
1. **Usa HTTPS** con certificados SSL
2. **Cambia el API Key** por uno generado aleatoriamente
3. **Implementa rate limiting**
4. **Agrega logging de accesos**
5. **Valida origen de peticiones**
6. **Considera OAuth2** para autenticación más robusta

## Troubleshooting

### El servidor no encuentra los archivos

Verifica la ruta en WSL:
```bash
ls /mnt/d/Codigos_en_Python/Proyectos_en_Python/SistemaPricing/ModuloElasticidad/4_Entrenamiento/
```

Si no existe, ajusta `MODEL_BASE_PATH` en el código.

### Error de permisos

```bash
chmod +x model_http_server.py
```

### Puerto ya en uso

Cambia `SERVER_PORT` a otro valor (ej: 8081, 8082)

## Próximos Pasos

1. ✅ Inicia el servidor
2. ✅ Verifica con curl que funciona
3. ✅ Registra el modelo en EDC Connector
4. ✅ Crea un contrato para el asset
5. ✅ Visualiza en ML Assets Browser
6. ✅ Descarga desde el catálogo

## Notas

- El servidor mantiene los modelos en disco, no los carga en memoria
- Soporta múltiples modelos simultáneamente
- Puedes agregar más modelos editando `AVAILABLE_MODELS`
- Compatible con cualquier formato de archivo (pkl, h5, onnx, etc.)
