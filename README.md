# AIModelHub_Pionera

AIModelHub_Pionera is a local data-space and AI model hub workspace for the
PIONERA use cases. It provides a complete local deployment flow to register,
discover, execute, benchmark and observe AI models through connector-managed
assets.

This repository focuses on the PIONERA implementation. Some file and directory
names still contain `inesdata` because those are literal code paths used by the
deployment scripts and component sources. Those names are documented only when
they are needed to run or understand the code.

## Main Capabilities

- Local 10-step deployment process for common services, dataspace services and
  connectors.
- PIONERA-themed connector interface with AI model workflows.
- AI Model Browser for model discovery and metadata inspection.
- AI Model Execution for HTTP model invocation.
- AI Model Benchmarking for comparable model evaluation.
- AI Model Observer for execution and benchmark evidence.
- Combined FastAPI model server for PIONERA use-case models and deterministic
  mock HTTP endpoints.
- Metadata seeding based on `daimo_model.schema.json` and `daimo_dataset.schema.json`.

## Repository Layout

The most relevant project areas are:

```text
AIModelHub_Pionera/
|-- README.md
|-- daimo_model.schema.json
|-- daimo_dataset.schema.json
|-- pionera_local_deploy.py
|-- runtime_dependencies.py
|-- requirements.txt
|
|-- combined_model_server/
|   `-- server.py
|
|-- scripts/
|   |-- seed_ml_assets_for_connectors.sh
|   |-- run-minikube-tunnel.sh
|   `-- run_kafka_benchmark.sh
|
|-- adapters/
|   `-- inesdata/
|       |-- scripts/
|       `-- sources/
|           |-- inesdata-connector/
|           |-- inesdata-connector-interface/
|           |-- inesdata-registration-service/
|           |-- inesdata-public-portal-backend/
|           |-- inesdata-public-portal-frontend/
|           `-- model-server/
|
|-- inesdata-deployment/
|   |-- common/
|   |-- dataspace/
|   |-- connector/
|   |-- components/
|   `-- deployer.py
|
|-- validation/
|-- framework/
`-- experiments/
```

Generated runtime state is written mainly under:

```text
.inesdata-local/
experiments/
newman/
node_modules/
validation/ui/node_modules/
inesdata-deployment/deployments/
```

These directories are local runtime outputs and should not be treated as stable
source state.

## Related Use-Case Repository

The default deployment expects the PIONERA use-case server repository to exist
as a sibling of this repository:

```text
<workspace>/
  AIModelHub_Pionera/
  AIModelHub_Uses_Cases/
```

By default, `pionera_local_deploy.py` resolves
`AIModelHub_Uses_Cases` automatically from that sibling layout. If the use-case
repository is located elsewhere, pass:

```bash
python3 pionera_local_deploy.py --use-case-model-server-dir <path-to-AIModelHub_Uses_Cases>
```

or set:

```bash
export USE_CASE_MODEL_SERVER_DIR=<path-to-AIModelHub_Uses_Cases>
```

The use-case repository must contain the prepared FastAPI app, virtual
environment and trained model artifacts for FLARES and Mobility.

## Deployment

Run the interactive deployment menu from the repository root:

```bash
cd <workspace>/AIModelHub_Pionera
python3 pionera_local_deploy.py
```

Run the full non-interactive deployment after confirming that manual network
steps are ready:

```bash
python3 pionera_local_deploy.py --non-interactive --manual-ready
```

The menu exposes this flow:

```text
0 - Run all steps (1-10) sequentially

1 - Step 1: Setup cluster + deploy common services
2 - Step 2: Confirm tunnel + ingress port-forward
3 - Step 3: Build local images
4 - Step 4: Deploy dataspace
5 - Step 5: Deploy connectors
6 - Step 6: Run validation tests
7 - Step 7: Deploy/Start ML Model Server
8 - Step 8: Seed DAIMO vocabularies
9 - Step 9: Seed benchmark datasets + contracts
10 - Step 10: Seed FLARES/Mobility model assets + contracts
```

### Step 7: Model Server

The default mode is `combined`:

```bash
python3 pionera_local_deploy.py --model-server-mode combined
```

This starts one host FastAPI server that exposes:

- FLARES endpoints imported from `AIModelHub_Uses_Cases`.
- Mobility endpoints imported from `AIModelHub_Uses_Cases`.
- Deterministic mock `HttpData` endpoints from `combined_model_server/`.

Other modes are available for targeted validation:

```bash
python3 pionera_local_deploy.py --model-server-mode use-cases
python3 pionera_local_deploy.py --model-server-mode mock
```

The connector-facing model server URL defaults to:

```text
http://host.docker.internal:8000
```

That URL is used by Docker-backed Minikube pods to reach the FastAPI server
running on the host.

### Step 8: DAIMO Vocabularies

Step 8 seeds the DAIMO model and dataset vocabularies.

The old base/mock model assets are optional. To seed those extra demo assets
and model contracts as well, run the deployer with:

```bash
python3 pionera_local_deploy.py --seed-base-mock-assets
```

The FLARES/Mobility use-case model assets are handled by Step 10.

### Step 9: Benchmark Datasets

Step 9 seeds benchmark dataset assets and dataset contracts separately from the
model assets. The default use-case dataset assets are published by the Company
connector and negotiated for City Council.

The script responsible for this step is:

```text
scripts/seed_ml_assets_for_connectors.sh
```

### Step 10: Use-Case Model Assets

Step 10 seeds the running FLARES/Mobility FastAPI models as `HttpData` assets.
It does not upload model files or create stored model placeholders.

The use-case FastAPI server exposes 15 prediction models: 6 FLARES models and 9
Mobility models. The FLARES prediction models also expose 6 `/metrics`
endpoints, which are registered as metric model assets for benchmark runs that
need model-side custom evaluation.

Start the use-case server from the use-case folder:

```bash
cd AIModelHub-Use-Cases
source .venv/bin/activate
uvicorn src.server:app --reload --host 0.0.0.0 --port 8000
```

If the connectors are already deployed and only the use-case model assets need
to be registered, run:

```bash
bash scripts/seed_ml_assets_for_connectors.sh \
  --seed-scope models \
  --model-set use-cases \
  --include-use-case-models \
  --skip-inesdata-models \
  --use-case-model-server-base-url http://host.docker.internal:8000
```

Use-case model assets are split between the two connectors. City Council
publishes 10 use-case HttpData assets and Company publishes 11 use-case HttpData
assets; cross-connector contracts make the opposite side available to each
consumer.

## PIONERA Use Cases

### FLARES

FLARES models process Spanish text for event extraction and reliability
classification.

Registered models:

- `FLARES 5W1H ALBERT - PIONERA Use Case`
- `FLARES Reliability ALBERT - PIONERA Use Case`
- `FLARES 5W1H BERT - PIONERA Use Case`
- `FLARES Reliability BERT - PIONERA Use Case`
- `FLARES 5W1H DistilBERT - PIONERA Use Case`
- `FLARES Reliability DistilBERT - PIONERA Use Case`

Each FLARES model also has a metric model asset that points to its `/metrics`
endpoint.

Typical 5W1H input:

```json
[
  {
    "Id": 840,
    "Text": "El comité de medicamentos humanos espera concluir el análisis en marzo."
  }
]
```

The benchmark flow evaluates FLARES models with classification-oriented metrics:

- Precision
- Recall
- F1 Score

### Mobility

Mobility models predict public transport timing signals from GTFS-like segment
features.

Registered models:

- `Mobility LightGBM Actual Travel Time - PIONERA Use Case`
- `Mobility Random Forest Actual Travel Time - PIONERA Use Case`
- `Mobility CatBoost Actual Travel Time - PIONERA Use Case`
- `Mobility LightGBM Delay - PIONERA Use Case`
- `Mobility Random Forest Delay - PIONERA Use Case`
- `Mobility CatBoost Delay - PIONERA Use Case`
- `Mobility LightGBM Previous Delay - PIONERA Use Case`
- `Mobility Random Forest Previous Delay - PIONERA Use Case`
- `Mobility CatBoost Previous Delay - PIONERA Use Case`

FastAPI endpoints:

```text
/mobility/lightgbm_actual_travel_time
/mobility/randomforest_actual_travel_time
/mobility/catboost_actual_travel_time
/mobility/lightgbm_delay
/mobility/randomforest_delay
/mobility/catboost_delay
/mobility/lightgbm_previous_delay
/mobility/randomforest_previous_delay
/mobility/catboost_previous_delay
```

Mobility benchmark metrics:

- MAE
- RMSE
- R2

The validation dataset can contain all input and target columns together. During
execution, AI Model Benchmarking filters the payload per model:

- `actual_travel_time` and `delay` models use 13 input columns.
- `previous_delay` models use 11 input columns.
- `actual_travel_time`, `delay` and `previous_delay` are used as targets,
  depending on the selected model.

## AI Model Browser

AI Model Browser lists machine-learning assets registered through the connector
catalog. The seeded metadata includes:

- Model name, version and description.
- Asset source and data address type.
- Task, subtask, algorithm, framework and library metadata.
- Input feature definitions.
- Input examples.
- Evaluation metrics.

Use-case models include the keyword `pionera-use-case`.

## AI Model Execution

AI Model Execution allows users to run registered HTTP models from the browser
interface. For PIONERA use-case models, payloads are normalized as JSON arrays
because the FastAPI endpoints expect batch-style requests.

Execution history records status, latency, timestamp and result payloads. These
events are also available to AI Model Observer.

## AI Model Benchmarking

AI Model Benchmarking compares compatible models with validation datasets.

Compatibility rules:

- FLARES models are comparable within the FLARES family.
- Mobility models are comparable within the Mobility family.
- Other models are compared when their input schemas are compatible.

Dataset support:

- CSV
- JSON
- JSONL

For Mobility, CSV parsing preserves identifier columns such as `trip_id`,
`from_stop_id`, `to_stop_id` and `route_id` as strings, while numeric columns are
converted to numbers. This is required because the FastAPI service applies the
same categorical encoding used during model training.

## AI Model Observer

AI Model Observer provides local visibility into model activity:

- Home summary
- Participant view
- Agreement view
- Timeline view
- Benchmark evidence view

The observer is intended to make model execution and benchmark evidence
traceable from the same connector interface.

## Requirements

Recommended environment:

| Component | Purpose |
|-----------|---------|
| Docker | Local images and Docker-backed Minikube runtime |
| Minikube | Local Kubernetes cluster |
| kubectl | Kubernetes management |
| Helm | Chart deployment |
| Python 3.10+ | Deployment, validation and FastAPI orchestration |
| Node.js 18+ | Angular connector interface build |
| npm / Newman | API validation collections |
| Java / Gradle | Java component builds |

Recommended resources:

- 4 CPU cores or more.
- 8 GB RAM or more.
- 20 GB free disk space or more.

## Validation

Run validation through Step 6 or through the full deployment flow.

The validation system uses:

- Newman collections under `validation/core/collections/`.
- Python orchestration under `framework/`.
- Experiment outputs under `experiments/`.

To validate the Angular connector interface build:

```bash
cd <workspace>/AIModelHub_Pionera/adapters/inesdata/sources/inesdata-connector-interface
node node_modules/@angular/cli/bin/ng.js build
```

## Operational Notes

### Tunnel And Port Forwarding

Keep the Minikube tunnel and ingress port-forwarding active while using the
local connector UI and validation flows.

If the helper script lacks execute permission:

```bash
chmod +x scripts/run-minikube-tunnel.sh
./scripts/run-minikube-tunnel.sh
```

### Model Server Reachability

If AI Model Execution returns a provider-side error for FLARES or Mobility,
check:

- Step 7 is running in `combined` or `use-cases` mode.
- The FastAPI server responds on `http://127.0.0.1:8000/models`.
- The connector-facing URL is reachable from Minikube pods.
- `AIModelHub_Uses_Cases` has prepared model artifacts.
- Step 10 was rerun after model metadata or endpoint changes.
- Step 9 was rerun after benchmark dataset metadata changes.

### Rebuilding Local Images

When UI or component source files change, rebuild and reload the affected local
image before redeploying connectors. The deployment process is configured to
avoid relying on stale previously loaded images.

### Credentials

Files under `inesdata-deployment/deployments/DEV/demo/` are generated local demo
credentials. Treat them as runtime artifacts and avoid using them as production
secrets.

## Useful Commands

```bash
git status --short
python3 pionera_local_deploy.py --help
python3 pionera_local_deploy.py --model-server-mode combined
```

Check the use-case model server directly:

```bash
curl http://127.0.0.1:8000/models
```

## Documentation

- `DEPLOYMENT_TRACEABILITY.md`: traceability for the local 10-step deployment.
- `daimo_model.schema.json`: DAIMO model metadata schema.
- `daimo_dataset.schema.json`: DAIMO dataset metadata schema.
- `AIModelHub_Uses_Cases/README.md`: companion use-case repository guide.

---

## Funding

This work has received funding from the PIONERA project (Enhancing interoperability in data spaces through artificial intelligence), a project funded in the context of the call for Technological Products and Services for Data Spaces of the Ministry for Digital Transformation and Public Administration within the framework of the PRTR funded by the European Union (NextGenerationEU)

<div align="center">
  <img src="funding_label.png" alt="Logos financiación" width="900" />
</div>
