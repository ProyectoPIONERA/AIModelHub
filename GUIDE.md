# 🚀 AIModelHub — Complete Technical Guide

**AI Model Management Platform for Data Spaces**

AIModelHub is a complete implementation of a data-space-ready platform for AI model registration, discovery, HTTP execution, and comparative benchmarking.

---

## 📋 Table of Contents

1. [Executive Summary](#executive-summary)
2. [Core Contributions](#core-contributions)
3. [System Architecture](#system-architecture)
4. [Design Schemas](#design-schemas)
5. [Repository Structure](#repository-structure)
6. [System Requirements](#system-requirements)
7. [Installation and Deployment](#installation-and-deployment)
8. [Ontology and Metadata Model](#ontology-and-metadata-model)
9. [Catalog and Discovery](#catalog-and-discovery)
10. [HTTP Model Execution](#http-model-execution)
11. [Model Benchmarking](#model-benchmarking)
12. [Validation Dataset Formats](#validation-dataset-formats)
13. [API Endpoints](#api-endpoints)
14. [Operations and Monitoring](#operations-and-monitoring)
15. [Troubleshooting](#troubleshooting)
16. [Contributing](#contributing)
17. [License](#license)

---

## ✅ Executive Summary

**Current release:** 2.6.0  
**Status:** Functionally complete for the scoped project goals.

AIModelHub delivers four major contributions:

1. Ontology-driven model metadata registration in the data space
2. Metadata/keyword-based model catalog and discovery
3. HTTP model execution via connector-to-provider API invocation
4. Comparative model benchmarking with schema validation and manual validation datasets

---

## 🧩 Core Contributions

### 1) Ontology for descriptive model metadata

The platform defines and operationalizes a metadata model aligned with the project ontology approach (`JS_Pionera_Ontology` aligned representation), allowing rich model descriptions in the catalog.

Metadata coverage includes:
- Task/subtask
- Algorithm and framework
- Storage and execution information
- Input schema (`input_features`) for validation, execution, and benchmark compatibility

### 2) Model catalog for data-space discovery

The catalog enables model discovery using:
- Metadata-based filtering
- Keyword search
- Type and capability narrowing

This supports model shortlisting before negotiation and access workflows in the data space.

### 3) Connector-based HTTP model execution

For models registered as `HttpData`, the connector:
- Reads provider endpoint metadata from catalog records
- Sends inference input to provider-hosted local model APIs
- Receives response payloads and returns structured outputs to consumers

### 4) Model comparison and benchmarking

Benchmarking supports:
- Compatible model selection by input schema
- Manual validation dataset upload (`JSON`, `CSV`, `JSONL`)
- Batch processing in 300-row steps
- Comparative metrics and ranking output

---

## 🏗️ System Architecture

### Logical architecture

```text
Angular Frontend (UI)
        │
        ▼
Node.js Runtime EDC API
        │
  ┌─────┴───────────────┐
  ▼                     ▼
PostgreSQL Catalog      MinIO S3 Storage
        │
        ▼
Provider HTTP Model Endpoints (Mock/Real)
```

### Main technology stack

- Frontend: Angular 18
- Backend runtime/API: Node.js + Express
- Data store: PostgreSQL
- Object storage: MinIO
- Model serving (test/demo): Python mock server

---

## 🧠 Design Schemas

### A) Metadata registration design

```text
Create Asset UI
   └─> ML Metadata + Input Schema
         └─> Catalog persistence (assets, ml_metadata, data_addresses)
               └─> Discoverable + executable model record
```

### B) Discovery and selection design

```text
Catalog Query
   ├─ metadata filters
   ├─ keyword filters
   └─ ownership/access constraints
         └─> candidate models for negotiation/execution
```

### C) Execution design

```text
Consumer input
   └─> Connector /v3/models/execute
         └─> Provider model HTTP endpoint
               └─> Output payload
                     └─> UI response + execution history
```

### D) Benchmark design

```text
Select first model (free)
   └─> derive reference input schema
Select next models
   └─> enforce schema equivalence
Upload manual validation dataset
   └─> validate against selected models
Run Benchmark
   └─> execute in 300-row batches
         └─> aggregate metrics + rank models
```

---

## 📁 Repository Structure

```text
AIModelHub/
├── README.md
├── GUIDE.md
├── 25_MODELS_BENCHMARKING_GUIDE.md
├── deploy.sh
├── cleanup-project.sh
├── manual_validation_datasets/
│   ├── group_1_medical_imaging/
│   ├── group_2_sentiment_analysis/
│   ├── group_3_health_metrics/
│   ├── group_4_flora_classification/
│   └── group_5_fraud_detection/
│
├── AIModelHub_Extensiones/
│   ├── runtime-edc-backend/
│   │   ├── src/
│   │   │   ├── server.js
│   │   │   ├── server-edc.js
│   │   │   └── extensions/
│   │   └── edc-extensions/
│   ├── database-scripts/
│   ├── model-serving/
│   └── docker-compose.yml
│
└── AIModelHub_EDCUI/
    └── ui-model-browser/
        └── src/app/pages/
            ├── ml-assets-browser/
            ├── model-execution/
            ├── model-benchmarking/
            ├── catalog/
            └── contracts/
```

---

## 🔧 System Requirements

| Component | Minimum Version | Verification |
|-----------|------------------|--------------|
| Docker | 20.10+ | `docker --version` |
| Node.js | 18+ | `node --version` |
| npm | 9+ | `npm --version` |
| Python | 3.8+ | `python3 --version` |
| Git | 2.0+ | `git --version` |

Recommended resources:
- CPU: 2 cores
- RAM: 4 GB
- Disk: 10 GB free

---

## ⚙️ Installation and Deployment

### 1) Clone

```bash
git clone <repository-url>
cd AIModelHub
```

### 2) Full deployment

```bash
./deploy.sh
```

The script initializes infrastructure, dependencies, and services.

### 3) Access

- Frontend: `http://localhost:4200`
- Backend API: `http://localhost:3000`
- Mock server: `http://localhost:8080`

> Use `localhost`, not `127.0.0.1`, to avoid origin/CORS mismatches.

---

## 🧬 Ontology and Metadata Model

### Metadata persistence model

Core catalog tables:
- `assets`
- `ml_metadata`
- `data_addresses`
- `execution_history`

Input schema is persisted in `ml_metadata.input_features` (JSONB), enabling:
- Runtime input validation
- Dynamic form generation
- Benchmark compatibility checks

### Example input schema object

```json
{
  "fields": [
    {
      "name": "sepal_length",
      "type": "float",
      "required": true,
      "min": 0,
      "max": 10,
      "description": "Sepal length in centimeters"
    }
  ]
}
```

---

## 🔎 Catalog and Discovery

The catalog UI supports model discovery through:
- Task/subtask filters
- Algorithm/framework metadata filters
- Keyword-based search
- User/access-aware model visibility

This enables efficient model selection before negotiation and execution.

---

## ⚡ HTTP Model Execution

### Execution contract

```http
POST /v3/models/execute
```

Request:

```json
{
  "assetId": "asset-http-model-id",
  "input": {
    "feature": 123
  },
  "options": {
    "timeout": 10000
  }
}
```

Runtime behavior:
1. Resolve executable endpoint from `data_addresses`.
2. Call provider-hosted model API.
3. Store execution history.
4. Return output/status to UI.

---

## 📊 Model Benchmarking

### Selection policy

- First model: no restriction.
- Next models: must match the first model input schema.
- Incompatible models are blocked with a user-facing message.

### Benchmark data policy

- `Run Benchmark` requires manual validation dataset upload.
- Supported formats: `JSON`, `CSV`, `JSONL`.
- Dataset is validated against selected model schema before execution.

### Execution policy

- Benchmark executes by model.
- Each model processes dataset in **300-row batches**.
- Progress and ranking are updated after execution completion.

### Output

- Metric matrix for selected metrics
- Comparative ranking and top model identification
- CSV export of benchmark results

---

## 📦 Validation Dataset Formats

### JSON
Array of objects, each object matching model input schema.

### CSV
Header row must match input field names; each row is one input sample.

### JSONL
One JSON object per line, each object matching input schema.

### Included dataset package

`manual_validation_datasets/` provides grouped benchmark datasets in all three formats.

---

## 🔌 API Endpoints

Core model endpoints:

```text
GET  /v3/models/executable
POST /v3/models/execute
GET  /v3/models/executions/:id
GET  /v3/models/executions
GET  /v3/assets/:id/executable
```

---

## 📈 Operations and Monitoring

- Frontend monitoring via benchmark/execution UI states
- Runtime logs via backend service logs
- Mock server dashboard at `http://localhost:8080`
- DB integrity checks through SQL scripts and maintenance utilities

---

## 🐛 Troubleshooting

### Benchmark appears slow on large datasets

- Confirm provider endpoints are responsive.
- Check backend logs for endpoint-level latency.
- Ensure selected models belong to the same schema-compatible group.

### Validation dataset rejected

- Verify field names exactly match schema.
- Verify data types and range constraints.
- Verify file format and encoding.

### Execution request failures

- Confirm executable endpoint is reachable from backend.
- Validate auth/session state.
- Check timeout and provider API availability.

---

## 🤝 Contributing

1. Create a focused branch.
2. Implement scoped changes.
3. Validate impacted flows.
4. Update docs if behavior changes.
5. Open pull request.

---

## 📝 License

AIModelHub is available under **Apache License 2.0**.

---

**Last Updated:** March 4, 2026  
**Version:** 2.6.0
