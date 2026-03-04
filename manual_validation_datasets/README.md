# Manual Validation Datasets for Benchmarking

Estos datasets están listos para cargarse manualmente en la sección **Validation datasets** de Model Benchmarking.

## Estructura

- `group_1_medical_imaging/` → input: `image_url` (string), `image_size` (string)
- `group_2_sentiment_analysis/` → input: `text` (string)
- `group_3_health_metrics/` → input: `weight_kg` (number), `height_m` (number)
- `group_4_flora_classification/` → input: `sepal_length`, `sepal_width`, `petal_length`, `petal_width` (number)
- `group_5_fraud_detection/` → input: `amount` (number), `merchant_category` (string), `location` (string), `timestamp` (string)

Cada grupo incluye **2 datasets de validación** en formato JSON (array de objetos).
