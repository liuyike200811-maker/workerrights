import json
from pathlib import Path
from typing import Any

from backend.config import ROOT_DIR

KNOWLEDGE_DIR = ROOT_DIR / "knowledge"


def _read_json(path: Path) -> Any:
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def load_legal_documents() -> list[dict]:
    documents: list[dict] = []
    for path in sorted((KNOWLEDGE_DIR / "national").glob("*.json")):
        documents.append(_read_json(path))
    for path in sorted((KNOWLEDGE_DIR / "henan").glob("*.json")):
        if path.name == "regions.json":
            continue
        payload = _read_json(path)
        if isinstance(payload.get("documents"), list):
            documents.extend(payload["documents"])
        else:
            documents.append(payload)
    return documents


def load_channels() -> list[dict]:
    path = KNOWLEDGE_DIR / "official_channels" / "channels.json"
    return _read_json(path).get("channels", [])


def load_form_schema() -> dict:
    path = KNOWLEDGE_DIR / "official_channels" / "root-wage-platform-form.json"
    return _read_json(path)


def load_regions() -> dict:
    return _read_json(KNOWLEDGE_DIR / "henan" / "regions.json")
