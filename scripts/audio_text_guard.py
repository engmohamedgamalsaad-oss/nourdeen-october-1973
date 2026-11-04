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


def canonicalize_approved_number_rewrites(
    value: str, rewrites: dict[str, Any] | None
) -> list[str]:
    """Replace only exact, explicitly whitelisted spoken-number phrases with digits."""
    tokens = word_tokens(value)
    if rewrites is None:
        rewrites = {}
    if not isinstance(rewrites, dict):
        raise ValueError("Approved number rewrites must be an object.")

    for number, phrase in rewrites.items():
        if not isinstance(number, str) or not re.fullmatch(r"[0-9]+", number):
            raise ValueError(f"Invalid approved numeric value: {number!r}")
        if not isinstance(phrase, str) or not phrase.strip():
            raise ValueError(f"Approved number phrase for {number} must be non-empty text.")
        phrase_tokens = word_tokens(phrase)
        if not phrase_tokens or any(token.isdigit() for token in phrase_tokens):
            raise ValueError(f"Approved number phrase for {number} must contain spoken words only.")

        positions = [
            index for index in range(len(tokens) - len(phrase_tokens) + 1)
            if tokens[index:index + len(phrase_tokens)] == phrase_tokens
        ]
        if len(positions) != 1:
            raise ValueError(
                f"Approved number phrase for {number} must occur exactly once; "
                f"found {len(positions)} occurrences."
            )
        index = positions[0]
        tokens = tokens[:index] + [number] + tokens[index + len(phrase_tokens):]

    return tokens


def validate_pronunciation_blocks(
    blocks: list[Any],
    pronunciation_blocks: dict[str, Any],
    approved_number_rewrites: dict[str, Any] | None = None,
) -> None:
    """Reject word changes except exact, block-specific, approved number wording."""
    if not isinstance(blocks, list):
        raise ValueError("Story blocks must be a list.")
    if not isinstance(pronunciation_blocks, dict):
        raise ValueError("Arabic pronunciation blocks must be an object.")
    if approved_number_rewrites is None:
        approved_number_rewrites = {}
    if not isinstance(approved_number_rewrites, dict):
        raise ValueError("Approved number rewrites must be an object.")

    for key in approved_number_rewrites:
        if not isinstance(key, str) or not key.isdigit():
            raise ValueError(f"Invalid approved number rewrite block index: {key!r}")
        if key not in pronunciation_blocks:
            raise ValueError(
                f"Approved number rewrite block {key} has no pronunciation override."
            )

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
        rewrites = approved_number_rewrites.get(key, {})
        canonical_submitted = canonicalize_approved_number_rewrites(submitted, rewrites)
        if word_tokens(visible) != canonical_submitted:
            raise ValueError(
                "Safety stop before TTS: audio-pronunciation text changes word identity, "
                f"numbers, or word order in block {index}. Only diacritics, whitespace, "
                "punctuation, and exact block-specific approved number phrases may differ."
            )
