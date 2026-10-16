"""Crop disease guide — curated reference content for every disease the
model recognises. One JSON file feeds the API, the app and the website."""
import json
from functools import lru_cache
from pathlib import Path

GUIDE_PATH = Path(__file__).resolve().parent.parent / "data" / "disease_guide.json"


@lru_cache(maxsize=1)
def load_guide() -> list[dict]:
    with open(GUIDE_PATH, encoding="utf-8") as f:
        return json.load(f)


@lru_cache(maxsize=1)
def _by_class() -> dict[str, dict]:
    return {e["class_name"]: e for e in load_guide()}


@lru_cache(maxsize=1)
def _by_slug() -> dict[str, dict]:
    return {e["slug"]: e for e in load_guide()}


def guide_for_class(class_name: str | None) -> dict | None:
    return _by_class().get(class_name or "")


def guide_for_slug(slug: str) -> dict | None:
    return _by_slug().get(slug)


def guide_slug(class_name: str | None) -> str | None:
    entry = guide_for_class(class_name)
    return entry["slug"] if entry else None
