# Tutorial: Modelos ML con HTTP Data + Documentación de Variables

Este tutorial muestra cómo exponer modelos de ML vía HTTP y registrarlos en el EDC Connector con documentación completa de las variables requeridas.

## ✅ Lo que acabamos de implementar

1. **Modelo de ejemplo simple**: Iris classifier con 4 variables
2. **Servidor HTTP**: Expone modelos con autenticación
3. **Metadata de variables**: Documentación automática de input features
4. **Registro en EDC**: Asset tipo HttpData con variables documentadas
5. **Sistema extensible**: Funciona con 4, 20, 100+ variables

## 🎯 Cómo funciona

### 1. Estructura de Archivos

```
model-server/
├── model_http_server.py          # Servidor HTTP para exponer modelos
├── create_iris_model.py           # Script para crear modelo de ejemplo
├── register_iris_http.sh          # Script para registrar en EDC
├── models/
│   ├── iris_classifier.pkl        # Modelo entrenado
│   ├── iris_classifier_metadata.json  # Metadata con variables
│   └── test_iris_model.py         # Script de prueba
└── README.md
```

### 2. Metadata de Variables

Cada modelo tiene un archivo JSON con la documentación de sus variables:

```json
{
  "input_features": [
    {
      "name": "sepal length (cm)",
      "position": 0,
      "type": "float",
      "description": "Sepal length in centimeters",
      "example_value": 5.1,
      "min": 4.3,
      "max": 7.9,
      "mean": 5.84
    },
    // ... más variables
  ]
}
```

### 3. Flujo de Registro

```
┌──────────────────┐
│  Crear Modelo    │  python3 create_iris_model.py
│  + Metadata      │  → Genera .pkl + metadata.json
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ Servidor HTTP    │  python3 model_http_server.py
│ Expone /download│  → http://localhost:8080
│      /metadata  │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ Registro EDC     │  ./register_iris_http.sh
│ Asset + Contract│  → Asset con inputFeatures documentadas
└──────────────────┘
```

## 📝 Uso Paso a Paso

### Paso 1: Crear tu Modelo

Opción A - Usar el modelo de ejemplo Iris:

```bash
cd /home/edmundo/IAModelHub/IAModelHub_Extensiones/model-server
python3 create_iris_model.py
```

Opción B - Crear metadata para tu modelo LGBM:

```bash
# Crear archivo de metadata para tu modelo
cat > models/lgbm_metadata.json << 'EOF'
{
  "model_name": "LGBM Elasticity Classifier",
  "input_features": [
    {
      "name": "variable_1",
      "position": 0,
      "type": "float",
      "description": "Descripción de la variable 1",
      "example_value": 100.0,
      "min": 0,
      "max": 1000
    },
    {
      "name": "variable_2",
      "position": 1,
      "type": "float",
      "description": "Descripción de la variable 2",
      "example_value": 50.5,
      "min": 0,
      "max": 500
    }
    // ... agregar las 20 variables
  ]
}
EOF
```

### Paso 2: Configurar el Servidor HTTP

Edita `model_http_server.py`:

```python
AVAILABLE_MODELS = {
    'iris-classifier-v1': {
        'path': 'iris_classifier.pkl',
        'metadata_path': 'iris_classifier_metadata.json',
        'content_type': 'application/octet-stream',
        'description': 'Iris Random Forest Classifier',
        'version': '1.0'
    },
    # Agregar tu modelo LGBM:
    'lgbm-elasticity-v1': {
        'path': 'tu_carpeta/LGBM_Classifier_1.pkl',
        'metadata_path': 'lgbm_metadata.json',
        'content_type': 'application/octet-stream',
        'description': 'LGBM Elasticity Classifier',
        'version': '1.0'
    }
}
```

### Paso 3: Iniciar el Servidor

```bash
cd /home/edmundo/IAModelHub/IAModelHub_Extensiones/model-server
python3 model_http_server.py
```

O en background:

```bash
./start-server.sh
```

Verifica que funciona:

```bash
curl http://localhost:8080/health
curl http://localhost:8080/models
curl http://localhost:8080/metadata/iris-classifier-v1
```

### Paso 4: Registrar en EDC Connector

```bash
./register_iris_http.sh
```

El script automáticamente:
1. Obtiene el token de autenticación
2. Lee la metadata con las variables del servidor HTTP
3. Registra el asset con tipo HttpData
4. Incluye `inputFeatures` en mlMetadata
5. Crea política y contrato

### Paso 5: Verificar en el Browser

1. Abre http://localhost:4200/ml-assets
2. Busca "Iris Random Forest"
3. Ve los detalles del asset
4. Verifica que aparecen las variables documentadas

## 🔧 Adaptar para tu Modelo LGBM

### 1. Copiar el modelo a la carpeta models/

```bash
cp "/mnt/d/Codigos_en_Python/Proyectos_en_Python/SistemaPricing/ModuloElasticidad/4_Entrenamiento/LGBM Classifier/LGBM_Classifier_1.pkl" \
   /home/edmundo/IAModelHub/IAModelHub_Extensiones/model-server/models/
```

### 2. Crear metadata con las 20 variables

```python
# Script helper para crear metadata
import json

features = [
    {
        "name": "precio_base",
        "position": 0,
        "type": "float",
        "description": "Precio base del producto",
        "example_value": 100.0,
        "min": 0,
        "max": 10000
    },
    # ... agregar las otras 19 variables
]

metadata = {
    "model_name": "LGBM Elasticity Classifier",
    "model_type": "LGBMClassifier",
    "version": "1.0",
    "algorithm": "LightGBM",
    "library": "lightgbm",
    "task": "Classification",
    "num_features": len(features),
    "input_features": features
}

with open('models/lgbm_metadata.json', 'w') as f:
    json.dump(metadata, f, indent=2)

print(f"✓ Metadata creada con {len(features)} variables")
```

### 3. Agregar al servidor

```python
# En model_http_server.py
AVAILABLE_MODELS = {
    # ... iris model ...
    'lgbm-elasticity-v1': {
        'path': 'LGBM_Classifier_1.pkl',
        'metadata_path': 'lgbm_metadata.json',
        'content_type': 'application/octet-stream',
        'description': 'LGBM Elasticity Price Classifier',
        'version': '1.0'
    }
}
```

### 4. Registrar

Copia y adapta `register_iris_http.sh` → `register_lgbm_http.sh`:

```bash
# Cambiar estos valores:
MODEL_ID="lgbm-elasticity-v1"
ASSET_NAME="LGBM Elasticity Classifier (HTTP)"
DESCRIPTION="LightGBM classifier for price elasticity prediction. Requires 20 input features."
KEYWORDS="lgbm,pricing,elasticity,classification"
```

## 🎓 Conceptos Clave

### Input Features (Variables de Entrada)

Las `inputFeatures` se almacenan como JSONB en PostgreSQL:

```sql
-- Campo agregado a ml_metadata
ALTER TABLE ml_metadata 
ADD COLUMN input_features JSONB;
```

Esto permite:
- ✅ Documentar cualquier número de variables (4, 20, 100+)
- ✅ Búsquedas eficientes con índice GIN
- ✅ Flexibilidad para agregar campos nuevos
- ✅ Queries JSON directos

### Storage Type: HttpData

Los assets con `HttpData` permiten:
- ✅ Modelos en servidores externos
- ✅ Modelos muy grandes (GB+)
- ✅ Modelos que se actualizan frecuentemente
- ✅ Control de acceso con API Keys
- ✅ Integración con sistemas existentes

Diferencia con S3:
- **S3**: Modelo almacenado en MinIO/S3 (storage interno)
- **HttpData**: Modelo en servidor externo (URL HTTP)

## 📊 Ver las Variables en el Frontend

Las variables se pueden mostrar en el frontend accediendo a:

```typescript
// En el componente de detalle del asset
asset['edc:properties']['ml:metadata']['inputFeatures']

// Ejemplo de uso:
inputFeatures.forEach(feature => {
  console.log(`${feature.name} (${feature.type})`);
  console.log(`  Range: [${feature.min}, ${feature.max}]`);
  console.log(`  Example: ${feature.example_value}`);
});
```

## 🔒 Seguridad

Actualmente usa API Key simple:
```
X-API-Key: ml-model-key-2024
```

Para producción:
1. Generar API Key aleatoria: `openssl rand -hex 32`
2. Almacenar en variable de entorno
3. Implementar rate limiting
4. Usar HTTPS
5. Considerar OAuth2 para autenticación avanzada

## 🚀 Próximos Pasos

1. **Completar documentación de variables LGBM**
   - Identificar las 20 variables
   - Crear metadata JSON
   - Registrar modelo

2. **Mejorar frontend**
   - Mostrar input_features en la vista de detalle
   - Agregar tabla con variables
   - Mostrar rangos y ejemplos

3. **Agregar endpoint de predicción** (opcional)
   - POST /predict/{model_id}
   - Validar input contra inputFeatures
   - Retornar predicción

4. **Desplegar en producción**
   - Configurar HTTPS
   - API Keys seguros
   - Logs y monitoreo
   - Backups

## ❓ FAQ

**P: ¿Puedo tener modelos con diferente número de variables?**
R: Sí, el sistema es completamente flexible. Puedes tener un modelo con 4 variables y otro con 100.

**P: ¿Las variables se validan automáticamente?**
R: No por ahora. Es solo documentación. Puedes agregar validación en el endpoint de descarga o predicción.

**P: ¿Puedo actualizar las variables de un modelo ya registrado?**
R: Sí, edita el asset y actualiza el campo `inputFeatures` en `mlMetadata`.

**P: ¿Los modelos se copian al EDC?**
R: No, con HttpData solo se guarda la URL. El modelo permanece en el servidor HTTP.

**P: ¿Funciona con modelos en formato diferente a .pkl?**
R: Sí, puedes exponer .h5, .onnx, .joblib, etc. Solo ajusta el `content_type`.

## 📚 Referencias

- Modelo Iris: `/home/edmundo/IAModelHub/IAModelHub_Extensiones/model-server/models/`
- Servidor HTTP: `http://localhost:8080`
- EDC API: `http://localhost:3000`
- Frontend: `http://localhost:4200`
- Documentación EDC: `../ml-browser-app/QUICKSTART.md`
