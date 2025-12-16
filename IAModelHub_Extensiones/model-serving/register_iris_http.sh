#!/bin/bash

# Script para registrar el modelo Iris HTTP con documentación de variables

set -e

EDC_API_URL="http://localhost:3000"
MODEL_SERVER_URL="http://localhost:8080"
API_KEY="ml-model-key-2024"

# Credenciales EDC
USERNAME="user-conn-oeg-demo"
PASSWORD="a!ulzZ5dJvLJSzvM"

echo "================================================"
echo "  Registro de Modelo Iris en EDC Connector"
echo "================================================"

# Obtener token
echo "🔐 Obteniendo token..."
TOKEN=$(curl -s -X POST "${EDC_API_URL}/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"username\":\"${USERNAME}\",\"password\":\"${PASSWORD}\"}" | jq -r '.token')

if [ -z "$TOKEN" ] || [ "$TOKEN" = "null" ]; then
    echo "❌ Error: No se pudo obtener el token"
    exit 1
fi
echo "✓ Token obtenido"

# Obtener metadata del modelo desde el servidor HTTP
echo ""
echo "📦 Obteniendo metadata del modelo..."
METADATA=$(curl -s "${MODEL_SERVER_URL}/metadata/iris-classifier-v1")
INPUT_FEATURES=$(echo "$METADATA" | jq '.model_metadata.input_features')

echo "✓ Metadata obtenida"
echo ""
echo "Variables de entrada del modelo:"
echo "$INPUT_FEATURES" | jq -r '.[] | "  \(.position + 1). \(.name) (\(.type)) - \(.description)"'

# Registrar asset
echo ""
echo "📝 Registrando asset con HTTP Data..."

ASSET_ID="iris-http-$(date +%s)"

RESPONSE=$(curl -s -X POST "${EDC_API_URL}/v3/assets" \
    -H "Authorization: Bearer ${TOKEN}" \
    -H "Content-Type: application/json" \
    -d '{
        "@id": "'"${ASSET_ID}"'",
        "properties": {
            "name": "Iris Random Forest Classifier (HTTP)",
            "version": "1.0",
            "description": "Random Forest classifier trained on Iris dataset. Requires 4 input features: sepal length, sepal width, petal length, petal width.",
            "shortDescription": "Iris flower species classifier",
            "keywords": "iris,classification,random-forest,sklearn,flowers",
            "contentType": "application/octet-stream",
            "format": "pickle",
            "assetType": "machineLearning"
        },
        "dataAddress": {
            "type": "HttpData",
            "name": "iris-classifier-http-endpoint",
            "baseUrl": "'"${MODEL_SERVER_URL}"'",
            "path": "/download/iris-classifier-v1",
            "contentType": "application/octet-stream",
            "authKey": "X-API-Key",
            "authCode": "'"${API_KEY}"'"
        },
        "mlMetadata": {
            "task": "Classification",
            "subtask": "Multi-class Classification",
            "algorithm": "Random Forest",
            "library": "scikit-learn",
            "framework": "scikit-learn",
            "software": "Python",
            "programmingLanguage": "Python",
            "license": "MIT",
            "inputFeatures": '"${INPUT_FEATURES}"'
        }
    }')

if echo "$RESPONSE" | jq -e '.errors' > /dev/null 2>&1; then
    echo "❌ Error al registrar asset:"
    echo "$RESPONSE" | jq '.errors'
    exit 1
fi

echo "✓ Asset registrado: ${ASSET_ID}"

# Crear política
echo ""
echo "📋 Creando política de acceso..."

POLICY_ID="policy-iris-http-$(date +%s)"

curl -s -X POST "${EDC_API_URL}/v3/policydefinitions" \
    -H "Authorization: Bearer ${TOKEN}" \
    -H "Content-Type: application/json" \
    -d '{
        "@id": "'"${POLICY_ID}"'",
        "policy": {
            "@type": "odrl:Set",
            "odrl:permission": [{
                "odrl:action": "USE"
            }]
        }
    }' > /dev/null

echo "✓ Política creada: ${POLICY_ID}"

# Crear contrato
echo ""
echo "📜 Creando contrato..."

CONTRACT_ID="contract-iris-http-$(date +%s)"

curl -s -X POST "${EDC_API_URL}/v3/contractdefinitions" \
    -H "Authorization: Bearer ${TOKEN}" \
    -H "Content-Type: application/json" \
    -d '{
        "@id": "'"${CONTRACT_ID}"'",
        "accessPolicyId": "'"${POLICY_ID}"'",
        "contractPolicyId": "'"${POLICY_ID}"'",
        "assetsSelector": [
            {
                "operandLeft": "id",
                "operator": "=",
                "operandRight": "'"${ASSET_ID}"'"
            }
        ]
    }' > /dev/null

echo "✓ Contrato creado: ${CONTRACT_ID}"

echo ""
echo "================================================"
echo "  ✅ Registro completado exitosamente"
echo "================================================"
echo ""
echo "Detalles del asset:"
echo "  Asset ID: ${ASSET_ID}"
echo "  Policy ID: ${POLICY_ID}"
echo "  Contract ID: ${CONTRACT_ID}"
echo ""
echo "El modelo tiene documentadas 4 variables de entrada:"
echo "$INPUT_FEATURES" | jq -r '.[] | "  \(.position + 1). \(.name)"'
echo ""
echo "Próximos pasos:"
echo "  1. Abre ML Assets Browser: http://localhost:4200/ml-assets"
echo "  2. Busca: Iris Random Forest"
echo "  3. Ve los detalles para ver las variables documentadas"
echo ""
