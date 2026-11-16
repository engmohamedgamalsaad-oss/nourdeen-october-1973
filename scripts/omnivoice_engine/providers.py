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


_NAME_KEYS = ("name", "speaker", "voice", "label", "title", "speaker_name")
_ID_KEYS = ("id", "speaker_id")
_AUDIO_KEYS = ("audio", "audio_path", "ref_audio", "path", "file", "filename", "audio_file", "wav")
_TEXT_KEYS = ("ref_text", "text", "transcript", "transcription", "prompt_text", "reference_text")


def load_library_reference(refs_dir: str, name: str, alt_names=(), speaker_id=None):
    """Resolve a named built-in VoiceTut speaker from its published flat JSON index."""
    index_path = os.path.join(refs_dir, "references.json")
    if not os.path.isfile(index_path):
        raise ProviderError(f"references.json not found in {refs_dir!r}")
    with open(index_path, encoding="utf-8") as handle:
        data = json.load(handle)
    items = data if isinstance(data, list) else list(data.values()) if isinstance(data, dict) else []

    wanted_names = {
        str(value).strip().lower()
        for value in (name, *alt_names)
        if value and (speaker_id is None or str(value).strip().lower() != str(speaker_id).strip().lower())
    }
    found = next(
        (
            item for item in items
            if isinstance(item, dict)
            and any(
                str(item.get(key, "")).strip().lower() in wanted_names
                for key in _NAME_KEYS
                if item.get(key) is not None
            )
        ),
        None,
    )

    # The human-readable speaker name is authoritative. Use the ID only as a
    # fallback, and reject a name/ID pair that points to different speakers.
    if found is None and speaker_id:
        wanted_id = str(speaker_id).strip().lower()
        found = next(
            (
                item for item in items
                if isinstance(item, dict)
                and any(
                    str(item.get(key, "")).strip().lower() == wanted_id
                    for key in _ID_KEYS
                    if item.get(key) is not None
                )
            ),
            None,
        )
    if found is None:
        available = [
            str(item.get("speaker_name") or item.get("name") or item.get("speaker_id") or "")
            for item in items if isinstance(item, dict)
        ]
        raise ProviderError(f"VoiceTut library voice {name!r} not found. Available: {available}")

    if speaker_id:
        actual_id = next((str(found[key]).strip() for key in _ID_KEYS if found.get(key)), None)
        if actual_id and actual_id.lower() != str(speaker_id).strip().lower():
            raise ProviderError(
                f"VoiceTut name/ID mismatch for {name!r}: expected {speaker_id!r}, found {actual_id!r}."
            )

    audio = next(
        (found[key] for key in _AUDIO_KEYS if isinstance(found.get(key), str) and found[key].strip()),
        None,
    )
    text = next(
        (found[key] for key in _TEXT_KEYS if isinstance(found.get(key), str) and found[key].strip()),
        None,
    )
    if not audio or not text:
        raise ProviderError(
            f"VoiceTut library voice {name!r} is missing audio_path or reference_text; "
            f"record keys: {sorted(found)}"
        )

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
