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

- Local 8-step deployment process for common services, dataspace services and
  connectors.
- PIONERA-themed connector interface with AI model workflows.
- AI Model Browser for model discovery and metadata inspection.
- AI Model Execution for HTTP model invocation.
- AI Model Benchmarking for comparable model evaluation.
- AI Model Observer for execution and benchmark evidence.
- Combined FastAPI model server for PIONERA use-case models and deterministic
  mock HTTP endpoints.
- Metadata seeding based on `JS_Metadata_Daimo.schema.json`.

## Repository Layout

The most relevant project areas are:

```text
AIModelHub_Pionera/
|-- README.md
|-- JS_Metadata_Daimo.schema.json
|-- inesdata_local_deploy.py
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

By default, `inesdata_local_deploy.py` resolves
`AIModelHub_Uses_Cases` automatically from that sibling layout. If the use-case
repository is located elsewhere, pass:

```bash
python3 inesdata_local_deploy.py --use-case-model-server-dir <path-to-AIModelHub_Uses_Cases>
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
python3 inesdata_local_deploy.py
```

Run the full non-interactive deployment after confirming that manual network
steps are ready:

```bash
python3 inesdata_local_deploy.py --non-interactive --manual-ready
```

The menu exposes this flow:

```text
0 - Run all steps (1-8) sequentially

1 - Step 1: Setup cluster + deploy common services
2 - Step 2: Confirm tunnel + ingress port-forward
3 - Step 3: Build local images
4 - Step 4: Deploy dataspace
5 - Step 5: Deploy connectors
6 - Step 6: Run validation tests
7 - Step 7: Deploy/Start ML Model Server
8 - Step 8: Seed vocabulary + ML assets + contracts
```

### Step 7: Model Server

The default mode is `combined`:

```bash
python3 inesdata_local_deploy.py --model-server-mode combined
```

This starts one host FastAPI server that exposes:

- FLARES endpoints imported from `AIModelHub_Uses_Cases`.
- Mobility endpoints imported from `AIModelHub_Uses_Cases`.
- Deterministic mock `HttpData` endpoints from `combined_model_server/`.

Other modes are available for targeted validation:

```bash
python3 inesdata_local_deploy.py --model-server-mode use-cases
python3 inesdata_local_deploy.py --model-server-mode mock
```

The connector-facing model server URL defaults to:

```text
http://host.docker.internal:8000
```

That URL is used by Docker-backed Minikube pods to reach the FastAPI server
running on the host.

### Step 8: Metadata And Assets

Step 8 seeds the vocabulary, model assets, policies and contracts.

In the default combined deployment it registers:

- FLARES and Mobility PIONERA use-case models as `HttpData`.
- Deterministic mock HTTP models as `HttpData`.
- Additional deterministic stored models as `InesDataStore`.
- DAIMO-aligned metadata from `JS_Metadata_Daimo.schema.json`.

The script responsible for this step is:

```text
scripts/seed_ml_assets_for_connectors.sh
```

## PIONERA Use Cases

### FLARES

FLARES models process Spanish text for event extraction and reliability
classification.

Registered models:

- `FLARES 5W1H DistilBERT - PIONERA Use Case`
- `FLARES Reliability DistilBERT - PIONERA Use Case`

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
- Step 8 was rerun after metadata or endpoint changes.

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
python3 inesdata_local_deploy.py --help
python3 inesdata_local_deploy.py --model-server-mode combined
```

Check the use-case model server directly:

```bash
curl http://127.0.0.1:8000/models
```

## Documentation

- `DEPLOYMENT_TRACEABILITY.md`: traceability for the local 8-step deployment.
- `JS_Metadata_Daimo.schema.json`: metadata schema for model registration.
- `AIModelHub_Uses_Cases/README.md`: companion use-case repository guide.

## Maintainers

- Edmundo Mori
- Jiayun Liu

Contact:

- edmundo.mori.orrillo@upm.es
- jiayun.liu@alumnos.upm.es

Last updated: June 4, 2026
