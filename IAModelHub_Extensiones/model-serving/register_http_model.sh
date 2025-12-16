#!/bin/bash

# Script para registrar un modelo HTTP como asset en EDC Connector
# Uso: ./register_http_model.sh

set -e

# ============ CONFIGURACIÓN ============
EDC_API_URL="http://localhost:3000"
MODEL_SERVER_URL="http://localhost:8080"
API_KEY="ml-model-key-2024"

# Credenciales EDC
USERNAME="user-conn-oeg-demo"
PASSWORD="a!ulzZ5dJvLJSzvM"

# ============ FUNCIONES ============
get_token() {
    echo "🔐 Obteniendo token de autenticación..."
    TOKEN=$(curl -s -X POST "${EDC_API_URL}/auth/login" \
        -H "Content-Type: application/json" \
        -d "{\"username\":\"${USERNAME}\",\"password\":\"${PASSWORD}\"}" | jq -r '.token')
    
    if [ -z "$TOKEN" ] || [ "$TOKEN" = "null" ]; then
        echo "❌ Error: No se pudo obtener el token"
        exit 1
    fi
    echo "✓ Token obtenido"
}

check_model_server() {
    echo ""
    echo "🔍 Verificando servidor de modelos..."
    
    HEALTH=$(curl -s "${MODEL_SERVER_URL}/health" | jq -r '.status' 2>/dev/null || echo "error")
    
    if [ "$HEALTH" != "healthy" ]; then
        echo "❌ Error: El servidor de modelos no está disponible en ${MODEL_SERVER_URL}"
        echo "   Inicia el servidor con: python3 model_http_server.py"
        exit 1
    fi
    
    echo "✓ Servidor de modelos disponible"
    
    # Listar modelos disponibles
    echo ""
    echo "📦 Modelos disponibles:"
    curl -s "${MODEL_SERVER_URL}/models" | jq -r '.models | to_entries[] | "   - \(.key): \(.value.description)"'
}

register_lgbm_model() {
    echo ""
    echo "📝 Registrando LGBM Classifier como asset..."
    
    ASSET_ID="lgbm-classifier-http-$(date +%s)"
    
    RESPONSE=$(curl -s -X POST "${EDC_API_URL}/v3/assets" \
        -H "Authorization: Bearer ${TOKEN}" \
        -H "Content-Type: application/json" \
        -d '{
            "@id": "'"${ASSET_ID}"'",
            "properties": {
                "name": "LGBM Classifier Model v1",
                "version": "1.0",
                "description": "LGBM Classifier para predicción de elasticidad de precios",
                "shortDescription": "Modelo de clasificación con LightGBM",
                "keywords": "lgbm,classification,pricing,elasticity",
                "contentType": "application/octet-stream",
                "format": "pickle",
                "assetType": "Model"
            },
            "dataAddress": {
                "type": "HttpData",
                "name": "lgbm-classifier-http-endpoint",
                "baseUrl": "'"${MODEL_SERVER_URL}"'",
                "path": "/download/lgbm-classifier-1",
                "contentType": "application/octet-stream",
                "authKey": "X-API-Key",
                "authCode": "'"${API_KEY}"'"
            },
            "mlMetadata": {
                "task": "Classification",
                "subtask": "Binary Classification",
                "algorithm": "LightGBM",
                "library": "lightgbm",
                "framework": "scikit-learn",
                "software": "Python",
                "programmingLanguage": "Python",
                "license": "Proprietary"
            }
        }')
    
    if echo "$RESPONSE" | jq -e '.errors' > /dev/null 2>&1; then
        echo "❌ Error al registrar asset:"
        echo "$RESPONSE" | jq '.errors'
        exit 1
    fi
    
    echo "✓ Asset registrado exitosamente"
    echo "   ID: ${ASSET_ID}"
    echo ""
    echo "$RESPONSE" | jq '.'
}

create_policy_and_contract() {
    echo ""
    echo "📋 Creando política de acceso..."
    
    POLICY_ID="policy-lgbm-http-$(date +%s)"
    
    POLICY_RESPONSE=$(curl -s -X POST "${EDC_API_URL}/v3/policydefinitions" \
        -H "Authorization: Bearer ${TOKEN}" \
        -H "Content-Type: application/json" \
        -d '{
            "@id": "'"${POLICY_ID}"'",
            "policy": {
                "@type": "odrl:Set",
                "odrl:permission": [{
                    "odrl:action": "USE",
                    "odrl:constraint": []
                }]
            }
        }')
    
    if echo "$POLICY_RESPONSE" | jq -e '.errors' > /dev/null 2>&1; then
        echo "❌ Error al crear política:"
        echo "$POLICY_RESPONSE" | jq '.errors'
        exit 1
    fi
    
    echo "✓ Política creada: ${POLICY_ID}"
    
    echo ""
    echo "📜 Creando contrato..."
    
    CONTRACT_ID="contract-lgbm-http-$(date +%s)"
    
    CONTRACT_RESPONSE=$(curl -s -X POST "${EDC_API_URL}/v3/contractdefinitions" \
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
        }')
    
    if echo "$CONTRACT_RESPONSE" | jq -e '.errors' > /dev/null 2>&1; then
        echo "❌ Error al crear contrato:"
        echo "$CONTRACT_RESPONSE" | jq '.errors'
        exit 1
    fi
    
    echo "✓ Contrato creado: ${CONTRACT_ID}"
}

verify_in_catalog() {
    echo ""
    echo "🔍 Verificando en el catálogo..."
    
    sleep 2
    
    CATALOG=$(curl -s -X POST "${EDC_API_URL}/v3/catalog/request" \
        -H "Authorization: Bearer ${TOKEN}" \
        -H "Content-Type: application/json" \
        -d '{}')
    
    COUNT=$(echo "$CATALOG" | jq 'length')
    echo "✓ Total de assets en catálogo: ${COUNT}"
    
    # Buscar nuestro asset
    FOUND=$(echo "$CATALOG" | jq -r --arg id "$ASSET_ID" '.[] | select(.assetId == $id) | .properties.name' 2>/dev/null || echo "")
    
    if [ -n "$FOUND" ]; then
        echo "✓ Asset encontrado en catálogo: ${FOUND}"
    else
        echo "⚠ Asset no encontrado en catálogo (puede tardar unos segundos)"
    fi
}

# ============ MAIN ============
echo "================================================"
echo "  Registro de Modelo HTTP en EDC Connector"
echo "================================================"

get_token
check_model_server
register_lgbm_model
create_policy_and_contract
verify_in_catalog

echo ""
echo "================================================"
echo "  ✅ Registro completado exitosamente"
echo "================================================"
echo ""
echo "Próximos pasos:"
echo "  1. Abre ML Assets Browser: http://localhost:4200/ml-assets"
echo "  2. Busca: LGBM Classifier Model v1"
echo "  3. Verifica que el asset aparece con Storage Type: HttpData"
echo "  4. Revisa el catálogo: http://localhost:4200/catalog"
echo ""
