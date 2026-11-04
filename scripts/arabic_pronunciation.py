#!/usr/bin/env python3
"""Shared, conservative Arabic audio-text pronunciation dictionary.

The dictionary may add Arabic vocalization only. It must never replace, insert,
delete, or reorder lexical characters. It is applied to audio text only.
"""
from __future__ import annotations

import json
import re
import unicodedata
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_DICTIONARY = ROOT / "audio" / "pronunciation" / "ar-EG.json"
ARABIC_MARKS = re.compile(r"[\u064B-\u0652\u0670\u0640]")
TOKEN_RE = re.compile(r"[\u0621-\u064A\u066E-\u06D3\u06FA-\u06FC\u064B-\u0652\u0670]+")


class PronunciationDictionaryError(ValueError):
    pass


def lexical_form(value: str) -> str:
    """Normalize vocalization only; retain every Arabic letter distinction."""
    return ARABIC_MARKS.sub("", unicodedata.normalize("NFC", value))


def _tokens(value: str) -> list[str]:
    return [lexical_form(match.group(0)) for match in TOKEN_RE.finditer(value)]


def validate_dictionary(data: dict[str, Any]) -> dict[str, Any]:
    if not isinstance(data, dict) or data.get("schema_version") != 1:
        raise PronunciationDictionaryError("Arabic pronunciation dictionary schema_version must be 1.")
    entries = data.get("entries")
    if not isinstance(entries, list):
        raise PronunciationDictionaryError("Arabic pronunciation dictionary entries must be a list.")
    seen: set[str] = set()
    for index, entry in enumerate(entries):
        if not isinstance(entry, dict):
            raise PronunciationDictionaryError(f"Entry #{index} must be an object.")
        entry_id = entry.get("id")
        match = entry.get("match")
        spoken = entry.get("spoken")
        if not isinstance(entry_id, str) or not entry_id.strip() or entry_id in seen:
            raise PronunciationDictionaryError(f"Entry #{index} has a missing or duplicate id.")
        seen.add(entry_id)
        if not isinstance(match, str) or not match.strip() or not isinstance(spoken, str) or not spoken.strip():
            raise PronunciationDictionaryError(f"Entry {entry_id!r} requires non-empty match and spoken strings.")
        if lexical_form(match) != lexical_form(spoken):
            raise PronunciationDictionaryError(
                f"Entry {entry_id!r} changes lexical letters; only vocalization is allowed."
            )
        if len(_tokens(match)) == 1 and not (entry.get("before") or entry.get("after")):
            raise PronunciationDictionaryError(
                f"Single-word entry {entry_id!r} requires before/after context to prevent homograph errors."
            )
        for context_key in ("before", "after"):
            context = entry.get(context_key)
            if context is not None and not isinstance(context, str):
                raise PronunciationDictionaryError(f"Entry {entry_id!r} {context_key} must be text.")
    return data


def load_dictionary(path: Path = DEFAULT_DICTIONARY) -> dict[str, Any]:
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, UnicodeError, json.JSONDecodeError) as exc:
        raise PronunciationDictionaryError(f"Cannot read pronunciation dictionary: {exc}") from exc
    return validate_dictionary(data)


def apply_dictionary(text: str, dictionary: dict[str, Any]) -> tuple[str, list[str]]:
    """Apply longest exact phrase matches; preserve punctuation and lexical identity."""
    if not isinstance(text, str) or not text.strip():
        raise PronunciationDictionaryError("Audio text must be a non-empty string.")
    validated = validate_dictionary(dictionary)
    entries = validated["entries"]
    spans = list(TOKEN_RE.finditer(text))
    if not spans:
        return text, []

    replacements: list[tuple[int, int, str, str]] = []
    used: list[str] = []
    cursor = 0
    ordered = sorted(entries, key=lambda item: len(_tokens(item["match"])), reverse=True)

    while cursor < len(spans):
        chosen = None
        for entry in ordered:
            match_tokens = _tokens(entry["match"])
            end_index = cursor + len(match_tokens)
            if not match_tokens or end_index > len(spans):
                continue
            actual = [lexical_form(spans[i].group(0)) for i in range(cursor, end_index)]
            if actual != match_tokens:
                continue
            # Never consume punctuation or arbitrary text between phrase tokens.
            if any(text[spans[i].end():spans[i + 1].start()].strip() for i in range(cursor, end_index - 1)):
                continue
            before = entry.get("before")
            after = entry.get("after")
            if before and (cursor == 0 or lexical_form(spans[cursor - 1].group(0)) != lexical_form(before)):
                continue
            if after and (end_index >= len(spans) or lexical_form(spans[end_index].group(0)) != lexical_form(after)):
                continue
            spoken_tokens = _tokens(entry["spoken"])
            if len(spoken_tokens) != len(match_tokens):
                raise PronunciationDictionaryError(f"Entry {entry['id']!r} changes token count.")
            chosen = (entry, end_index)
            break
        if chosen is None:
            cursor += 1
            continue
        entry, end_index = chosen
        replacements.append((
            spans[cursor].start(),
            spans[end_index - 1].end(),
            entry["spoken"],
            entry["id"],
        ))
        used.append(entry["id"])
        cursor = end_index

    result = text
    for start, end, spoken, _entry_id in reversed(replacements):
        result = result[:start] + spoken + result[end:]

    if lexical_form(result) != lexical_form(text):
        raise PronunciationDictionaryError("Dictionary application changed lexical text.")
    return result, used


def prepare_audio_text(
    text: str,
    story_override: str | None = None,
    dictionary: dict[str, Any] | None = None,
) -> tuple[str, list[str]]:
    """Apply story override first, then shared dictionary, audio-only."""
    candidate = story_override if isinstance(story_override, str) else text
    candidate = re.sub(r"\s+", " ", candidate).strip()
    if not candidate:
        raise PronunciationDictionaryError("Arabic audio pronunciation text must not be empty.")
    loaded = dictionary if dictionary is not None else load_dictionary()
    spoken, used = apply_dictionary(candidate, loaded)
    if lexical_form(spoken) != lexical_form(candidate):
        raise PronunciationDictionaryError("Prepared audio text differs lexically from its source.")
    return spoken, used
