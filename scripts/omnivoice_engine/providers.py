"""Per-speaker voice providers.

Karma and the narrator are separate providers: each owns its reference audio,
reference text and generation settings. The OmniVoice model object is shared
(passed in), the voices are not.
"""
from __future__ import annotations

import hashlib
import json
import os
from typing import Callable, Dict

from .audio import as_numpy_audio, convert_reference
from .config import (
    KARMA_REF_TEXT_SHA256,
    KARMA_SETTINGS,
    MULTILINGUAL_KARMA_SETTINGS,
    MULTILINGUAL_LANGUAGES,
    MULTILINGUAL_NARRATOR_SETTINGS,
    LANGUAGE_CODES,
    NARRATOR_SETTINGS,
    VoiceSettings,
)


class ProviderError(RuntimeError):
    """A job cannot be served by the configured providers."""


class ReferenceVoiceProvider:
    speaker = ""

    def __init__(
        self,
        ref_audio_path: str,
        ref_text: str,
        settings: VoiceSettings,
        workdir: str = "/content",
        converter: Callable[[str, str], str] = convert_reference,
    ):
        ref_text = (ref_text or "").strip()
        if not ref_text:
            raise ProviderError(f"{self.speaker}: reference text is empty.")
        if not ref_audio_path or not os.path.isfile(ref_audio_path):
            raise ProviderError(f"{self.speaker}: reference audio not found: {ref_audio_path!r}")
        self.ref_text = ref_text
        self.settings = settings
        self.ref_wav = converter(ref_audio_path, os.path.join(workdir, f"{self.speaker}_ref_24k.wav"))

    def generate(self, model, text: str, language: str):
        """Return (audio, sample_rate) for ``text`` spoken in this provider's voice."""
        code = LANGUAGE_CODES.get(language)
        if code is None:
            raise ProviderError(f"Language {language!r} is not supported by the engine.")
        text = (text or "").strip()
        if not text:
            raise ProviderError("Queue job has empty speech text.")
        settings = self.settings
        if language in MULTILINGUAL_LANGUAGES:
            settings = MULTILINGUAL_KARMA_SETTINGS if self.speaker == "karma" else MULTILINGUAL_NARRATOR_SETTINGS
        generated = model.generate(
            text=text,
            language=code,
            ref_audio=self.ref_wav,
            ref_text=self.ref_text,
            num_step=settings.num_step,
            guidance_scale=settings.guidance_scale,
            speed=settings.speed,
        )[0]
        return as_numpy_audio(generated)


class KarmaProvider(ReferenceVoiceProvider):
    speaker = "karma"

    def __init__(self, ref_audio_path, ref_text, settings=KARMA_SETTINGS, **kwargs):
        digest = hashlib.sha256((ref_text or "").strip().encode("utf-8")).hexdigest()
        if digest != KARMA_REF_TEXT_SHA256:
            raise ProviderError("Karma reference text differs from the locked original text.")
        super().__init__(ref_audio_path, ref_text, settings, **kwargs)


_NAME_KEYS = ("name", "id", "speaker", "voice", "label", "title", "speaker_id", "speaker_name")
_AUDIO_KEYS = ("audio", "audio_path", "ref_audio", "path", "file", "filename", "audio_file", "wav")
_TEXT_KEYS = ("ref_text", "text", "transcript", "transcription", "prompt_text", "reference_text")


def _walk_dicts(node, parent_key=None):
    """Yield nested dictionaries together with the key used by their parent."""
    if isinstance(node, dict):
        yield node, parent_key
        for key, value in node.items():
            if isinstance(value, (dict, list)):
                yield from _walk_dicts(value, str(key))
    elif isinstance(node, list):
        for value in node:
            if isinstance(value, (dict, list)):
                yield from _walk_dicts(value, parent_key)


def _flatten_fields(node):
    """Return scalar (key, value) pairs from a nested metadata record."""
    fields = []
    if isinstance(node, dict):
        for key, value in node.items():
            if isinstance(value, (dict, list)):
                fields.extend(_flatten_fields(value))
            elif isinstance(value, (str, int, float)):
                fields.append((str(key), str(value)))
    elif isinstance(node, list):
        for value in node:
            fields.extend(_flatten_fields(value))
    return fields


def load_library_reference(refs_dir: str, name: str, alt_names=(), speaker_id=None):
    """Find a built-in VoiceTut voice in references.json, including nested schemas."""
    index_path = os.path.join(refs_dir, "references.json")
    if not os.path.isfile(index_path):
        raise ProviderError(f"references.json not found in {refs_dir!r}")
    with open(index_path, encoding="utf-8") as handle:
        data = json.load(handle)

    wanted = {str(n).strip().lower() for n in (name, *alt_names, speaker_id) if n}
    name_keys = {key.lower() for key in _NAME_KEYS}
    audio_keys = {key.lower() for key in _AUDIO_KEYS}
    text_keys = {key.lower() for key in _TEXT_KEYS}

    matches = []
    for record, parent_key in _walk_dicts(data):
        fields = _flatten_fields(record)
        identity = (parent_key or "").strip().lower() in wanted
        identity = identity or any(
            key.lower() in name_keys and value.strip().lower() in wanted
            for key, value in fields
        )
        if not identity:
            continue
        audio = next((value for key, value in fields if key.lower() in audio_keys and value.strip()), None)
        text = next((value for key, value in fields if key.lower() in text_keys and value.strip()), None)
        if audio and text:
            matches.append((len(fields), audio, text))

    if not matches:
        top_keys = sorted(data.keys()) if isinstance(data, dict) else []
        sample_keys = [sorted(item.keys()) for item, _ in list(_walk_dicts(data))[:5]]
        raise ProviderError(
            f"VoiceTut voice {name!r} / {speaker_id!r} not resolved in references.json. "
            f"Top-level keys: {top_keys}; sample record keys: {sample_keys}"
        )

    _, audio, text = min(matches, key=lambda item: item[0])
    candidates = [
        audio,
        os.path.join(refs_dir, audio),
        os.path.join(os.path.dirname(refs_dir), audio),
        os.path.join(refs_dir, os.path.basename(audio)),
    ]
    path = next((candidate for candidate in candidates if os.path.isfile(candidate)), None)
    if path is None:
        raise ProviderError(f"VoiceTut voice {name!r}: audio file {audio!r} not found under {refs_dir!r}")
    return path, text


class NarratorProvider(ReferenceVoiceProvider):
    speaker = "narrator"

    def __init__(self, ref_audio_path, ref_text, settings=NARRATOR_SETTINGS, **kwargs):
        super().__init__(ref_audio_path, ref_text, settings, **kwargs)

    @classmethod
    def from_library(cls, refs_dir, name="karim", speaker_id="spk_04_male", **kwargs):
        """Narrator = library voice Karim (spk_04_male, reference_speakers/karim.wav); no Drive or secret."""
        path, text = load_library_reference(refs_dir, name, (speaker_id,), speaker_id=speaker_id)
        return cls(path, text, **kwargs)


class ProviderRegistry:
    def __init__(self, providers: Dict[str, ReferenceVoiceProvider] | None = None):
        self._providers = dict(providers or {})

    def register(self, provider: ReferenceVoiceProvider) -> None:
        self._providers[provider.speaker] = provider

    def get(self, speaker: str) -> ReferenceVoiceProvider:
        provider = self._providers.get(speaker)
        if provider is None:
            raise ProviderError(f"No voice provider is configured for speaker {speaker!r}.")
        return provider
