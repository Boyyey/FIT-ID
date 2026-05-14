"""Map stored posture slugs to shopper-friendly copy (UI + API)."""

from __future__ import annotations


def posture_human_label(slug: str | None) -> str | None:
    if not slug:
        return None
    key = str(slug).strip().lower().replace(" ", "_").replace("-", "_")
    return _LABELS.get(key, _fallback_label(key))


def _fallback_label(key: str) -> str:
    return key.replace("_", " ").title()


# Short UI labels only (2–4 words). Long coaching copy belongs in help docs, not profile cards.
_LABELS: dict[str, str] = {
    "neutral": "Normal posture",
    "normal": "Normal posture",
    "upright": "Upright stance",
    "forward_head": "Slight forward head",
    "forward head": "Slight forward head",
    "rounded": "Rounded shoulders",
    "slouch": "Slouching posture",
    "slouching": "Slouching posture",
    "slouched": "Slouching posture",
    "arched": "Arched lower back",
    "swayback": "Arched lower back",
}
