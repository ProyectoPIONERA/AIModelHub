"""Combined use-case and deterministic mock model server.

The deployment starts this module with the AIModelHub_Uses_Cases virtualenv.
It imports the prepared FLARES/Mobility FastAPI app and registers additional
mock HttpData endpoints on the same app instance, so Step 7 exposes one host
server for every executable HTTP model used by the default Step 8 metadata.
"""

from __future__ import annotations

import hashlib
import importlib
import os
import sys
from pathlib import Path
from typing import Any, Dict, Iterable, List

from fastapi import Request


def _default_use_case_server_dir() -> str:
    project_root = Path(__file__).resolve().parents[1]
    return str(project_root.parent / "AIModelHub_Uses_Cases")


DEFAULT_USE_CASE_SERVER_DIR = _default_use_case_server_dir()
DEFAULT_MOCK_HTTP_COUNT = 10
MAX_MOCK_HTTP_COUNT = 15

MOCK_MODELS: List[Dict[str, str]] = [
    {"slug": "chest-xray", "endpoint": "/api/v1/vision/chest-xray", "group": "vision"},
    {"slug": "pneumonia", "endpoint": "/api/v1/vision/pneumonia", "group": "vision"},
    {"slug": "covid19", "endpoint": "/api/v1/vision/covid19", "group": "vision"},
    {"slug": "lung-nodule", "endpoint": "/api/v1/vision/lung-nodule", "group": "vision"},
    {"slug": "tuberculosis", "endpoint": "/api/v1/vision/tuberculosis", "group": "vision"},
    {"slug": "ecommerce-sentiment", "endpoint": "/api/v1/nlp/ecommerce-sentiment", "group": "nlp"},
    {"slug": "twitter-sentiment", "endpoint": "/api/v1/nlp/twitter-sentiment", "group": "nlp"},
    {"slug": "product-review", "endpoint": "/api/v1/nlp/product-review", "group": "nlp"},
    {"slug": "customer-feedback", "endpoint": "/api/v1/nlp/customer-feedback", "group": "nlp"},
    {"slug": "social-media-sentiment", "endpoint": "/api/v1/nlp/social-media", "group": "nlp"},
    {"slug": "bmi", "endpoint": "/api/v1/health/bmi", "group": "health"},
    {"slug": "body-fat", "endpoint": "/api/v1/health/body-fat", "group": "health"},
    {"slug": "bmr", "endpoint": "/api/v1/health/bmr", "group": "health"},
    {"slug": "ideal-weight", "endpoint": "/api/v1/health/ideal-weight", "group": "health"},
    {"slug": "health-risk", "endpoint": "/api/v1/health/risk-assessment", "group": "health"},
]


def _use_case_server_dir() -> str:
    configured_dir = os.environ.get("USE_CASE_SERVER_DIR") or os.environ.get("USE_CASE_MODEL_SERVER_DIR")
    return os.path.abspath(os.path.expanduser(configured_dir or DEFAULT_USE_CASE_SERVER_DIR))


def _mock_http_count() -> int:
    raw_value = os.environ.get("COMBINED_MOCK_HTTP_COUNT", str(DEFAULT_MOCK_HTTP_COUNT))
    try:
        count = int(raw_value)
    except ValueError:
        count = DEFAULT_MOCK_HTTP_COUNT
    return max(1, min(count, MAX_MOCK_HTTP_COUNT))


def _load_use_case_app():
    server_dir = _use_case_server_dir()
    if server_dir not in sys.path:
        sys.path.insert(0, server_dir)

    try:
        module = importlib.import_module("src.server")
    except Exception as exc:  # pragma: no cover - startup diagnostic path
        raise RuntimeError(
            "Unable to import AIModelHub_Uses_Cases src.server. "
            f"Check USE_CASE_SERVER_DIR={server_dir} and that FLARES/Mobility models are prepared."
        ) from exc

    return module.app


app = _load_use_case_app()


def _records_from_payload(payload: Any) -> List[Dict[str, Any]]:
    if isinstance(payload, list):
        return [item if isinstance(item, dict) else {"value": item} for item in payload]
    if isinstance(payload, dict):
        return [payload]
    return [{"value": payload}]


def _score(slug: str, record: Dict[str, Any]) -> float:
    digest = hashlib.sha256(f"{slug}:{record}".encode("utf-8")).hexdigest()
    return round(0.70 + (int(digest[:4], 16) % 2500) / 10000, 4)


def _numeric(record: Dict[str, Any], key: str, default: float) -> float:
    try:
        return float(record.get(key, default))
    except (TypeError, ValueError):
        return default


def _vision_prediction(slug: str, record: Dict[str, Any]) -> Dict[str, Any]:
    labels = {
        "chest-xray": "no_acute_finding",
        "pneumonia": "pneumonia_not_detected",
        "covid19": "covid19_not_detected",
        "lung-nodule": "low_nodule_risk",
        "tuberculosis": "tuberculosis_not_detected",
    }
    return {
        "label": labels.get(slug, "normal"),
        "confidence": _score(slug, record),
        "explanation": "deterministic mock image classification",
    }


def _nlp_prediction(slug: str, record: Dict[str, Any]) -> Dict[str, Any]:
    text = str(record.get("text", record.get("message", ""))).lower()
    positive_terms = ("good", "great", "excellent", "useful", "bueno", "excelente", "positivo")
    negative_terms = ("bad", "poor", "terrible", "malo", "negativo", "problema")
    if any(term in text for term in positive_terms):
        label = "positive"
    elif any(term in text for term in negative_terms):
        label = "negative"
    else:
        label = "neutral"
    return {
        "label": label,
        "confidence": _score(slug, record),
        "explanation": "deterministic mock text classification",
    }


def _health_prediction(slug: str, record: Dict[str, Any]) -> Dict[str, Any]:
    weight = _numeric(record, "weight_kg", 70.0)
    height = max(_numeric(record, "height_m", 1.75), 0.5)
    age = _numeric(record, "age", 40.0)
    bmi = round(weight / (height * height), 2)
    outputs = {
        "bmi": {"value": bmi, "unit": "kg/m2", "category": "normal" if bmi < 25 else "elevated"},
        "body-fat": {"value": round(1.2 * bmi + 0.23 * age - 16.2, 2), "unit": "percent"},
        "bmr": {"value": round(10 * weight + 625 * height - 5 * age + 5, 2), "unit": "kcal/day"},
        "ideal-weight": {"value": round(22 * height * height, 2), "unit": "kg"},
        "health-risk": {"value": "low" if bmi < 25 else "moderate", "score": min(round(bmi / 40, 3), 1.0)},
    }
    return {
        "label": slug,
        "confidence": _score(slug, record),
        "output": outputs.get(slug, outputs["health-risk"]),
    }


def _predict(model: Dict[str, str], record: Dict[str, Any]) -> Dict[str, Any]:
    group = model["group"]
    slug = model["slug"]
    if group == "vision":
        result = _vision_prediction(slug, record)
    elif group == "nlp":
        result = _nlp_prediction(slug, record)
    else:
        result = _health_prediction(slug, record)
    return {"input": record, "result": result}


def _register_mock_endpoint(model: Dict[str, str]) -> None:
    async def endpoint(request: Request) -> Dict[str, Any]:
        try:
            payload = await request.json()
        except Exception:
            payload = {}

        records = _records_from_payload(payload)
        return {
            "model": model["slug"],
            "serverMode": "combined",
            "predictions": [_predict(model, record) for record in records],
        }

    route_name = f"combined_{model['slug'].replace('-', '_')}"
    endpoint.__name__ = route_name
    app.add_api_route(model["endpoint"], endpoint, methods=["POST"], name=route_name)


def _active_mock_models() -> Iterable[Dict[str, str]]:
    return MOCK_MODELS[:_mock_http_count()]


for _model in _active_mock_models():
    _register_mock_endpoint(_model)


@app.get("/combined-models")
def combined_models() -> Dict[str, Any]:
    return {
        "mode": "combined",
        "useCaseServerDir": _use_case_server_dir(),
        "mockHttp": [
            {"slug": model["slug"], "endpoint": model["endpoint"], "group": model["group"]}
            for model in _active_mock_models()
        ],
    }
