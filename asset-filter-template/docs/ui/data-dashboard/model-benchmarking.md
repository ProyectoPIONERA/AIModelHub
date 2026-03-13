# Model Benchmarking (DataDashboard)

## Route

- `/model-benchmarking`

## Purpose

Compare multiple executable models using a shared dataset, using the existing infer extension.

## Implemented behavior

- Reuses executable asset discovery from model execution service.
- Allows multi-select of executable models with immediate schema gating:
  - selecting a model without schema metadata is blocked immediately
  - selecting a model with incompatible schema is blocked immediately
  - once a reference model is selected, the list can auto-filter to compatible models
- Adds model discovery controls:
  - search (name/id/tags/tasks)
  - task filter (`All`, `Classification`, `Regression`, `NLP`, `Vision`, `Other`)
- Supports dataset upload:
  - `.json` (array, object, or object containing `rows`/`data`/`items`/`dataset`/`samples`)
  - `.jsonl`
  - `.csv` (header + rows)
- Adds dataspace dataset selection:
  - searchable dataset asset list (local + external)
  - explicit dataset selection (radio)
  - load selected dataset into benchmark rows
- Supports optional mapping fields:
  - `inputPath`: where to read request payload from each dataset row (fallback is full row)
  - `expectedPath`: where to read expected/ground-truth value from dataset row
  - `predictionPath`: where to read predicted value from infer response
- Enforces schema requirements before benchmark execution:
  - each selected model must provide input contract metadata (`daimo:input_schema` or `daimo:input_features`)
  - selected models must share the same feature contract
  - dataset rows must satisfy required fields and basic type checks
- Adds a **Validate Input** action before benchmark:
  - executes `1..3` sample dataset rows against selected models
  - uses same mapping + timeout settings
  - reports pass/fail quickly before full benchmark
- Calls infer endpoint for each `(model, row)` pair:
  - `POST {activeDefaultUrl}/api/infer`
  - body includes `assetId`, `path`, `payload`
- Executes requests in bounded parallel mode per model (`benchmarkParallelism`) instead of strictly sequential row-by-row calls.
- Tracks progress:
  - `completedRequests / totalRequests`
  - progress bar and status message
- Captures sampled execution errors for visibility.
- Produces ranked results table and CSV export.

## UX flow (current)

1. Load executable models.
2. Optionally search and filter by task.
3. Select models:
   - first selected model becomes compatibility reference
   - only models with equivalent input feature contract are selectable
4. Select dataset source:
   - pick and load a dataspace dataset asset, or
   - upload dataset file manually
5. Configure mapping (`inputPath`, optional `expectedPath` + `predictionPath`) and timeout.
6. Run **Validate Input**:
   - executes up to first 3 dataset rows against all selected models
   - confirms runtime compatibility before full benchmark
7. Run full benchmark:
   - executes all rows per model with bounded parallel requests
8. Review ranking and export CSV.

## Compatibility model (how selection is blocked)

- A model is immediately rejected if it has no normalized input feature metadata.
- A model is immediately rejected if its normalized feature signature differs from the reference selected model.
- Feature signature uses:
  - field name (case-insensitive)
  - normalized type (for example `int -> integer`, `float/double -> number`)
  - required flag
- `Select All` only selects schema-compatible models from the currently filtered list.
- Optional toggle `Auto-filter compatible schema` hides non-compatible models from the selector UI.

## Search and task filter behavior

- Search matches concatenated model `name`, `id`, `tags`, and `tasks`.
- Task categories are heuristic and mapped to:
  - `classification`
  - `regression`
  - `nlp`
  - `vision`
  - `other`
- Task detection uses model metadata tokens (`tasks`, `subtasks`, `keywords`) and name text.

## Validate Input behavior

- Validate Input runs lightweight probes before full benchmark:
  - sample size: `1..3` rows (currently first rows in dataset)
  - checks all selected models
  - uses same infer path, mapping, timeout
- Purpose:
  - fail fast on payload/mapping/runtime issues
  - reduce wasted full-benchmark runs
- Validation does not produce ranking results; it only confirms operational readiness.

## Dataspace dataset sourcing behavior

- Dataspace dataset list is derived from ML browser assets with dataset-oriented metadata heuristics.
- External dataset loading requires an existing finalized **consumer** agreement for that asset id.
- External load path:
  - resolve matching agreement/negotiation
  - initiate pull transfer
  - wait until transfer reaches `STARTED`/`COMPLETED`
  - download via EDR and parse payload as `json/jsonl/csv`
- Local load path:
  - attempts to parse inline dataset payload metadata from asset properties (`dataset/data/samples` and benchmark-specific keys)
  - if no inline payload exists, user must upload file manually (or use external agreed dataset)

## Parallel execution strategy

- Benchmark is executed per selected model.
- For each model, dataset rows are executed with bounded parallelism (worker pool).
- This replaces strict sequential row-by-row execution and improves throughput.
- Concurrency is intentionally bounded to avoid overloading connector/model runtime.

## Metrics produced

- `successRate`: successful requests over total samples
- `averageLatencyMs`
- `p95LatencyMs`
- `throughputRps`
- `accuracyPercent` (optional; only when `expectedPath` and `predictionPath` are set and values are resolvable)

## Ranking score

- If accuracy is available:
  - `score = 0.60 * accuracy + 0.25 * successRate + 0.15 * latencyScore`
- If accuracy is not available:
  - `score = 0.70 * successRate + 0.30 * latencyScore`
- `latencyScore` is normalized inverse latency across compared models (lower latency => higher score).

## Key files

- `DataDashboard/src/app/features/model-benchmarking/model-benchmarking.component.ts`
- `DataDashboard/src/app/features/model-benchmarking/model-benchmarking.component.html`
- `DataDashboard/src/app/services/dashboard-model-execution.service.ts`
- `DataDashboard/src/app/models/ml-gui-asset.ts`
- `DataDashboard/src/app/app.routes.ts`
- `DataDashboard/public/config/app-config.json`

## Notes

- This feature runs entirely in dashboard frontend code and does not require new connector endpoints.
- It depends on already available endpoints:
  - `POST /api/infer`
  - executable discovery path already used by model execution page
  - transfer/edr management APIs used by dashboard-core transfer module for dataspace dataset download
- Input schema metadata is authored in asset create/edit ML helper and stored as:
  - `daimo:input_schema`
  - `daimo:input_features` (auto-derived from schema)
  - `daimo:input_schema_draft`
  - `daimo:input_example`
- Benchmark results are not persisted server-side; export CSV if you need history.
- Benchmark tuning constants are currently set in component state:
  - `benchmarkParallelism = 8`
  - `validationParallelism = 6`
  - `validationSampleRows = 3`

## Local benchmark model pack (5 models)

The repository includes a local pack designed for this page:
- `resources/requests/ai-models/create-asset-infer-benchmark-text-keyword-v1.json`
- `resources/requests/ai-models/create-asset-infer-benchmark-text-bayes-v1.json`
- `resources/requests/ai-models/create-asset-infer-benchmark-text-linear-v1.json`
- `resources/requests/ai-models/create-asset-infer-benchmark-tabular-linear-v1.json`
- `resources/requests/ai-models/create-asset-infer-benchmark-tabular-tree-v1.json`

It is split into 2 shared input-contract groups:
- 3 text classification models (`urn:pionera:schema:text-classification:v1`)
- 2 tabular regression models (`urn:pionera:schema:tabular-regression:v1`)

Run from `asset-filter-template/`:

```bash
./tools/start-benchmark-model-servers.sh
./tools/register-benchmark-model-assets.sh
```

Stop:

```bash
./tools/stop-benchmark-model-servers.sh
```

Reference:
- `resources/requests/ai-models/README-benchmark-inference.md`

## Local benchmark datasets

Dataset pack location:
- `resources/benchmark-datasets/`
- `resources/benchmark-datasets/README.md`
- Dataset asset requests:
  - `resources/requests/ai-datasets/`
  - `resources/requests/ai-datasets/README-benchmark-datasets.md`

Main files:
- `resources/benchmark-datasets/text-benchmark-v1.json`
- `resources/benchmark-datasets/text-benchmark-v1.jsonl`
- `resources/benchmark-datasets/text-benchmark-v1-input-only.csv`
- `resources/benchmark-datasets/tabular-benchmark-v1.json`
- `resources/benchmark-datasets/tabular-benchmark-v1.jsonl`
- `resources/benchmark-datasets/tabular-benchmark-v1-input-only.csv`

Recommended mapping:
- Text JSON/JSONL: `inputPath=input`, `expectedPath=expected_label`, `predictionPath=result.label`
- Text CSV: `predictionPath=result.label` (no expected labels)
- Tabular JSON/JSONL: `inputPath=input`, `predictionPath=result.value`
- Tabular CSV: `predictionPath=result.value`

Register dataset assets (from `asset-filter-template/`):

```bash
./tools/register-benchmark-dataset-assets.sh
```

Behavior note:
- If a dataset asset contains inline `daimo:benchmark_dataset` rows, DataDashboard loads those rows directly (for local and external assets) before attempting transfer.
- This avoids browser-side downloads from dataplane `/public` for inline benchmark packs, which can otherwise fail due to CORS/network setup.
