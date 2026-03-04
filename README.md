# 🚀 AIModelHub

**AI Model Management Platform for Data Spaces**

AIModelHub is an EDC-compatible platform with a Node.js runtime and Angular frontend to register, discover, execute, and benchmark AI models in a data space.

---

## 🎯 Project Status

**Version 2.6** — fully implemented for the defined project scope:

- ✅ Ontology-based descriptive model metadata integrated into the data-space catalog
- ✅ Model catalog and discovery with metadata filters and keyword search
- ✅ HTTP model execution through connector-to-provider API invocation
- ✅ Comparative model benchmarking with schema-compatible selection and manual validation datasets

---

## 📚 Documentation

### 📖 **[Complete Guide](GUIDE.md)** ← Start here

The guide includes:
- System architecture and folder structure
- Installation and deployment
- Ontology and metadata model
- Catalog discovery workflow
- HTTP model execution flow
- Benchmarking workflow and data formats
- Troubleshooting and operations

---

## ⚡ Quick Start

```bash
# Clone repository
git clone <repository-url>
cd AIModelHub

# Deploy all services
./deploy.sh

# Access application
# Frontend: http://localhost:4200
# Login: user-conn-user1-demo / user1123
```

---

## 🎯 Key Features

### 1) Ontology-driven metadata registration
- ✅ Descriptive ML metadata modeled through project ontology (`JS_Pionera_Ontology` aligned)
- ✅ Metadata persisted in catalog tables and exposed to UI/API
- ✅ Input schema (`input_features`) stored for execution and benchmarking validation

### 2) Model catalog and discovery
- ✅ Catalog browsing across registered assets
- ✅ Filtering by metadata fields (task, algorithm, framework, storage, etc.)
- ✅ Keyword search for fast discovery and model shortlisting
- ✅ Discovery-driven model selection before negotiation workflows

### 3) HTTP model execution in data space
- ✅ Models registered as `HttpData` with provider endpoint metadata
- ✅ Connector executes provider-hosted model API with user input
- ✅ Connector receives outputs and presents results to the consumer
- ✅ Execution history and status tracking available

### 4) Model benchmarking
- ✅ 25 HTTP benchmark models grouped by compatible input schema
- ✅ First model free selection; subsequent models constrained by schema compatibility
- ✅ Manual validation dataset upload for `Run Benchmark` (`JSON` / `CSV` / `JSONL`)
- ✅ Batch benchmark processing (300 rows per batch)
- ✅ Comparative ranking and metric reporting

---

## 📁 Project Structure

```text
AIModelHub/
├── deploy.sh
├── README.md
├── GUIDE.md
├── 25_MODELS_BENCHMARKING_GUIDE.md
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

## 🔧 Requirements

| Component | Version | Check |
|-----------|---------|-------|
| Docker | 20.10+ | `docker --version` |
| Node.js | 18+ | `node --version` |
| npm | 9+ | `npm --version` |
| Python | 3.8+ | `python3 --version` |

Recommended resources: 2 CPU cores, 4 GB RAM, 10 GB disk.

---

## 🌐 Services

After deployment:

| Service | URL | Credentials |
|---------|-----|-------------|
| Frontend | http://localhost:4200 | user-conn-user1-demo / user1123 |
| Backend API | http://localhost:3000 | - |
| Mock Server | http://localhost:8080 | - |
| MinIO Console | http://localhost:9001 | minioadmin / minioadmin123 |
| PostgreSQL | localhost:5432 | ml_assets_user / ml_assets_password |

---

## 🧪 Testing (Execution + Benchmark)

1. Open frontend and login.
2. Validate single-model execution in `IA Execution`.
3. Open `Model Benchmarking`.
4. Select compatible models from Model Pool.
5. Upload a manual validation dataset (`JSON`, `CSV`, or `JSONL`).
6. Run `Run Benchmark` and verify batch progress.
7. Review ranking and export outputs.

---

## 📖 Documentation Structure

- **[GUIDE.md](GUIDE.md)**: Full technical and operational documentation
- **[25_MODELS_BENCHMARKING_GUIDE.md](25_MODELS_BENCHMARKING_GUIDE.md)**: Benchmark model groups and scenarios
- **[DEPURACION_REPORT.md](DEPURACION_REPORT.md)**: Cleanup and optimization report

---

## 🤝 Contributing

1. Create a feature branch.
2. Implement focused changes.
3. Validate impacted functionality.
4. Update documentation when needed.
5. Open a pull request.

---

## 🐛 Troubleshooting

For common issues (ports, DB connectivity, CORS, model execution, benchmark performance), see [GUIDE.md](GUIDE.md).

---

## 🧹 System Maintenance

```bash
./cleanup-project.sh
```

This script removes temporary artifacts, cleans Python caches, and checks DB integrity.

---

## 📋 Additional Documentation

- [GUIDE.md](GUIDE.md)
- [25_MODELS_BENCHMARKING_GUIDE.md](25_MODELS_BENCHMARKING_GUIDE.md)
- [DEPURACION_REPORT.md](DEPURACION_REPORT.md)

---

## 📝 License

AIModelHub is released under the **[Apache License 2.0](https://github.com/ProyectoPIONERA/AIModelHub/blob/main/LICENSE)**.

---

## 🙏 Acknowledgments

- Inspired by Eclipse Dataspace Components (EDC)
- Built with Angular, Node.js/Express, PostgreSQL, and MinIO
- Funded under the PIONERA initiative in the PRTR / NextGenerationEU framework

---

## 👥 Authors and Contact

- **Maintainers:** Edmundo Mori, Jiayun Liu
- **Contact:**
  - edmundo.mori.orrillo@upm.es
  - jiayun.liu@alumnos.upm.es

---

**Last Updated:** March 4, 2026

**Version:** 2.6.0
