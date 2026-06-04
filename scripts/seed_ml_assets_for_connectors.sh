#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WORK_DIR="${WORK_DIR:-/tmp/inesdata_seed}"
NAMESPACE="${NAMESPACE:-demo}"
COUNT="${COUNT:-8}"
CONNECTORS_CSV="${CONNECTORS_CSV:-conn-citycouncil-demo,conn-company-demo}"
CREDENTIALS_DIR="${CREDENTIALS_DIR:-$ROOT_DIR/inesdata-deployment/deployments/DEV/demo}"
KEYCLOAK_TOKEN_URL="${KEYCLOAK_TOKEN_URL:-}"
VOCABULARY_ID="${VOCABULARY_ID:-JS_Pionera_Daimo}"
VOCABULARY_NAME="${VOCABULARY_NAME:-JS Metadata Daimo}"
VOCABULARY_CATEGORY="${VOCABULARY_CATEGORY:-machineLearning}"
VOCABULARY_SCHEMA_FILE="${VOCABULARY_SCHEMA_FILE:-}"
MODEL_FILE="$WORK_DIR/LGBM_Classifier_1.pkl"
STRICT_MODE="${STRICT_MODE:-0}"
INCLUDE_USE_CASE_MODELS="${INCLUDE_USE_CASE_MODELS:-0}"
USE_CASE_MODEL_SERVER_BASE_URL="${USE_CASE_MODEL_SERVER_BASE_URL:-http://host.docker.internal:8000}"
MODEL_SET="${MODEL_SET:-combined}"
COMBINED_HTTP_COUNT="${COMBINED_HTTP_COUNT:-10}"
COMBINED_INESDATA_COUNT="${COMBINED_INESDATA_COUNT:-5}"

usage() {
  cat <<'EOF'
Usage: seed_ml_assets_for_connectors.sh [options]

Options:
  --namespace <ns>            Kubernetes namespace (default: demo)
  --count <n>                 Number of InesDataStore assets per connector (default: 8)
  --connectors <csv>          Connectors list (default: conn-citycouncil-demo,conn-company-demo)
  --credentials-dir <path>    Folder containing credentials-connector-<name>.json
  --keycloak-token-url <url>  Token endpoint. If omitted, read from deployer.config
  --vocabulary-id <id>        Vocabulary ID used in assetData (default: JS_Pionera_Daimo)
  --vocabulary-name <name>    Vocabulary display name (default: JS Metadata Daimo)
  --vocabulary-category <cat> Vocabulary category (default: machineLearning)
  --vocabulary-schema <path>  JSON schema file. Default auto-detect from project root
  --model-set <mode>          ML metadata set: mock, use-cases or combined (default: combined)
  --include-use-case-models   Also seed FLARES/Mobility HttpData assets
  --use-case-model-server-base-url <url>
                              Connector-facing base URL for FLARES/Mobility FastAPI
  --combined-http-count <n>   Extra mock HttpData assets in combined mode (default: 10)
  --combined-inesdata-count <n>
                              Extra InesDataStore assets in combined mode (default: 5)
  --strict                    Fail if any connector fails (default: disabled)
  -h, --help                  Show this help

Notes:
  - Connector passwords are always read from credentials files at runtime.
  - The vocabulary is created/updated first in each connector.
  - Asset insertion uses Management API upload-chunk + finalize-upload with retries.
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --namespace)
      NAMESPACE="${2:-}"
      shift 2
      ;;
    --count)
      COUNT="${2:-}"
      shift 2
      ;;
    --connectors)
      CONNECTORS_CSV="${2:-}"
      shift 2
      ;;
    --credentials-dir)
      CREDENTIALS_DIR="${2:-}"
      shift 2
      ;;
    --keycloak-token-url)
      KEYCLOAK_TOKEN_URL="${2:-}"
      shift 2
      ;;
    --vocabulary-id)
      VOCABULARY_ID="${2:-}"
      shift 2
      ;;
    --vocabulary-name)
      VOCABULARY_NAME="${2:-}"
      shift 2
      ;;
    --vocabulary-category)
      VOCABULARY_CATEGORY="${2:-}"
      shift 2
      ;;
    --vocabulary-schema)
      VOCABULARY_SCHEMA_FILE="${2:-}"
      shift 2
      ;;
    --model-set)
      MODEL_SET="${2:-}"
      shift 2
      ;;
    --include-use-case-models)
      INCLUDE_USE_CASE_MODELS=1
      shift
      ;;
    --use-case-model-server-base-url)
      USE_CASE_MODEL_SERVER_BASE_URL="${2:-}"
      shift 2
      ;;
    --combined-http-count)
      COMBINED_HTTP_COUNT="${2:-}"
      shift 2
      ;;
    --combined-inesdata-count)
      COMBINED_INESDATA_COUNT="${2:-}"
      shift 2
      ;;
    --strict)
      STRICT_MODE=1
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage
      exit 1
      ;;
  esac
done

mkdir -p "$WORK_DIR"

if ! [[ "$COUNT" =~ ^[0-9]+$ ]] || [[ "$COUNT" -lt 1 ]]; then
  echo "Invalid --count value: $COUNT" >&2
  exit 1
fi

case "$MODEL_SET" in
  mock|use-cases|combined) ;;
  *)
    echo "Invalid --model-set value: $MODEL_SET" >&2
    exit 1
    ;;
esac

if [[ "$INCLUDE_USE_CASE_MODELS" == "1" && "$MODEL_SET" == "mock" ]]; then
  MODEL_SET="use-cases"
fi

if ! [[ "$COMBINED_HTTP_COUNT" =~ ^[0-9]+$ ]] || [[ "$COMBINED_HTTP_COUNT" -lt 1 ]] || [[ "$COMBINED_HTTP_COUNT" -gt 15 ]]; then
  echo "Invalid --combined-http-count value: $COMBINED_HTTP_COUNT (expected 1..15)" >&2
  exit 1
fi

if ! [[ "$COMBINED_INESDATA_COUNT" =~ ^[0-9]+$ ]]; then
  echo "Invalid --combined-inesdata-count value: $COMBINED_INESDATA_COUNT" >&2
  exit 1
fi

resolve_vocabulary_schema_file() {
  if [[ -n "$VOCABULARY_SCHEMA_FILE" ]]; then
    if [[ -f "$VOCABULARY_SCHEMA_FILE" ]]; then
      return 0
    fi
    echo "Vocabulary schema file not found: $VOCABULARY_SCHEMA_FILE" >&2
    return 1
  fi

  local candidates=(
    "$ROOT_DIR/JS_Metada_Daimo.schema.json"
    "$ROOT_DIR/JS_Metadata_Daimo.schema.json"
    "$ROOT_DIR/JS_Metadata_Daimo.schema.JSON"
  )

  local candidate
  for candidate in "${candidates[@]}"; do
    if [[ -f "$candidate" ]]; then
      VOCABULARY_SCHEMA_FILE="$candidate"
      return 0
    fi
  done

  echo "Could not find vocabulary schema file in project root." >&2
  echo "Expected one of: JS_Metada_Daimo.schema.json or JS_Metadata_Daimo.schema.json" >&2
  return 1
}

if [[ -z "$KEYCLOAK_TOKEN_URL" ]]; then
  cfg_file="$ROOT_DIR/deployer.config"
  if [[ ! -f "$cfg_file" ]]; then
    echo "Missing deployer config: $cfg_file" >&2
    exit 1
  fi

  kc_base="$(sed -n 's/^KC_URL=//p' "$cfg_file" | tail -n1)"
  if [[ -z "$kc_base" ]]; then
    kc_base="$(sed -n 's/^KC_INTERNAL_URL=//p' "$cfg_file" | tail -n1)"
  fi
  if [[ -z "$kc_base" ]]; then
    echo "Could not resolve KC_URL/KC_INTERNAL_URL from deployer.config" >&2
    exit 1
  fi
  if [[ "$kc_base" != http* ]]; then
    kc_base="http://$kc_base"
  fi
  KEYCLOAK_TOKEN_URL="$kc_base/realms/$NAMESPACE/protocol/openid-connect/token"
fi

if ! resolve_vocabulary_schema_file; then
  exit 1
fi

echo "Using vocabulary schema: $VOCABULARY_SCHEMA_FILE"
echo "Using vocabulary id: $VOCABULARY_ID"
echo "Using model metadata set: $MODEL_SET"
if [[ "$MODEL_SET" == "combined" ]]; then
  echo "Combined set: FLARES/Mobility use-case HttpData + $COMBINED_HTTP_COUNT mock HttpData + $COMBINED_INESDATA_COUNT InesDataStore per connector"
fi

printf 'placeholder-model-bytes-%s\n' "$(date -u +%s)" > "$MODEL_FILE"

request_retry() {
  local out_file="$1"
  shift

  local code attempt
  for attempt in 1 2 3; do
    code="$(curl -s --max-time 45 -o "$out_file" -w '%{http_code}' "$@")"
    if [[ "$code" == "200" ]]; then
      echo "$code"
      return 0
    fi
    if [[ "$code" != "504" && "$code" != "000" ]]; then
      echo "$code"
      return 1
    fi
    sleep 2
  done

  echo "$code"
  return 1
}

schema_as_json_string() {
  local schema_file="$1"
  tr -d '\n' < "$schema_file" | sed 's/\\/\\\\/g; s/"/\\"/g'
}

get_json_value() {
  local file="$1"
  local block="$2"
  local key="$3"
  sed -n "/\"$block\"[[:space:]]*:[[:space:]]*{/,/}/p" "$file" \
    | sed -n "s/.*\"$key\"[[:space:]]*:[[:space:]]*\"\\([^\"]*\\)\".*/\\1/p" \
    | head -n1
}

extract_token_field() {
  local response="$1"
  local field="$2"
  printf '%s' "$response" \
    | sed -n "s/.*\"$field\"[[:space:]]*:[[:space:]]*\"\([^\"]*\)\".*/\1/p" \
    | head -n1
}

request_connector_token() {
  local username="$1"
  local password="$2"
  local connector="$3"
  local creds_label="$4"
  local response token err

  response="$(curl -s -X POST "$KEYCLOAK_TOKEN_URL" \
    -H 'Content-Type: application/x-www-form-urlencoded' \
    --data-urlencode 'grant_type=password' \
    --data-urlencode 'client_id=dataspace-users' \
    --data-urlencode "username=$username" \
    --data-urlencode "password=$password")"

  token="$(extract_token_field "$response" "access_token")"
  if [[ -n "$token" ]]; then
    printf '%s' "$token"
    return 0
  fi

  err="$(extract_token_field "$response" "error_description")"
  if [[ -z "$err" ]]; then
    err="$(extract_token_field "$response" "error")"
  fi
  [[ -z "$err" ]] && err="unknown token error"
  echo "[$connector] token request failed using $creds_label: $err" >&2
  return 1
}

upsert_v3_asset() {
  local connector="$1"
  local asset_id="$2"
  local json_file="$3"
  local token="$4"
  local mgmt_url="$5"
  local asset_label="$6"
  local out_file="$WORK_DIR/${connector}_${asset_id}.create.out"
  local update_out_file="$WORK_DIR/${connector}_${asset_id}.update.out"
  local code update_code

  code="$(curl -s --max-time 30 -o "$out_file" -w '%{http_code}' \
    -X POST "$mgmt_url/v3/assets" \
    -H "Authorization: Bearer $token" \
    -H 'Content-Type: application/json' \
    --data-binary "@$json_file")" || true

  if [[ "$code" == "200" || "$code" == "204" ]]; then
    echo "[$connector] ${asset_label} asset $asset_id created (HTTP $code)"
    return 0
  fi

  if [[ "$code" == "409" ]]; then
    update_code="$(curl -s --max-time 30 -o "$update_out_file" -w '%{http_code}' \
      -X PUT "$mgmt_url/v3/assets" \
      -H "Authorization: Bearer $token" \
      -H 'Content-Type: application/json' \
      --data-binary "@$json_file")" || true

    if [[ "$update_code" == "200" || "$update_code" == "204" ]]; then
      echo "[$connector] ${asset_label} asset $asset_id updated (HTTP $update_code)"
      return 0
    fi

    echo "[$connector] ${asset_label} asset $asset_id update FAILED (HTTP ${update_code:-NA})" >&2
    cat "$update_out_file" >&2 2>/dev/null || true
    return 1
  fi

  echo "[$connector] ${asset_label} asset $asset_id FAILED (HTTP ${code:-NA})" >&2
  cat "$out_file" >&2 2>/dev/null || true
  return 1
}

delete_v3_asset_if_exists() {
  local connector="$1"
  local asset_id="$2"
  local token="$3"
  local mgmt_url="$4"
  local asset_label="$5"
  local out_file="$WORK_DIR/${connector}_${asset_id}.delete.out"
  local code

  code="$(curl -s --max-time 30 -o "$out_file" -w '%{http_code}' \
    -X DELETE "$mgmt_url/v3/assets/$asset_id" \
    -H "Authorization: Bearer $token")" || true

  if [[ "$code" == "200" || "$code" == "204" ]]; then
    echo "[$connector] ${asset_label} asset $asset_id deleted before reload (HTTP $code)"
    return 0
  fi

  if [[ "$code" == "404" ]]; then
    return 0
  fi

  if [[ "$code" == "409" ]]; then
    echo "[$connector] ${asset_label} asset $asset_id cannot be deleted because it is already referenced; keeping existing asset to avoid duplicates" >&2
    cat "$out_file" >&2 2>/dev/null || true
    return 2
  fi

  echo "[$connector] ${asset_label} asset $asset_id delete FAILED (HTTP ${code:-NA})" >&2
  cat "$out_file" >&2 2>/dev/null || true
  return 1
}

ensure_vocabulary() {
  local connector="$1"
  local token="$2"
  local mgmt_url="$3"
  local vocab_base="$4"
  local schema_str payload_file create_out update_out delete_out recreate_out post_code put_code delete_code recreate_code

  schema_str="$(schema_as_json_string "$VOCABULARY_SCHEMA_FILE")"
  payload_file="$WORK_DIR/vocabulary_${connector}.json"

  cat > "$payload_file" <<EOF
{
  "@context": {"@vocab": "https://w3id.org/edc/v0.0.1/ns/"},
  "@id": "$VOCABULARY_ID",
  "name": "$VOCABULARY_NAME",
  "connectorId": "$connector",
  "category": "$VOCABULARY_CATEGORY",
  "jsonSchema": "$schema_str"
}
EOF

  create_out="$WORK_DIR/vocabulary_${connector}.create.out"
  update_out="$WORK_DIR/vocabulary_${connector}.update.out"
  delete_out="$WORK_DIR/vocabulary_${connector}.delete.out"
  recreate_out="$WORK_DIR/vocabulary_${connector}.recreate.out"

  post_code="$(curl -s -o "$create_out" -w '%{http_code}' \
    -X POST "$mgmt_url/$vocab_base" \
    -H "Authorization: Bearer $token" \
    -H 'Content-Type: application/json' \
    --data-binary "@$payload_file")"

  if [[ "$post_code" == "200" || "$post_code" == "204" ]]; then
    echo "[$connector] vocabulary '$VOCABULARY_ID' created"
    return 0
  fi

  if [[ "$post_code" == "409" ]]; then
    put_code="$(curl -s -o "$update_out" -w '%{http_code}' \
      -X PUT "$mgmt_url/$vocab_base" \
      -H "Authorization: Bearer $token" \
      -H 'Content-Type: application/json' \
      --data-binary "@$payload_file")"
    if [[ "$put_code" == "204" || "$put_code" == "200" ]]; then
      echo "[$connector] vocabulary '$VOCABULARY_ID' updated after conflict"
      return 0
    fi

    echo "[$connector] vocabulary conflict but update failed (HTTP $put_code); trying delete/recreate" >&2
    cat "$update_out" >&2 || true

    delete_code="$(curl -s -o "$delete_out" -w '%{http_code}' \
      -X DELETE "$mgmt_url/$vocab_base/$VOCABULARY_ID" \
      -H "Authorization: Bearer $token")" || true

    if [[ "$delete_code" == "204" || "$delete_code" == "200" || "$delete_code" == "404" ]]; then
      recreate_code="$(curl -s -o "$recreate_out" -w '%{http_code}' \
        -X POST "$mgmt_url/$vocab_base" \
        -H "Authorization: Bearer $token" \
        -H 'Content-Type: application/json' \
        --data-binary "@$payload_file")" || true
      if [[ "$recreate_code" == "200" || "$recreate_code" == "204" ]]; then
        echo "[$connector] vocabulary '$VOCABULARY_ID' recreated after update failure"
        return 0
      fi
      echo "[$connector] vocabulary recreate failed (HTTP ${recreate_code:-NA})" >&2
      cat "$recreate_out" >&2 || true
      return 1
    fi

    echo "[$connector] vocabulary delete before recreate failed (HTTP ${delete_code:-NA})" >&2
    cat "$delete_out" >&2 || true
    return 1
  fi

  echo "[$connector] failed to create vocabulary '$VOCABULARY_ID' (HTTP $post_code)" >&2
  cat "$create_out" >&2 || true
  return 1
}

# =============================================================================
# MODEL DEFINITIONS - 25 available mock HttpData models
# =============================================================================

MODEL_SERVER_BASE="http://model-server.${NAMESPACE}.svc.cluster.local:8080"

MODEL_SLUGS=(
  chest-xray pneumonia covid19 lung-nodule tuberculosis
  ecommerce-sentiment twitter-sentiment product-review customer-feedback social-media-sentiment
  bmi body-fat bmr ideal-weight health-risk
  iris-classifier flower-classifier plant-identifier botanical-classifier flora-recognition
  fraud-transaction credit-card-fraud payment-anomaly risk-scorer fraud-classifier
)

MODEL_TITLES=(
  "Chest X-Ray Classifier" "Pneumonia Detector" "COVID-19 Screener" "Lung Nodule Detector" "Tuberculosis Classifier"
  "E-commerce Sentiment" "Twitter Sentiment" "Product Review Classifier" "Customer Feedback Analyzer" "Social Media Sentiment"
  "BMI Calculator" "Body Fat Estimator" "BMR Calculator" "Ideal Weight Predictor" "Health Risk Assessor"
  "Iris Classifier" "Flower Type Classifier" "Plant Species Identifier" "Botanical Classifier" "Flora Recognition"
  "Fraud Detector" "Credit Card Fraud" "Payment Anomaly Detector" "Risk Scorer" "Financial Fraud Classifier"
)

MODEL_ENDPOINTS=(
  /api/v1/vision/chest-xray /api/v1/vision/pneumonia /api/v1/vision/covid19 /api/v1/vision/lung-nodule /api/v1/vision/tuberculosis
  /api/v1/nlp/ecommerce-sentiment /api/v1/nlp/twitter-sentiment /api/v1/nlp/product-review /api/v1/nlp/customer-feedback /api/v1/nlp/social-media
  /api/v1/health/bmi /api/v1/health/body-fat /api/v1/health/bmr /api/v1/health/ideal-weight /api/v1/health/risk-assessment
  /api/v1/classification/iris /api/v1/classification/flower /api/v1/classification/plant /api/v1/classification/botanical /api/v1/classification/flora
  /api/v1/fraud/transaction /api/v1/fraud/credit-card /api/v1/fraud/anomaly /api/v1/fraud/risk-scorer /api/v1/fraud/classifier
)

MODEL_DESCRIPTIONS=(
  "Classifies chest X-ray images for pathology detection"
  "Detects pneumonia patterns in medical imaging"
  "Screens medical images for COVID-19 indicators"
  "Identifies lung nodules and assesses malignancy risk"
  "Classifies tuberculosis indicators from chest radiographs"
  "Analyzes e-commerce product reviews for sentiment"
  "Performs sentiment analysis on Twitter posts"
  "Classifies product reviews by sentiment polarity"
  "Analyzes customer feedback for satisfaction scoring"
  "Monitors social media posts for sentiment trends"
  "Calculates Body Mass Index from weight and height"
  "Estimates body fat percentage from anthropometric data"
  "Computes Basal Metabolic Rate for nutrition planning"
  "Predicts ideal weight range based on height and frame"
  "Assesses overall health risk from biometric inputs"
  "Classifies Iris flower species from petal/sepal measurements"
  "Identifies flower types from morphological features"
  "Identifies plant species from botanical measurements"
  "Classifies botanical specimens by taxonomic family"
  "Recognizes flora categories from measurement data"
  "Detects fraudulent transactions in real time"
  "Identifies credit card fraud patterns"
  "Detects payment anomalies and unusual patterns"
  "Scores transaction risk for compliance review"
  "Classifies financial fraud by type and severity"
)

# Group index (0-based) for each model — determines input schema and metadata
MODEL_GROUPS=(0 0 0 0 0  1 1 1 1 1  2 2 2 2 2  3 3 3 3 3  4 4 4 4 4)

GROUP_TASKS=("Computer vision" "Natural Language Processing" "Tabular" "Tabular" "Predictive event")
GROUP_SUBTASKS=("Image Classification" "Text classification" "Other" "Other" "Other")
GROUP_ALGORITHMS=("Convolutional Neural Network" "Transformer" "Linear Regression" "Random Forest" "Gradient Boosting")
GROUP_FRAMEWORKS=("TensorFlow" "Custom" "scikit-learn" "scikit-learn" "XGBoost")
GROUP_LIBRARIES=("Keras" "Transformers" "scikit-learn" "scikit-learn" "XGBoost")

USE_CASE_MODEL_SLUGS=(
  flares-5w1h-distilbert
  flares-reliability-distilbert
  mobility-lightgbm-actual-travel-time
  mobility-randomforest-actual-travel-time
  mobility-catboost-actual-travel-time
  mobility-lightgbm-delay
  mobility-randomforest-delay
  mobility-catboost-delay
  mobility-lightgbm-previous-delay
  mobility-randomforest-previous-delay
  mobility-catboost-previous-delay
)

USE_CASE_MODEL_TITLES=(
  "FLARES 5W1H DistilBERT"
  "FLARES Reliability DistilBERT"
  "Mobility LightGBM Actual Travel Time"
  "Mobility Random Forest Actual Travel Time"
  "Mobility CatBoost Actual Travel Time"
  "Mobility LightGBM Delay"
  "Mobility Random Forest Delay"
  "Mobility CatBoost Delay"
  "Mobility LightGBM Previous Delay"
  "Mobility Random Forest Previous Delay"
  "Mobility CatBoost Previous Delay"
)

USE_CASE_MODEL_ENDPOINTS=(
  /flares/dccuchile-distilbert-base-spanish-uncased-5w1h
  /flares/dccuchile-distilbert-base-spanish-uncased-reliability
  /mobility/lightgbm_actual_travel_time
  /mobility/randomforest_actual_travel_time
  /mobility/catboost_actual_travel_time
  /mobility/lightgbm_delay
  /mobility/randomforest_delay
  /mobility/catboost_delay
  /mobility/lightgbm_previous_delay
  /mobility/randomforest_previous_delay
  /mobility/catboost_previous_delay
)

USE_CASE_MODEL_DESCRIPTIONS=(
  "Extracts 5W1H spans from Spanish text using a fine-tuned DistilBERT token classifier"
  "Classifies reliability for extracted FLARES spans using a fine-tuned DistilBERT sequence classifier"
  "Predicts actual travel time for public transport segments using LightGBM"
  "Predicts actual travel time for public transport segments using Random Forest"
  "Predicts actual travel time for public transport segments using CatBoost"
  "Predicts segment delay for public transport trips using LightGBM"
  "Predicts segment delay for public transport trips using Random Forest"
  "Predicts segment delay for public transport trips using CatBoost"
  "Predicts previous segment delay for public transport trips using LightGBM"
  "Predicts previous segment delay for public transport trips using Random Forest"
  "Predicts previous segment delay for public transport trips using CatBoost"
)

USE_CASE_MODEL_TASKS=(
  "Natural Language Processing"
  "Natural Language Processing"
  "Predictive event"
  "Predictive event"
  "Predictive event"
  "Predictive event"
  "Predictive event"
  "Predictive event"
  "Predictive event"
  "Predictive event"
  "Predictive event"
)

USE_CASE_MODEL_SUBTASKS=(
  "Other"
  "Text classification"
  "Other"
  "Other"
  "Other"
  "Other"
  "Other"
  "Other"
  "Other"
  "Other"
  "Other"
)

USE_CASE_MODEL_ALGORITHMS=(
  "DistilBERT token classification"
  "DistilBERT sequence classification"
  "Gradient Boosting Decision Trees"
  "Random Forest Regressor"
  "Gradient Boosting Decision Trees"
  "Gradient Boosting Decision Trees"
  "Random Forest Regressor"
  "Gradient Boosting Decision Trees"
  "Gradient Boosting Decision Trees"
  "Random Forest Regressor"
  "Gradient Boosting Decision Trees"
)

USE_CASE_MODEL_FRAMEWORKS=(
  "PyTorch"
  "PyTorch"
  "LightGBM"
  "scikit-learn"
  "CatBoost"
  "LightGBM"
  "scikit-learn"
  "CatBoost"
  "LightGBM"
  "scikit-learn"
  "CatBoost"
)

USE_CASE_MODEL_LIBRARIES=(
  "Transformers"
  "Transformers"
  "LightGBM"
  "scikit-learn"
  "CatBoost"
  "LightGBM"
  "scikit-learn"
  "CatBoost"
  "LightGBM"
  "scikit-learn"
  "CatBoost"
)

# Per-connector group context — appended to title for differentiation
CITY_GROUP_CTX=("Municipal Health" "City Services" "Citizens Wellness" "City Botanical" "City Treasury")
COMPANY_GROUP_CTX=("Corporate Health" "Corp Analytics" "Employee Wellness" "AgriTech Lab" "Corp Finance")

connector_tag() {
  case "$1" in
    *citycouncil*) echo "city" ;;
    *company*)     echo "company" ;;
    *)             echo "${1//-/_}" | cut -c1-8 ;;
  esac
}

group_context() {
  local tag="$1" group="$2"
  case "$tag" in
    city)    echo "${CITY_GROUP_CTX[$group]}" ;;
    company) echo "${COMPANY_GROUP_CTX[$group]}" ;;
    *)       echo "Group $group" ;;
  esac
}

input_features_json() {
  local group="$1"
  case "$group" in
    0) cat <<'GRP0'
[{"name":"image_url","type":"string","description":"URL of the medical image","nullable":false},{"name":"image_size","type":"string","description":"Image dimensions e.g. 512x512","nullable":false}]
GRP0
      ;;
    1) cat <<'GRP1'
[{"name":"text","type":"string","description":"Text to analyze for sentiment","nullable":false}]
GRP1
      ;;
    2) cat <<'GRP2'
[{"name":"weight_kg","type":"number","description":"Weight in kilograms","nullable":false,"minValue":1,"maxValue":300},{"name":"height_m","type":"number","description":"Height in meters","nullable":false,"minValue":0.5,"maxValue":2.5}]
GRP2
      ;;
    3) cat <<'GRP3'
[{"name":"sepal_length","type":"number","description":"Sepal length in cm","nullable":false},{"name":"sepal_width","type":"number","description":"Sepal width in cm","nullable":false},{"name":"petal_length","type":"number","description":"Petal length in cm","nullable":false},{"name":"petal_width","type":"number","description":"Petal width in cm","nullable":false}]
GRP3
      ;;
    4) cat <<'GRP4'
[{"name":"amount","type":"number","description":"Transaction amount","nullable":false,"minValue":0},{"name":"merchant_category","type":"string","description":"Merchant category code","nullable":false},{"name":"location","type":"string","description":"Transaction location","nullable":false},{"name":"timestamp","type":"string","description":"Transaction timestamp ISO 8601","nullable":false}]
GRP4
      ;;
  esac
}

input_example_json() {
  local group="$1"
  case "$group" in
    0) echo '{\"image_url\":\"https://example.com/xray.png\",\"image_size\":\"512x512\"}' ;;
    1) echo '{\"text\":\"This product is excellent and very useful\"}' ;;
    2) echo '{\"weight_kg\":70.0,\"height_m\":1.75}' ;;
    3) echo '{\"sepal_length\":5.1,\"sepal_width\":3.5,\"petal_length\":1.4,\"petal_width\":0.2}' ;;
    4) echo '{\"amount\":150.00,\"merchant_category\":\"retail\",\"location\":\"domestic\",\"timestamp\":\"2024-01-15T10:30:00Z\"}' ;;
  esac
}

use_case_input_features_json() {
  local slug="$1"
  case "$slug" in
    flares-5w1h-distilbert)
      cat <<'FLARES_5W1H_FEATURES'
[{"name":"Id","type":"integer","description":"Input text identifier","nullable":false},{"name":"Text","type":"string","description":"Spanish text to analyze","nullable":false}]
FLARES_5W1H_FEATURES
      ;;
    flares-reliability-distilbert)
      cat <<'FLARES_REL_FEATURES'
[{"name":"Id","type":"integer","description":"Input text identifier","nullable":false},{"name":"Text","type":"string","description":"Original Spanish text","nullable":false},{"name":"Tag_Start","type":"integer","description":"Span start character offset","nullable":false},{"name":"Tag_End","type":"integer","description":"Span end character offset","nullable":false},{"name":"5W1H_Label","type":"string","description":"5W1H span label","nullable":false},{"name":"Tag_Text","type":"string","description":"Extracted span text","nullable":false}]
FLARES_REL_FEATURES
      ;;
    mobility-lightgbm-previous-delay|mobility-randomforest-previous-delay|mobility-catboost-previous-delay)
      cat <<'MOBILITY_PREV_FEATURES'
[{"name":"trip_id","type":"string","description":"GTFS trip identifier","nullable":false},{"name":"from_stop_id","type":"string","description":"Origin stop identifier","nullable":false},{"name":"to_stop_id","type":"string","description":"Destination stop identifier","nullable":false},{"name":"route_id","type":"string","description":"GTFS route identifier","nullable":false},{"name":"scheduled_travel_time","type":"number","description":"Scheduled segment travel time in seconds","nullable":false},{"name":"shape_distance","type":"number","description":"Segment distance in meters","nullable":false},{"name":"is_peak","type":"integer","description":"Peak-hour indicator","nullable":false,"minValue":0,"maxValue":1},{"name":"hour_sin","type":"number","description":"Cyclic hour sine encoding","nullable":false},{"name":"hour_cos","type":"number","description":"Cyclic hour cosine encoding","nullable":false},{"name":"weekday_sin","type":"number","description":"Cyclic weekday sine encoding","nullable":false},{"name":"weekday_cos","type":"number","description":"Cyclic weekday cosine encoding","nullable":false}]
MOBILITY_PREV_FEATURES
      ;;
    *)
      cat <<'MOBILITY_FEATURES'
[{"name":"trip_id","type":"string","description":"GTFS trip identifier","nullable":false},{"name":"from_stop_id","type":"string","description":"Origin stop identifier","nullable":false},{"name":"to_stop_id","type":"string","description":"Destination stop identifier","nullable":false},{"name":"route_id","type":"string","description":"GTFS route identifier","nullable":false},{"name":"scheduled_travel_time","type":"number","description":"Scheduled segment travel time in seconds","nullable":false},{"name":"shape_distance","type":"number","description":"Segment distance in meters","nullable":false},{"name":"is_peak","type":"integer","description":"Peak-hour indicator","nullable":false,"minValue":0,"maxValue":1},{"name":"hour_sin","type":"number","description":"Cyclic hour sine encoding","nullable":false},{"name":"hour_cos","type":"number","description":"Cyclic hour cosine encoding","nullable":false},{"name":"weekday_sin","type":"number","description":"Cyclic weekday sine encoding","nullable":false},{"name":"weekday_cos","type":"number","description":"Cyclic weekday cosine encoding","nullable":false},{"name":"previous_delay_ratio","type":"number","description":"Previous delay divided by scheduled travel time","nullable":false},{"name":"previous_delay_delta","type":"number","description":"Previous delay delta in seconds","nullable":false}]
MOBILITY_FEATURES
      ;;
  esac
}

use_case_input_example_json() {
  local slug="$1"
  case "$slug" in
    flares-5w1h-distilbert)
      echo '[{\"Id\":840,\"Text\":\"El comité de medicamentos humanos espera concluir el análisis en marzo.\"}]'
      ;;
    flares-reliability-distilbert)
      echo '[{\"Id\":840,\"Text\":\"El comité de medicamentos humanos espera concluir el análisis en marzo.\",\"Tag_Start\":0,\"Tag_End\":35,\"5W1H_Label\":\"WHO\",\"Tag_Text\":\"El comité de medicamentos humanos\"}]'
      ;;
    mobility-lightgbm-previous-delay|mobility-randomforest-previous-delay|mobility-catboost-previous-delay)
      echo '[{\"trip_id\":\"L13_1_05:45_LxI\",\"from_stop_id\":\"7716\",\"to_stop_id\":\"19219\",\"route_id\":\"13\",\"scheduled_travel_time\":120,\"shape_distance\":681.1956848810403,\"is_peak\":0,\"hour_sin\":0.7071067811865475,\"hour_cos\":0.7071067811865476,\"weekday_sin\":0.9749279121818236,\"weekday_cos\":-0.22252093395631434}]'
      ;;
    *)
      echo '[{\"trip_id\":\"L13_1_05:45_LxI\",\"from_stop_id\":\"7716\",\"to_stop_id\":\"19219\",\"route_id\":\"13\",\"scheduled_travel_time\":120,\"shape_distance\":681.1956848810403,\"is_peak\":0,\"hour_sin\":0.7071067811865475,\"hour_cos\":0.7071067811865476,\"weekday_sin\":0.9749279121818236,\"weekday_cos\":-0.22252093395631434,\"previous_delay_ratio\":0.2499999979166667,\"previous_delay_delta\":0.0}]'
      ;;
  esac
}

use_case_metrics_json() {
  local slug="$1"
  case "$slug" in
    flares-5w1h-distilbert)
      echo '[{"metric":"Precision","value":0.29},{"metric":"Recall","value":0.04},{"metric":"F1","value":0.07}]'
      ;;
    flares-reliability-distilbert)
      echo '[{"metric":"Precision","value":0.22},{"metric":"Recall","value":0.33},{"metric":"F1","value":0.27}]'
      ;;
    mobility-randomforest-previous-delay)
      echo '[{"metric":"MAE","value":28.79},{"metric":"R2","value":-0.05}]'
      ;;
    mobility-*previous-delay)
      echo '[{"metric":"MAE","value":26.16},{"metric":"R2","value":0.08}]'
      ;;
    mobility-*delay)
      echo '[{"metric":"MAE","value":17.18},{"metric":"R2","value":0.64}]'
      ;;
    *)
      echo '[{"metric":"MAE","value":16.79},{"metric":"R2","value":0.33}]'
      ;;
  esac
}

# =============================================================================
# SEED MOCK HttpData ASSETS
# =============================================================================

seed_http_data_assets() {
  local connector="$1" token="$2" mgmt_url="$3"
  local limit="${4:-${#MODEL_SLUGS[@]}}"
  local base_url="${5:-$MODEL_SERVER_BASE}"
  local asset_label="${6:-HttpData}"
  local tag created=0
  tag="$(connector_tag "$connector")"

  for idx in "${!MODEL_SLUGS[@]}"; do
    if [[ "$idx" -ge "$limit" ]]; then
      break
    fi

    local slug="${MODEL_SLUGS[$idx]}"
    local title="${MODEL_TITLES[$idx]}"
    local endpoint="${MODEL_ENDPOINTS[$idx]}"
    local desc="${MODEL_DESCRIPTIONS[$idx]}"
    local group="${MODEL_GROUPS[$idx]}"
    local ctx
    ctx="$(group_context "$tag" "$group")"

    local asset_id="${tag}-${slug}"
    local asset_title="${title} - ${ctx}"
    local task="${GROUP_TASKS[$group]}"
    local subtask="${GROUP_SUBTASKS[$group]}"
    local algo="${GROUP_ALGORITHMS[$group]}"
    local fw="${GROUP_FRAMEWORKS[$group]}"
    local library="${GROUP_LIBRARIES[$group]}"
    local input_feat input_ex
    input_feat="$(input_features_json "$group" | tr -d '\n')"
    input_ex="$(input_example_json "$group")"

    local auc recall f1
    auc="$(awk -v n="$idx" 'BEGIN{printf "%.2f", 0.84 + (n*0.003)}')"
    recall="$(awk -v n="$idx" 'BEGIN{printf "%.2f", 0.72 + (n*0.004)}')"
    f1="$(awk -v n="$idx" 'BEGIN{printf "%.2f", 0.70 + (n*0.004)}')"

    local json_file="$WORK_DIR/${connector}_${asset_id}.json"
    cat > "$json_file" <<ASSET_EOF
{
  "@context": {
    "@vocab": "https://w3id.org/edc/v0.0.1/ns/",
    "dct": "http://purl.org/dc/terms/",
    "dcterms": "http://purl.org/dc/terms/",
    "dcat": "http://www.w3.org/ns/dcat#",
    "daimo": "https://w3id.org/daimo/ns#",
    "mls": "http://www.w3.org/ns/mls#"
  },
  "@id": "${asset_id}",
  "properties": {
    "name": "${asset_title}",
    "version": "1.0.$((idx + 1))",
    "contenttype": "application/json",
    "assetType": "machineLearning",
    "shortDescription": "${desc}",
    "dct:description": "${desc} Deployed as HTTP endpoint for ${connector}.",
    "dcterms:description": "${desc} Deployed as HTTP endpoint for ${connector}.",
    "dcat:keyword": ["machine-learning","http-model","${slug}","${tag}"],
    "assetData": {
      "${VOCABULARY_ID}": {
        "dct:title": "${asset_title}",
        "dcterms:title": "${asset_title}",
        "dct:description": "${desc}",
        "dcterms:description": "${desc}",
        "daimo:task": "${task}",
        "daimo:subtask": "${subtask}",
        "daimo:algorithm": "${algo}",
        "daimo:framework": "${fw}",
        "daimo:library": "${library}",
        "dct:language": ["English","Spanish"],
        "dcterms:language": ["English","Spanish"],
        "dct:license": "apache-2.0",
        "dcterms:license": "apache-2.0",
        "daimo:input_features": ${input_feat},
        "daimo:input_example": "${input_ex}",
        "mls:ModelEvaluation": [
          {"metric":"AUC","value":${auc}},
          {"metric":"Recall","value":${recall}},
          {"metric":"F1","value":${f1}}
        ]
      }
    }
  },
  "dataAddress": {
    "type": "HttpData",
    "name": "${asset_id}",
    "baseUrl": "${base_url%/}${endpoint}",
    "proxyMethod": "true",
    "proxyBody": "true",
    "method": "POST",
    "contentType": "application/json"
  }
  }

ASSET_EOF

    if upsert_v3_asset "$connector" "$asset_id" "$json_file" "$token" "$mgmt_url" "$asset_label"; then
      created=$((created + 1))
    else
      return 1
    fi
  done

  echo "[$connector] ${asset_label} assets created: $created/$limit"
  return 0
}

seed_use_case_http_data_assets() {
  local connector="$1" token="$2" mgmt_url="$3"
  local tag created=0
  tag="$(connector_tag "$connector")"

  local base_url="${USE_CASE_MODEL_SERVER_BASE_URL%/}"

  for idx in "${!USE_CASE_MODEL_SLUGS[@]}"; do
    local slug="${USE_CASE_MODEL_SLUGS[$idx]}"
    local title="${USE_CASE_MODEL_TITLES[$idx]}"
    local endpoint="${USE_CASE_MODEL_ENDPOINTS[$idx]}"
    local desc="${USE_CASE_MODEL_DESCRIPTIONS[$idx]}"
    local task="${USE_CASE_MODEL_TASKS[$idx]}"
    local subtask="${USE_CASE_MODEL_SUBTASKS[$idx]}"
    local algo="${USE_CASE_MODEL_ALGORITHMS[$idx]}"
    local fw="${USE_CASE_MODEL_FRAMEWORKS[$idx]}"
    local library="${USE_CASE_MODEL_LIBRARIES[$idx]}"
    local input_feat input_ex metrics
    input_feat="$(use_case_input_features_json "$slug" | tr -d '\n')"
    input_ex="$(use_case_input_example_json "$slug")"
    metrics="$(use_case_metrics_json "$slug")"

    local asset_id="${tag}-${slug}"
    local asset_title="${title} - PIONERA Use Case"
    local json_file="$WORK_DIR/${connector}_${asset_id}.json"

    cat > "$json_file" <<ASSET_EOF
{
  "@context": {
    "@vocab": "https://w3id.org/edc/v0.0.1/ns/",
    "dct": "http://purl.org/dc/terms/",
    "dcterms": "http://purl.org/dc/terms/",
    "dcat": "http://www.w3.org/ns/dcat#",
    "daimo": "https://w3id.org/daimo/ns#",
    "mls": "http://www.w3.org/ns/mls#"
  },
  "@id": "${asset_id}",
  "properties": {
    "name": "${asset_title}",
    "version": "2.0.$((idx + 1))",
    "contenttype": "application/json",
    "assetType": "machineLearning",
    "shortDescription": "${desc}",
    "dct:description": "${desc}. Served by the FLARES/Mobility FastAPI use-case server.",
    "dcterms:description": "${desc}. Served by the FLARES/Mobility FastAPI use-case server.",
    "dcat:keyword": ["machine-learning","http-model","pionera-use-case","flares","mobility","${slug}","${tag}"],
    "assetData": {
      "${VOCABULARY_ID}": {
        "dct:title": "${asset_title}",
        "dcterms:title": "${asset_title}",
        "dct:description": "${desc}",
        "dcterms:description": "${desc}",
        "daimo:task": "${task}",
        "daimo:subtask": "${subtask}",
        "daimo:algorithm": "${algo}",
        "daimo:framework": "${fw}",
        "daimo:library": "${library}",
        "dct:language": ["Spanish"],
        "dcterms:language": ["Spanish"],
        "dct:license": "apache-2.0",
        "dcterms:license": "apache-2.0",
        "daimo:input_features": ${input_feat},
        "daimo:input_example": "${input_ex}",
        "mls:ModelEvaluation": ${metrics}
      }
    }
  },
  "dataAddress": {
    "type": "HttpData",
    "name": "${asset_id}",
    "baseUrl": "${base_url}${endpoint}",
    "proxyMethod": "true",
    "proxyBody": "true",
    "method": "POST",
    "contentType": "application/json"
  }
}
ASSET_EOF

    if upsert_v3_asset "$connector" "$asset_id" "$json_file" "$token" "$mgmt_url" "Use-case HttpData"; then
      created=$((created + 1))
    else
      return 1
    fi
  done

  echo "[$connector] Use-case HttpData assets created: $created/${#USE_CASE_MODEL_SLUGS[@]}"
  return 0
}

# =============================================================================
# SEED N InesDataStore ASSETS (upload-chunk + finalize)
# =============================================================================

seed_inesdata_store_assets() {
  local connector="$1" token="$2" mgmt_url="$3"
  local asset_count="${4:-$COUNT}"
  local tag created=0
  tag="$(connector_tag "$connector")"

  local stamp
  stamp="$(date -u +%Y%m%d%H%M%S)"

  if [[ "$asset_count" -eq 0 ]]; then
    echo "[$connector] InesDataStore assets created: 0/0"
    return 0
  fi

  for idx in $(seq 1 "$asset_count"); do
    local id="${tag}-lgbm-$(printf '%02d' "$idx")"
    local title="LGBM ${connector} Model $(printf '%02d' "$idx")"
    local auc recall f1
    auc="$(awk -v n="$idx" 'BEGIN{printf "%.2f", 0.84 + (n*0.01)}')"
    recall="$(awk -v n="$idx" 'BEGIN{printf "%.2f", 0.72 + (n*0.01)}')"
    f1="$(awk -v n="$idx" 'BEGIN{printf "%.2f", 0.70 + (n*0.01)}')"
    local json_file="$WORK_DIR/${connector}_${id}.json"

    cat > "$json_file" <<INES_EOF
{
  "@context": {
    "@vocab": "https://w3id.org/edc/v0.0.1/ns/",
    "dct": "http://purl.org/dc/terms/",
    "dcterms": "http://purl.org/dc/terms/",
    "dcat": "http://www.w3.org/ns/dcat#",
    "daimo": "https://w3id.org/daimo/ns#",
    "mls": "http://www.w3.org/ns/mls#"
  },
  "@id": "${id}",
  "properties": {
    "name": "${title}",
    "version": "1.0.${idx}",
    "contenttype": "application/octet-stream",
    "assetType": "machineLearning",
    "shortDescription": "Seeded LightGBM model ${idx} for ${connector}.",
    "dct:description": "Binary classifier for default probability estimation.",
    "dcterms:description": "Binary classifier for default probability estimation.",
    "dcat:byteSize": 5242880,
    "dcterms:format": "pkl",
    "dcat:keyword": ["machine-learning","lightgbm","inesdata","${tag}"],
    "assetData": {
      "${VOCABULARY_ID}": {
        "dct:title": "${title}",
        "dcterms:title": "${title}",
        "dct:description": "Binary classifier for default probability estimation.",
        "dcterms:description": "Binary classifier for default probability estimation.",
        "daimo:task": "Tabular",
        "daimo:subtask": "Calculate default probability",
        "daimo:algorithm": "Gradient Boosting Decision Trees",
        "daimo:framework": "LightGBM",
        "daimo:library": "LightGBM",
        "dct:language": ["English","Spanish"],
        "dcterms:language": ["English","Spanish"],
        "dct:license": "apache-2.0",
        "dcterms:license": "apache-2.0",
        "daimo:input_features": [
          {"name":"age","type":"integer","description":"Applicant age in years","nullable":false,"minValue":18,"maxValue":99},
          {"name":"annual_income","type":"number","description":"Annual income in EUR","nullable":false,"minValue":0,"maxValue":1000000},
          {"name":"debt_ratio","type":"number","description":"Debt to income ratio","nullable":false,"minValue":0,"maxValue":2},
          {"name":"late_payments_12m","type":"integer","description":"Late payments in last 12 months","nullable":false,"minValue":0,"maxValue":24}
        ],
        "daimo:input_example": "{\"age\":41,\"annual_income\":52000,\"debt_ratio\":0.36,\"late_payments_12m\":1}",
        "mls:ModelEvaluation": [
          {"metric":"AUC","value":${auc}},
          {"metric":"Recall","value":${recall}},
          {"metric":"F1","value":${f1}}
        ]
      }
    }
  },
  "dataAddress": {"type":"InesDataStore","folder":"ml-seeded-assets"}
}
INES_EOF

    local delete_status=0
    delete_v3_asset_if_exists "$connector" "$id" "$token" "$mgmt_url" "InesDataStore" || delete_status=$?
    if [[ "$delete_status" -eq 1 ]]; then
      return 1
    fi
    if [[ "$delete_status" -eq 2 ]]; then
      created=$((created + 1))
      echo "[$connector] InesDataStore asset $id kept existing; reload skipped to avoid duplicate finalize-upload"
      continue
    fi

    local up_code fin_code
    up_code="$(request_retry "$WORK_DIR/${connector}_${id}.upload.out" \
      -X POST "$mgmt_url/s3assets/upload-chunk" \
      -H "Authorization: Bearer $token" \
      -H 'Content-Disposition: attachment; filename="LGBM_Classifier_1.pkl"' \
      -H 'Chunk-Index: 0' \
      -H 'Total-Chunks: 1' \
      -F "json=@$json_file;type=application/json" \
      -F "file=@$MODEL_FILE;type=application/octet-stream")" || true

    fin_code="$(request_retry "$WORK_DIR/${connector}_${id}.finalize.out" \
      -X POST "$mgmt_url/s3assets/finalize-upload" \
      -H "Authorization: Bearer $token" \
      -F "json=@$json_file;type=application/json" \
      -F 'fileName=LGBM_Classifier_1.pkl')" || true

    if [[ "$fin_code" == "200" || "$fin_code" == "409" ]] && [[ "$up_code" == "200" || "$up_code" == "000" || "$up_code" == "409" ]]; then
      created=$((created + 1))
      echo "[$connector] InesDataStore asset $id upload=$up_code finalize=$fin_code"
    else
      echo "[$connector] InesDataStore asset $id upload=${up_code:-NA} finalize=${fin_code:-NA}" >&2
      cat "$WORK_DIR/${connector}_${id}.finalize.out" >&2 || true
      return 1
    fi
  done

  echo "[$connector] InesDataStore assets created: $created/$asset_count"
  return 0
}

# =============================================================================
# CREATE POLICY + CONTRACT DEFINITION (allow-all, covers all assets)
# =============================================================================

create_policy_and_contract() {
  local connector="$1" token="$2" mgmt_url="$3"
  local tag
  tag="$(connector_tag "$connector")"

  local policy_id="policy-seed-${tag}"
  local contract_id="contract-seed-${tag}"

  # Create allow-all policy
  local policy_file="$WORK_DIR/${connector}_policy.json"
  cat > "$policy_file" <<PEOF
{
  "@context": {"@vocab": "https://w3id.org/edc/v0.0.1/ns/"},
  "@id": "${policy_id}",
  "policy": {
    "@context": "http://www.w3.org/ns/odrl.jsonld",
    "@type": "odrl:Set",
    "odrl:permission": [{"odrl:action": "USE"}],
    "odrl:prohibition": [],
    "odrl:obligation": []
  }
}
PEOF

  local policy_out="$WORK_DIR/${connector}_policy.out"
  local policy_code
  policy_code="$(curl -s --max-time 30 -o "$policy_out" -w '%{http_code}' \
    -X POST "$mgmt_url/v3/policydefinitions" \
    -H "Authorization: Bearer $token" \
    -H 'Content-Type: application/json' \
    --data-binary "@$policy_file")" || true

  if [[ "$policy_code" == "200" || "$policy_code" == "204" || "$policy_code" == "409" ]]; then
    echo "[$connector] policy '$policy_id' created (HTTP $policy_code)"
  else
    echo "[$connector] policy creation failed (HTTP ${policy_code:-NA})" >&2
    cat "$policy_out" >&2 2>/dev/null || true
    return 1
  fi

  # Create contract definition covering all machineLearning assets
  local contract_file="$WORK_DIR/${connector}_contract.json"
  cat > "$contract_file" <<CEOF
{
  "@context": {"@vocab": "https://w3id.org/edc/v0.0.1/ns/"},
  "@id": "${contract_id}",
  "accessPolicyId": "${policy_id}",
  "contractPolicyId": "${policy_id}",
  "assetsSelector": [
    {
      "operandLeft": "https://w3id.org/edc/v0.0.1/ns/assetType",
      "operator": "=",
      "operandRight": "machineLearning"
    }
  ]
}
CEOF

  local contract_out="$WORK_DIR/${connector}_contract.out"
  local contract_code
  contract_code="$(curl -s --max-time 30 -o "$contract_out" -w '%{http_code}' \
    -X POST "$mgmt_url/v3/contractdefinitions" \
    -H "Authorization: Bearer $token" \
    -H 'Content-Type: application/json' \
    --data-binary "@$contract_file")" || true

  if [[ "$contract_code" == "200" || "$contract_code" == "204" || "$contract_code" == "409" ]]; then
    echo "[$connector] contract '$contract_id' created (HTTP $contract_code)"
  else
    echo "[$connector] contract creation failed (HTTP ${contract_code:-NA})" >&2
    cat "$contract_out" >&2 2>/dev/null || true
    return 1
  fi

  return 0
}

# =============================================================================
# MAIN PER-CONNECTOR FUNCTION — port-forward, vocabulary, assets, policy
# =============================================================================

seed_connector() {
  local connector="$1"
  local creds_file="$CREDENTIALS_DIR/credentials-connector-$connector.json"
  local fallback_creds_file="$ROOT_DIR/inesdata-deployment/deployments/DEV/$NAMESPACE/credentials-connector-$connector.json"
  local mgmt_url="http://127.0.0.1:19193/management"
  local pf_pid=""

  if [[ ! -f "$creds_file" ]]; then
    echo "Credentials file not found for $connector: $creds_file" >&2
    return 1
  fi

  local username password token
  local vocab_base
  username="$(get_json_value "$creds_file" connector_user user)"
  password="$(get_json_value "$creds_file" connector_user passwd)"

  if [[ -z "$username" || -z "$password" ]]; then
    echo "Missing connector_user credentials in $creds_file" >&2
    return 1
  fi

  token="$(request_connector_token "$username" "$password" "$connector" "$creds_file" || true)"

  if [[ -z "$token" && -f "$fallback_creds_file" && "$fallback_creds_file" != "$creds_file" ]]; then
    username="$(get_json_value "$fallback_creds_file" connector_user user)"
    password="$(get_json_value "$fallback_creds_file" connector_user passwd)"
    if [[ -n "$username" && -n "$password" ]]; then
      token="$(request_connector_token "$username" "$password" "$connector" "$fallback_creds_file" || true)"
      if [[ -n "$token" ]]; then
        echo "[$connector] using fallback credentials file: $fallback_creds_file"
      fi
    fi
  fi

  if [[ -z "$token" ]]; then
    echo "Failed to obtain token for $connector" >&2
    return 1
  fi

  cleanup_pf() {
    if [[ -n "$pf_pid" ]] && kill -0 "$pf_pid" 2>/dev/null; then
      kill "$pf_pid" >/dev/null 2>&1 || true
      wait "$pf_pid" 2>/dev/null || true
    fi
  }

  kubectl -n "$NAMESPACE" port-forward "svc/$connector" 19193:19193 >"$WORK_DIR/port_forward_$connector.log" 2>&1 &
  pf_pid=$!
  sleep 2

  local probe
  probe="$(curl -s -o "$WORK_DIR/${connector}.probe.out" -w '%{http_code}' "$mgmt_url/v3/assets/request" \
    -H "Authorization: Bearer $token" \
    -H 'Content-Type: application/json' \
    -d '{"@context":{"@vocab":"https://w3id.org/edc/v0.0.1/ns/"},"offset":0,"limit":1,"filterExpression":[]}' || true)"
  if [[ "$probe" != "200" && "$probe" != "400" && "$probe" != "401" && "$probe" != "403" ]]; then
    cleanup_pf
    echo "Management API probe failed for $connector: HTTP $probe" >&2
    return 1
  fi

  # Vocabulary API differs by runtime
  vocab_base=""
  local vocab_probe_code
  vocab_probe_code="$(curl -s -o "$WORK_DIR/${connector}.vocab_probe.out" -w '%{http_code}' \
    -X POST "$mgmt_url/vocabularies/request" \
    -H "Authorization: Bearer $token" \
    -H 'Content-Type: application/json' \
    -d '{"@context":{"@vocab":"https://w3id.org/edc/v0.0.1/ns/"},"offset":0,"limit":1,"filterExpression":[]}')"
  if [[ "$vocab_probe_code" == "200" || "$vocab_probe_code" == "400" || "$vocab_probe_code" == "401" || "$vocab_probe_code" == "403" ]]; then
    vocab_base="vocabularies"
  else
    vocab_probe_code="$(curl -s -o "$WORK_DIR/${connector}.vocab_probe_v3.out" -w '%{http_code}' \
      -X POST "$mgmt_url/v3/vocabularies/request" \
      -H "Authorization: Bearer $token" \
      -H 'Content-Type: application/json' \
      -d '{"@context":{"@vocab":"https://w3id.org/edc/v0.0.1/ns/"},"offset":0,"limit":1,"filterExpression":[]}')"
    if [[ "$vocab_probe_code" == "200" || "$vocab_probe_code" == "400" || "$vocab_probe_code" == "401" || "$vocab_probe_code" == "403" ]]; then
      vocab_base="v3/vocabularies"
    fi
  fi

  if [[ -z "$vocab_base" ]]; then
    cleanup_pf
    echo "Could not resolve vocabulary API endpoint for $connector" >&2
    return 1
  fi

  if ! ensure_vocabulary "$connector" "$token" "$mgmt_url" "$vocab_base"; then
    cleanup_pf
    return 1
  fi

  case "$MODEL_SET" in
    mock)
      if ! seed_http_data_assets "$connector" "$token" "$mgmt_url" "${#MODEL_SLUGS[@]}" "$MODEL_SERVER_BASE" "HttpData"; then
        cleanup_pf
        return 1
      fi
      if ! seed_inesdata_store_assets "$connector" "$token" "$mgmt_url" "$COUNT"; then
        cleanup_pf
        return 1
      fi
      ;;
    use-cases)
      if ! seed_use_case_http_data_assets "$connector" "$token" "$mgmt_url"; then
        cleanup_pf
        return 1
      fi
      if ! seed_inesdata_store_assets "$connector" "$token" "$mgmt_url" "$COUNT"; then
        cleanup_pf
        return 1
      fi
      ;;
    combined)
      if ! seed_use_case_http_data_assets "$connector" "$token" "$mgmt_url"; then
        cleanup_pf
        return 1
      fi
      if ! seed_http_data_assets "$connector" "$token" "$mgmt_url" "$COMBINED_HTTP_COUNT" "$USE_CASE_MODEL_SERVER_BASE_URL" "Combined mock HttpData"; then
        cleanup_pf
        return 1
      fi
      if ! seed_inesdata_store_assets "$connector" "$token" "$mgmt_url" "$COMBINED_INESDATA_COUNT"; then
        cleanup_pf
        return 1
      fi
      ;;
  esac

  # Create policy + contract definition
  if ! create_policy_and_contract "$connector" "$token" "$mgmt_url"; then
    cleanup_pf
    return 1
  fi

  cleanup_pf
  case "$MODEL_SET" in
    mock)
      echo "[$connector] seeding complete: 25 HttpData + $COUNT InesDataStore + policy + contract"
      ;;
    use-cases)
      echo "[$connector] seeding complete: ${#USE_CASE_MODEL_SLUGS[@]} use-case HttpData + $COUNT InesDataStore + policy + contract"
      ;;
    combined)
      echo "[$connector] seeding complete: ${#USE_CASE_MODEL_SLUGS[@]} use-case HttpData + $COMBINED_HTTP_COUNT combined mock HttpData + $COMBINED_INESDATA_COUNT InesDataStore + policy + contract"
      ;;
  esac
  return 0
}

# =============================================================================
# CROSS-CONNECTOR NEGOTIATIONS (after all connectors are seeded)
# =============================================================================

negotiate_one() {
  local consumer="$1" provider="$2" asset_id="$3" label="$4"
  local creds_file="$CREDENTIALS_DIR/credentials-connector-$consumer.json"
  local fallback_creds_file="$ROOT_DIR/inesdata-deployment/deployments/DEV/$NAMESPACE/credentials-connector-$consumer.json"
  local mgmt_url="http://127.0.0.1:19193/management"
  local pf_pid=""

  echo "[negotiate] $label: $consumer -> $provider for asset '$asset_id'"

  # Get credentials
  local username password token
  if [[ -f "$creds_file" ]]; then
    username="$(get_json_value "$creds_file" connector_user user)"
    password="$(get_json_value "$creds_file" connector_user passwd)"
  fi
  if [[ -z "$username" && -f "$fallback_creds_file" ]]; then
    username="$(get_json_value "$fallback_creds_file" connector_user user)"
    password="$(get_json_value "$fallback_creds_file" connector_user passwd)"
  fi
  if [[ -z "$username" || -z "$password" ]]; then
    echo "[negotiate] cannot resolve credentials for consumer $consumer" >&2
    return 1
  fi
  token="$(request_connector_token "$username" "$password" "$consumer" "$creds_file" || true)"
  if [[ -z "$token" ]]; then
    echo "[negotiate] token request failed for $consumer" >&2
    return 1
  fi

  # Port-forward consumer
  kubectl -n "$NAMESPACE" port-forward "svc/$consumer" 19193:19193 >"$WORK_DIR/pf_neg_$consumer.log" 2>&1 &
  pf_pid=$!
  sleep 2

  neg_cleanup() {
    if [[ -n "$pf_pid" ]] && kill -0 "$pf_pid" 2>/dev/null; then
      kill "$pf_pid" >/dev/null 2>&1 || true
      wait "$pf_pid" 2>/dev/null || true
    fi
  }

  # Step 1: Request catalog from provider
  local protocol_addr="http://${provider}:19194/protocol"
  local catalog_file="$WORK_DIR/neg_catalog_${asset_id}.json"
  local catalog_out="$WORK_DIR/neg_catalog_${asset_id}.out"

  cat > "$catalog_file" <<CAT_EOF
{
  "@context": {"@vocab": "https://w3id.org/edc/v0.0.1/ns/"},
  "@type": "CatalogRequest",
  "counterPartyAddress": "${protocol_addr}",
  "counterPartyId": "${provider}",
  "protocol": "dataspace-protocol-http",
  "querySpec": {
    "offset": 0,
    "limit": 50,
    "filterExpression": []
  }
}
CAT_EOF

  local cat_code
  cat_code="$(curl -s --max-time 60 -o "$catalog_out" -w '%{http_code}' \
    -X POST "$mgmt_url/v3/catalog/request" \
    -H "Authorization: Bearer $token" \
    -H 'Content-Type: application/json' \
    --data-binary "@$catalog_file")" || true

  if [[ "$cat_code" != "200" ]]; then
    neg_cleanup
    echo "[negotiate] catalog request failed for $asset_id (HTTP ${cat_code:-NA})" >&2
    return 1
  fi

  # Step 2: Extract offer_id from catalog using Python (JSON-LD structure)
  local offer_id participant_id
  read -r offer_id participant_id < <(python3 -c "
import json, sys
try:
    cat = json.load(open('$catalog_out'))
except Exception:
    print(' ')
    sys.exit(0)
datasets = cat.get('dcat:dataset', [])
if isinstance(datasets, dict):
    datasets = [datasets]
pid = cat.get('dspace:participantId', cat.get('participantId', ''))
offer = ''
for ds in datasets:
    if ds.get('@id') == '$asset_id':
        pol = ds.get('odrl:hasPolicy', {})
        if isinstance(pol, list):
            pol = pol[0] if pol else {}
        offer = pol.get('@id', '')
        break
print(offer + ' ' + pid)
" 2>/dev/null) || true

  [[ -z "$participant_id" ]] && participant_id="$provider"

  if [[ -z "$offer_id" ]]; then
    neg_cleanup
    echo "[negotiate] could not extract offer_id for $asset_id from catalog" >&2
    echo "[negotiate] catalog response:" >&2
    head -c 2000 "$catalog_out" >&2
    return 1
  fi

  echo "[negotiate] found offer_id=$offer_id for $asset_id"

  # Step 3: Initiate contract negotiation
  local neg_payload="$WORK_DIR/neg_request_${asset_id}.json"
  cat > "$neg_payload" <<NEG_EOF
{
  "@context": {"@vocab": "https://w3id.org/edc/v0.0.1/ns/"},
  "@type": "ContractRequest",
  "counterPartyAddress": "${protocol_addr}",
  "protocol": "dataspace-protocol-http",
  "policy": {
    "@context": "http://www.w3.org/ns/odrl.jsonld",
    "@type": "odrl:Offer",
    "@id": "${offer_id}",
    "assigner": "${participant_id}",
    "target": "${asset_id}",
    "odrl:permission": [{"odrl:action": {"@id": "USE"}}],
    "odrl:prohibition": [],
    "odrl:obligation": []
  }
}
NEG_EOF

  local neg_out="$WORK_DIR/neg_result_${asset_id}.out"
  local neg_code
  neg_code="$(curl -s --max-time 30 -o "$neg_out" -w '%{http_code}' \
    -X POST "$mgmt_url/v3/contractnegotiations" \
    -H "Authorization: Bearer $token" \
    -H 'Content-Type: application/json' \
    --data-binary "@$neg_payload")" || true

  if [[ "$neg_code" != "200" ]]; then
    neg_cleanup
    echo "[negotiate] negotiation initiation failed for $asset_id (HTTP ${neg_code:-NA})" >&2
    cat "$neg_out" >&2 2>/dev/null || true
    return 1
  fi

  local neg_id
  neg_id="$(sed -n 's/.*"@id"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' "$neg_out" | head -n1)" || true
  if [[ -z "$neg_id" ]]; then
    neg_id="$(sed -n 's/.*"id"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' "$neg_out" | head -n1)" || true
  fi

  echo "[negotiate] negotiation started: id=$neg_id for asset=$asset_id"

  # Step 4: Wait for FINALIZED (up to 60 seconds)
  local deadline=$((SECONDS + 60))
  local state=""
  while [[ $SECONDS -lt $deadline ]]; do
    sleep 3
    local state_out="$WORK_DIR/neg_state_${asset_id}.out"
    curl -s --max-time 15 -o "$state_out" \
      "$mgmt_url/v3/contractnegotiations/$neg_id" \
      -H "Authorization: Bearer $token" 2>/dev/null || true

    state="$(sed -n 's/.*"state"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' "$state_out" | head -n1)" || true
    [[ -z "$state" ]] && state="$(sed -n 's/.*"edc:state"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' "$state_out" | head -n1)" || true

    if [[ "$state" == "FINALIZED" || "$state" == "VERIFIED" ]]; then
      echo "[negotiate] $asset_id: negotiation $neg_id -> $state"
      neg_cleanup
      return 0
    fi
    if [[ "$state" == "TERMINATED" || "$state" == "ERROR" ]]; then
      echo "[negotiate] $asset_id: negotiation FAILED ($state)" >&2
      neg_cleanup
      return 1
    fi
  done

  echo "[negotiate] $asset_id: timeout waiting for negotiation (last state: ${state:-unknown})" >&2
  neg_cleanup
  return 1
}

negotiate_cross_connectors() {
  local negotiation_slugs=()

  case "$MODEL_SET" in
    mock)
      negotiation_slugs=("${MODEL_SLUGS[@]}")
      ;;
    use-cases)
      negotiation_slugs=("${USE_CASE_MODEL_SLUGS[@]}")
      ;;
    combined)
      negotiation_slugs=("${USE_CASE_MODEL_SLUGS[@]}")
      for idx in "${!MODEL_SLUGS[@]}"; do
        if [[ "$idx" -ge "$COMBINED_HTTP_COUNT" ]]; then
          break
        fi
        negotiation_slugs+=("${MODEL_SLUGS[$idx]}")
      done
      ;;
  esac

  local total_negotiations=$(( ${#negotiation_slugs[@]} * 2 ))

  echo ""
  echo "=========================================="
  echo " Cross-Connector Negotiations (${total_negotiations} total)"
  echo "=========================================="

  local city_connector="" company_connector=""
  IFS=',' read -r -a _conns <<< "$CONNECTORS_CSV"
  for c in "${_conns[@]}"; do
    c="$(echo "$c" | xargs)"
    case "$c" in
      *citycouncil*) city_connector="$c" ;;
      *company*)     company_connector="$c" ;;
    esac
  done

  if [[ -z "$city_connector" || -z "$company_connector" ]]; then
    echo "Cannot run cross-connector negotiations: need both citycouncil and company connectors" >&2
    return 1
  fi

  local neg_ok=0 neg_fail=0

  # Negotiate every provider HttpData model so consumer UIs only surface contract-ready assets.
  for slug in "${negotiation_slugs[@]}"; do
    local asset_id="city-${slug}"
    if negotiate_one "$company_connector" "$city_connector" "$asset_id" "company->city"; then
      neg_ok=$((neg_ok + 1))
    else
      neg_fail=$((neg_fail + 1))
    fi
  done

  for slug in "${negotiation_slugs[@]}"; do
    local asset_id="company-${slug}"
    if negotiate_one "$city_connector" "$company_connector" "$asset_id" "city->company"; then
      neg_ok=$((neg_ok + 1))
    else
      neg_fail=$((neg_fail + 1))
    fi
  done

  echo ""
  echo "Negotiations complete: $neg_ok succeeded, $neg_fail failed"

  if [[ "$neg_ok" -eq 0 ]]; then
    return 1
  fi

  if [[ "$neg_fail" -gt 0 ]]; then
    return 2
  fi

  return 0
}

# =============================================================================
# MAIN EXECUTION
# =============================================================================

IFS=',' read -r -a connectors <<< "$CONNECTORS_CSV"

total_ok=0
failed_connectors=()
for connector in "${connectors[@]}"; do
  connector="$(echo "$connector" | xargs)"
  [[ -z "$connector" ]] && continue
  echo ""
  echo "=========================================="
  echo " Seeding: $connector"
  echo "=========================================="
  if ! seed_connector "$connector"; then
    failed_connectors+=("$connector")
    echo "[$connector] warning: seeding failed, continuing with remaining connectors" >&2
    continue
  fi
  total_ok=$((total_ok + 1))
done

echo ""
case "$MODEL_SET" in
  mock)
    echo "Connector seeding summary: $total_ok/${#connectors[@]} succeeded (25 HttpData + $COUNT InesDataStore each)"
    ;;
  use-cases)
    echo "Connector seeding summary: $total_ok/${#connectors[@]} succeeded (${#USE_CASE_MODEL_SLUGS[@]} use-case HttpData + $COUNT InesDataStore each)"
    ;;
  combined)
    echo "Connector seeding summary: $total_ok/${#connectors[@]} succeeded (${#USE_CASE_MODEL_SLUGS[@]} use-case HttpData + $COMBINED_HTTP_COUNT combined mock HttpData + $COMBINED_INESDATA_COUNT InesDataStore each)"
    ;;
esac

if [[ "${#failed_connectors[@]}" -gt 0 ]]; then
  echo "failed_connectors=${failed_connectors[*]}" >&2
  if [[ "$STRICT_MODE" == "1" ]]; then
    exit 1
  fi
fi

# Run cross-connector negotiations only if at least 2 connectors succeeded
if [[ "$total_ok" -ge 2 ]]; then
  if ! negotiate_cross_connectors; then
    if [[ "$STRICT_MODE" == "1" ]]; then
      echo "Cross-connector negotiations did not complete successfully in strict mode" >&2
      exit 1
    fi

    echo "Warning: cross-connector negotiations were incomplete; Step 8 finished with partial federated readiness" >&2
  fi
else
  echo "Skipping cross-connector negotiations (need at least 2 successful connectors)" >&2
fi

echo ""
echo "Seed script finished."
