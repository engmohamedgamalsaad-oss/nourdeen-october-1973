#!/usr/bin/env python3
"""Conservative, audio-only Arabic pronunciation dictionary.

This module is deliberately independent of audio generation, providers, story
files, manifests, and MP3 files. It only returns prepared text to its caller.
"""
from __future__ import annotations

import argparse
import json
import re
import sys
import unicodedata
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_DICTIONARY = ROOT / "audio" / "pronunciation" / "ar-EG.json"
ARABIC_MARKS = re.compile(r"[\u064B-\u065F\u0670\u0640]")
TOKEN_RE = re.compile(
    r"[\u0621-\u064A\u066E-\u06D3\u06FA-\u06FC"
    r"\u064B-\u065F\u0670]+"
)


class PronunciationDictionaryError(ValueError):
    """Raised when dictionary data or a requested transformation is unsafe."""


def lexical_form(value: str) -> str:
    """Remove Arabic vocalization marks only; preserve all letters and order."""
    return ARABIC_MARKS.sub("", unicodedata.normalize("NFC", value))


def _tokens(value: str) -> list[str]:
    return [lexical_form(match.group(0)) for match in TOKEN_RE.finditer(value)]


def validate_dictionary(data: dict[str, Any]) -> dict[str, Any]:
    if not isinstance(data, dict) or data.get("schema_version") != 1:
        raise PronunciationDictionaryError("schema_version must be 1.")
    entries = data.get("entries")
    if not isinstance(entries, list):
        raise PronunciationDictionaryError("entries must be a list.")

    seen_ids: set[str] = set()
    for index, entry in enumerate(entries):
        if not isinstance(entry, dict):
            raise PronunciationDictionaryError(f"Entry #{index} must be an object.")
        entry_id = entry.get("id")
        match = entry.get("match")
        spoken = entry.get("spoken")
        if not isinstance(entry_id, str) or not entry_id.strip() or entry_id in seen_ids:
            raise PronunciationDictionaryError(f"Entry #{index} has a missing or duplicate id.")
        seen_ids.add(entry_id)
        if not isinstance(match, str) or not match.strip():
            raise PronunciationDictionaryError(f"Entry {entry_id!r} has no match text.")
        if not isinstance(spoken, str) or not spoken.strip():
            raise PronunciationDictionaryError(f"Entry {entry_id!r} has no spoken text.")

        match_tokens = _tokens(match)
        spoken_tokens = _tokens(spoken)
        if not match_tokens or match_tokens != spoken_tokens:
            raise PronunciationDictionaryError(
                f"Entry {entry_id!r} changes lexical letters, token boundaries, or token order."
            )
        if len(match_tokens) == 1 and not (entry.get("before") or entry.get("after")):
            raise PronunciationDictionaryError(
                f"Single-word entry {entry_id!r} requires context."
            )
        for context_key in ("before", "after"):
            context = entry.get(context_key)
            if context is not None:
                if not isinstance(context, str) or len(_tokens(context)) != 1:
                    raise PronunciationDictionaryError(
                        f"Entry {entry_id!r} {context_key} must be exactly one word."
                    )
    return data


def load_dictionary(path: Path = DEFAULT_DICTIONARY) -> dict[str, Any]:
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, UnicodeError, json.JSONDecodeError) as exc:
        raise PronunciationDictionaryError(f"Cannot read pronunciation dictionary: {exc}") from exc
    return validate_dictionary(data)


def apply_dictionary(
    text: str, dictionary: dict[str, Any]
) -> tuple[str, list[str]]:
    """Apply exact phrase matches while preserving separators and punctuation."""
    if not isinstance(text, str) or not text.strip():
        raise PronunciationDictionaryError("Audio text must be a non-empty string.")
    entries = validate_dictionary(dictionary)["entries"]
    spans = list(TOKEN_RE.finditer(text))
    replacements: list[tuple[int, int, str]] = []
    used: list[str] = []
    cursor = 0
    ordered = sorted(entries, key=lambda item: len(_tokens(item["match"])), reverse=True)

    while cursor < len(spans):
        selected = None
        for entry in ordered:
            wanted = _tokens(entry["match"])
            end_index = cursor + len(wanted)
            if not wanted or end_index > len(spans):
                continue
            actual = [lexical_form(spans[i].group(0)) for i in range(cursor, end_index)]
            if actual != wanted:
                continue
            # Phrase tokens must be separated only by whitespace, never punctuation.
            if any(
                text[spans[i].end():spans[i + 1].start()].strip()
                for i in range(cursor, end_index - 1)
            ):
                continue
            before = entry.get("before")
            after = entry.get("after")
            if before:
                if cursor == 0:
                    continue
                gap = text[spans[cursor - 1].end():spans[cursor].start()]
                if gap.strip() or lexical_form(spans[cursor - 1].group(0)) != lexical_form(before):
                    continue
            if after:
                if end_index >= len(spans):
                    continue
                gap = text[spans[end_index - 1].end():spans[end_index].start()]
                if gap.strip() or lexical_form(spans[end_index].group(0)) != lexical_form(after):
                    continue
            spoken_tokens = [match.group(0) for match in TOKEN_RE.finditer(entry["spoken"])]
            selected = (entry, end_index, spoken_tokens)
            break

        if selected is None:
            cursor += 1
            continue

        entry, end_index, spoken_tokens = selected
        for token_span, spoken_token in zip(spans[cursor:end_index], spoken_tokens):
            replacements.append((token_span.start(), token_span.end(), spoken_token))
        used.append(entry["id"])
        cursor = end_index

    result = text
    for start, end, spoken_token in reversed(replacements):
        result = result[:start] + spoken_token + result[end:]

    if lexical_form(result) != lexical_form(text):
        raise PronunciationDictionaryError("Dictionary application changed lexical text.")
    return result, used


def prepare_audio_text(
    text: str,
    story_override: str | None = None,
    dictionary: dict[str, Any] | None = None,
) -> tuple[str, list[str]]:
    """Prepare text for a caller's audio path; never writes or generates anything."""
    candidate = story_override if story_override is not None else text
    if not isinstance(candidate, str) or not candidate.strip():
        raise PronunciationDictionaryError("Audio pronunciation text must not be empty.")
    loaded = dictionary if dictionary is not None else load_dictionary()
    return apply_dictionary(candidate, loaded)


def main(argv: list[str] | None = None) -> int:
    """Print a review-only candidate; never edits files or starts audio generation."""
    parser = argparse.ArgumentParser(
        description="Prepare an Arabic audio-text candidate for human review (no TTS)."
    )
    source_group = parser.add_mutually_exclusive_group()
    source_group.add_argument("--text", help="Arabic text to prepare.")
    source_group.add_argument("--input-file", type=Path, help="UTF-8 text file to read.")
    args = parser.parse_args(argv)

    try:
        if args.input_file is not None:
            source_text = args.input_file.read_text(encoding="utf-8")
        elif args.text is not None:
            source_text = args.text
        else:
            source_text = sys.stdin.read()
        candidate, applied_entries = prepare_audio_text(source_text)
    except (OSError, UnicodeError, PronunciationDictionaryError) as exc:
        parser.error(str(exc))

    json.dump(
        {
            "source_text": source_text,
            "candidate_audio_text": candidate,
            "applied_entries": applied_entries,
            "review_status": "REQUIRES_HUMAN_APPROVAL",
            "audio_generation_performed": False,
            "files_written": False,
        },
        sys.stdout,
        ensure_ascii=False,
        indent=2,
    )
    sys.stdout.write("\\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
