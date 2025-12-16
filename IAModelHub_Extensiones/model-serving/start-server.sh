#!/bin/bash

# Quick Start - Inicia el servidor de modelos HTTP

echo "🚀 Iniciando ML Model HTTP Server..."
echo ""

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Verificar que Python está disponible
if ! command -v python3 &> /dev/null; then
    echo "❌ Python3 no está instalado"
    exit 1
fi

# Verificar que el archivo del modelo existe
MODEL_PATH="/mnt/d/Codigos_en_Python/Proyectos_en_Python/SistemaPricing/ModuloElasticidad/4_Entrenamiento/LGBM Classifier/LGBM_Classifier_1.pkl"

if [ ! -f "$MODEL_PATH" ]; then
    echo "⚠️  ADVERTENCIA: Archivo del modelo no encontrado"
    echo "   Ruta: $MODEL_PATH"
    echo ""
    echo "   Edita model_http_server.py y ajusta MODEL_BASE_PATH"
    echo ""
fi

# Iniciar servidor
echo "Iniciando servidor en http://localhost:8080"
echo "Presiona Ctrl+C para detener"
echo ""

python3 model_http_server.py
