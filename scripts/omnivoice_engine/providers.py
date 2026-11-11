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
        generated = model.generate(
            text=text,
            language=code,
            ref_audio=self.ref_wav,
            ref_text=self.ref_text,
            num_step=self.settings.num_step,
            guidance_scale=self.settings.guidance_scale,
            speed=self.settings.speed,
        )[0]
        return as_numpy_audio(generated)


class KarmaProvider(ReferenceVoiceProvider):
    speaker = "karma"

    def __init__(self, ref_audio_path, ref_text, settings=KARMA_SETTINGS, **kwargs):
        digest = hashlib.sha256((ref_text or "").strip().encode("utf-8")).hexdigest()
        if digest != KARMA_REF_TEXT_SHA256:
            raise ProviderError("Karma reference text differs from the locked original text.")
        super().__init__(ref_audio_path, ref_text, settings, **kwargs)


_NAME_KEYS = ("name", "id", "speaker", "voice", "label", "title")
_AUDIO_KEYS = ("audio", "audio_path", "ref_audio", "path", "file", "filename", "audio_file", "wav")
_TEXT_KEYS = ("ref_text", "text", "transcript", "transcription", "prompt_text")


def load_library_reference(refs_dir: str, name: str, alt_names=()):
    """Find a built-in library voice (e.g. 'kareem') in ``references.json``.

    ``refs_dir`` is the ``reference_speakers`` folder of the VoiceTut-TTS snapshot.
    Returns (audio_path, ref_text). Raises ProviderError listing what exists if the
    voice or its audio/text fields cannot be resolved.
    """
    index_path = os.path.join(refs_dir, "references.json")
    if not os.path.isfile(index_path):
        raise ProviderError(f"references.json not found in {refs_dir!r}")
    with open(index_path, encoding="utf-8") as handle:
        data = json.load(handle)
    items = data if isinstance(data, list) else list(data.values()) if isinstance(data, dict) else []
    wanted_all = [n.strip().lower() for n in (name, *alt_names) if n]

    def labels(item):
        return [str(item[k]).strip().lower() for k in _NAME_KEYS if isinstance(item, dict) and item.get(k)]

    found = next((i for i in items if isinstance(i, dict) and any(w in labels(i) for w in wanted_all)), None)
    if found is None and isinstance(data, dict) and isinstance(data.get(name), dict):
        found = data[name]
    if found is None:
        known = [labels(i)[:1] for i in items if isinstance(i, dict)]
        raise ProviderError(f"Library voice {name!r} not found. Available: {known}")
    audio = next((found[k] for k in _AUDIO_KEYS if isinstance(found.get(k), str) and found[k].strip()), None)
    text = next((found[k] for k in _TEXT_KEYS if isinstance(found.get(k), str) and found[k].strip()), None)
    if not text:
        raise ProviderError(f"Library voice {name!r} has no reference text field: {sorted(found)}")
    audio = audio or f"{wanted_all[-1]}.wav"
    candidates = [audio, os.path.join(refs_dir, audio), os.path.join(os.path.dirname(refs_dir), audio),
                  os.path.join(refs_dir, os.path.basename(audio))]
    path = next((c for c in candidates if os.path.isfile(c)), None)
    if path is None:
        raise ProviderError(f"Library voice {name!r}: audio file {audio!r} not found under {refs_dir!r}")
    return path, text


class NarratorProvider(ReferenceVoiceProvider):
    speaker = "narrator"

    def __init__(self, ref_audio_path, ref_text, settings=NARRATOR_SETTINGS, **kwargs):
        super().__init__(ref_audio_path, ref_text, settings, **kwargs)

    @classmethod
    def from_library(cls, refs_dir, name="karim", speaker_id="spk_04_male", **kwargs):
        """Narrator = library voice Karim (spk_04_male, reference_speakers/karim.wav); no Drive or secret."""
        path, text = load_library_reference(refs_dir, speaker_id, (name,))
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
