"""Per-speaker voice providers.

Karma and the narrator are separate providers: each owns its reference audio,
reference text and generation settings. The OmniVoice model object is shared
(passed in), the voices are not.
"""
from __future__ import annotations

import hashlib
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


class NarratorProvider(ReferenceVoiceProvider):
    speaker = "narrator"

    def __init__(self, ref_audio_path, ref_text, settings=NARRATOR_SETTINGS, **kwargs):
        super().__init__(ref_audio_path, ref_text, settings, **kwargs)


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
