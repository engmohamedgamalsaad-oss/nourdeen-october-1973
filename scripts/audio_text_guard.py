"""Fail-closed validation for audio-only pronunciation text."""
from __future__ import annotations

import re
import unicodedata
from typing import Any

WORD_RE = re.compile(r"[^\\W_]+", re.UNICODE)


def word_tokens(value: str) -> list[str]:
    """Compare word identity/order while ignoring diacritics and punctuation only."""
    normalized = unicodedata.normalize("NFKC", value).casefold()
    normalized = "".join(
        char for char in normalized
        if char == "\\u0640" or unicodedata.category(char) != "Mn"
    ).replace("\\u0640", "")
    return WORD_RE.findall(normalized)


def validate_pronunciation_blocks(
    blocks: list[Any], pronunciation_blocks: dict[str, Any]
) -> None:
    """Reject any audio-only rewrite that changes words, numbers, or their order."""
    if not isinstance(pronunciation_blocks, dict):
        raise ValueError("Arabic pronunciation blocks must be an object.")

    for key, candidate in pronunciation_blocks.items():
        if not isinstance(key, str) or not key.isdigit():
            raise ValueError(f"Invalid pronunciation block index: {key!r}")
        index = int(key)
        if index >= len(blocks):
            raise ValueError(f"Pronunciation block index {index} is outside story.json.")
        block = blocks[index]
        if not isinstance(block, dict) or block.get("speaker") not in ("karma", "narrator"):
            raise ValueError(f"Pronunciation override {index} does not target a speakable block.")
        if not isinstance(candidate, str) or not candidate.strip():
            raise ValueError(f"Pronunciation override {index} must be non-empty text.")

        visible = re.sub(r"\\s+", " ", str(block.get("text") or "")).strip()
        submitted = re.sub(r"\\s+", " ", candidate).strip()
        if word_tokens(visible) != word_tokens(submitted):
            raise ValueError(
                "Safety stop before TTS: audio-pronunciation text changes word identity, "
                f"numbers, or word order in block {index}. Only diacritics, whitespace, "
                "and punctuation may differ."
            )
