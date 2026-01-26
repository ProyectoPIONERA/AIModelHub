# 🚀 AIModelHub

**AI Model Management Platform for Data Spaces**

EDC-compatible platform with Node.js runtime and Angular frontend for exploring, registering, and executing AI models with S3 storage, rich metadata, and real-time execution capabilities.

---

## 🎯 Project Status

**Version 2.0** - Fully functional AI model lifecycle platform for data spaces:
- ✅ Asset registration and discovery
- ✅ EDC-style policies and contracts
- ✅ Provider-consumer negotiations
- ✅ **Model execution through HTTP endpoints (NEW)**
- ✅ Real-time execution monitoring
- ✅ Mock server with sample models

---

## 📚 Documentation

### 📖 **[Complete Guide](GUIDE.md)** ← Start Here!

The complete guide includes:
- Features and architecture
- Quick start (one command deployment)
- Model execution tutorial
- Testing guide
- Troubleshooting
- Development workflow

---

## ⚡ Quick Start

```bash
# Clone repository
git clone <repository-url>
cd AIModelHub

# Deploy everything (3-5 minutes)
./deploy.sh

# Access application
# Frontend: http://localhost:4200
# Login: user-conn-user1-demo / user1123
```

---

## 🎯 Key Features

### Core Platform
- ✅ EDC-compatible backend with modular extensions
- ✅ Asset management and ML metadata
- ✅ PostgreSQL + MinIO S3 storage
- ✅ Angular 18 frontend
- ✅ Authentication and access control
- ✅ Contract definitions and catalog federation

### Model Execution (NEW) 🚀
- ✅ Execute models via HTTP REST API
- ✅ Visual execution dashboard
- ✅ JSON input editor with validation
- ✅ Result visualization and history
- ✅ Mock server with 3 sample models
- ✅ Real-time execution monitoring

---

## 📁 Project Structure

```
AIModelHub/
├── deploy.sh                       # One-command deployment
├── GUIDE.md                        # Complete documentation
├── README.md                       # This file
│
├── AIModelHub_Extensiones/         # Backend logic
│   ├── backend/                    # Node.js + Express
│   │   ├── edc-extensions/        # Modular extensions
│   │   │   └── model-execution/   # NEW: Model execution
│   │   └── src/                   # Source code
│   ├── database/                   # PostgreSQL schemas
│   ├── model-server/               # Python mock server
│   └── docker-compose.yml         # Infrastructure
│
└── AIModelHub_EDCUI/              # Frontend
    └── ml-browser-app/            # Angular 18 UI
        └── src/app/pages/
            ├── ml-assets-browser/
            ├── model-execution/   # NEW: Execution UI
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

**Resources:** 2 CPU cores, 4 GB RAM, 10 GB disk

---

## 🌐 Services

After deployment:

| Service | URL | Credentials |
|---------|-----|-------------|
| **Frontend** | http://localhost:4200 | user-conn-user1-demo / user1123 |
| **Backend API** | http://localhost:3000 | - |
| **Mock Server** | http://localhost:8080 | - |
| **MinIO Console** | http://localhost:9001 | minioadmin / minioadmin123 |
| **PostgreSQL** | localhost:5432 | ml_assets_user / ml_assets_password |

---

## 🧪 Testing Model Execution

1. Open http://localhost:4200 and login
2. Click "IA Execution" in navigation menu
3. Select "Iris Classifier Demo API"
4. Click "Execute Model"
5. View results and execution history
6. Monitor on http://localhost:8080

**See [GUIDE.md](GUIDE.md) for detailed testing scenarios**

---

## 📖 Documentation Structure

- **[GUIDE.md](GUIDE.md)** - Complete guide with all details
  - Architecture
  - Deployment
  - Model Execution
  - Testing
  - Troubleshooting
  - Development

---

## 🤝 Contributing

1. Read [GUIDE.md](GUIDE.md) - Contributing section
2. Create feature branch
3. Make changes
4. Test thoroughly
5. Submit pull request

---

## 🐛 Troubleshooting

Common issues and solutions in [GUIDE.md](GUIDE.md) - Troubleshooting section:
- Port conflicts
- Database connection errors
- Frontend compilation issues
- Model execution failures

---

---

## 📝 License

## 📝 License

AIModelHub is available under the **[Apache License 2.0](https://github.com/ProyectoPIONERA/AIModelHub/blob/main/LICENSE)**.

---

## 🙏 Acknowledgments

- Inspired by Eclipse Dataspace Components (EDC)
- Base technologies: Angular, Express/Node.js, PostgreSQL, MinIO

### Funding

This work has received funding from the **PIONERA project** (Enhancing interoperability in data spaces through artificial intelligence), a project funded in the context of the call for Technological Products and Services for Data Spaces of the Ministry for Digital Transformation and Public Administration within the framework of the PRTR funded by the European Union (NextGenerationEU).

<div align="center">
  <img src="funding_label.png" alt="Logos financiación" width="900" />
</div>

---

## 👥 Authors and Contact

- **Maintainers:** Edmundo Mori, Jiayun Liu
- **Contact:** 
  - edmundo.mori.orrillo@upm.es
  - jiayun.liu@alumnos.upm.es

---

**Last Updated:** January 26, 2026  
**Version:** 2.0.0
