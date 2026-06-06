# Deployment Traceability

This project is organized around `inesdata_local_deploy.py`. The deployment
pipeline expects the following local assets to exist with the same relative
paths shown here.

## Entrypoints

- `inesdata_local_deploy.py`: local 10-step deployment workflow.
- `main.py`: validation and metrics CLI invoked by Step 6.
- `runtime_dependencies.py`: runtime dependency bootstrap helper.
- `requirements.txt`: Python dependencies for deployment, validation and
  metrics.
- `package.json` and `package-lock.json`: local Newman dependency for API
  validation collections.

## INESData Adapter

- `adapters/inesdata/adapter.py`: adapter facade consumed by the local
  deployment entrypoint and `main.py`.
- `adapters/inesdata/config.py`: path, namespace, Helm release and credential
  resolution.
- `adapters/inesdata/infrastructure.py`: Minikube, hosts, Helm, Vault and
  common-services lifecycle.
- `adapters/inesdata/deployment.py`: dataspace lifecycle.
- `adapters/inesdata/connectors.py`: connector creation, readiness and
  credential handling.
- `adapters/inesdata/components.py`: optional component chart lifecycle.

## Image Build Sources

Step 3 builds local images from `adapters/inesdata/sources/`:

- `inesdata-connector`
- `inesdata-connector-interface`
- `inesdata-registration-service`
- `inesdata-public-portal-backend`
- `inesdata-public-portal-frontend`

Step 7 can build and deploy the isolated mock mode:

- `model-server`

The default Step 7 mode is `--model-server-mode combined`. It starts one host
FastAPI process from `combined_model_server.server:app`. That wrapper imports
the prepared FLARES/Mobility app from `--use-case-model-server-dir` and registers
deterministic mock HttpData endpoints on the same app instance.
The connector-facing default URL is `http://host.docker.internal:8000`, because
that route is reachable from the Docker-backed Minikube pods.

The older `--model-server-mode use-cases` mode starts only the prepared
FLARES/Mobility FastAPI model server on the host.

Only the required Java runtime artifacts are retained under `build/libs/`:

- `inesdata-connector/launchers/connector/build/libs/connector-app.jar`
- `inesdata-registration-service/build/libs/registration-service-*.jar`

Other build caches are intentionally excluded.

## Local Build Scripts

- `adapters/inesdata/scripts/fast_step1_images.sh`: clean local image rebuild
  for all INESData components.
- `adapters/inesdata/scripts/build_images.sh`: component image build helper.
- `adapters/inesdata/scripts/local_build_load_deploy.sh`: image loading and
  Helm upgrade helper for local image overrides.

## Platform Bundle

`inesdata-deployment/` is the local platform bundle used by Helm and
`deployer.py`.

Required subtrees:

- `common/`: common-services Helm chart and vendored chart archives.
- `dataspace/registration-service/`: registration-service chart.
- `dataspace/public-portal/`: public portal chart.
- `connector/`: connector chart, templates and values.
- `components/`: optional component charts.
- `deployer.py`, `requirements.txt`, `deployer.config,template`.

Generated runtime state is not copied:

- `inesdata-deployment/deployments/`
- `inesdata-deployment/common/init-keys-vault.json`
- Python virtual environments
- Git metadata

## Validation And Seeding

- `validation/core/collections/`: Newman collections.
- `validation/core/tests/` and `validation/shared/api/`: injected Newman test
  scripts.
- `validation/ui/`: Playwright validation support.
- `framework/`: experiment storage, validation engine, metrics, Kafka support
  and reporting.
- `scripts/seed_ml_assets_for_connectors.sh`: Step 8 vocabulary/base model
  seeding, Step 9 benchmark dataset seeding and Step 10 use-case model seeding.
- `JS_Metadata_Daimo.schema.json`: vocabulary schema used by Steps 8, 9 and 10.
- `combined_model_server/`: default Step 7 wrapper for the combined local model
  server.

The default Step 8 model set is `combined` because `--seed-model-set auto`
follows the default `--model-server-mode combined`, but Step 8 skips
FLARES/Mobility use-case models because those are handled by Step 10. Step 8
registers:

- 10 deterministic mock assets as `HttpData`, pointing to the same combined host
  FastAPI server.
- 5 deterministic mock assets as `InesDataStore`.

Step 9 uses the same seed script with `--seed-scope datasets` to publish the
use-case benchmark datasets and dataset contracts separately from Step 8.

Step 10 uses the same seed script with `--model-set use-cases` and
`--skip-inesdata-models` to register 15 FLARES/Mobility prediction assets plus 6
FLARES metric-model assets as `HttpData`.

## Runtime Outputs

The following paths are generated locally and ignored:

- `.inesdata-local/`
- `experiments/`
- `newman/`
- `node_modules/`
- `validation/ui/node_modules/`
- `inesdata-deployment/deployments/`
