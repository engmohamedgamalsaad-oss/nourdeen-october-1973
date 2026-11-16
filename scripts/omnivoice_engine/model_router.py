"""Lazy single-model router for the existing and multilingual OmniVoice checkpoints.

Only one checkpoint is kept in memory at a time to avoid holding both large
models in Colab GPU memory. Arabic/English continue using the proven VoiceTut
checkpoint; French/Italian/German use the official k2-fsa multilingual model.
"""
from __future__ import annotations

import gc
from typing import Callable, Any

from .config import MODEL_ID, MULTILINGUAL_LANGUAGES, MULTILINGUAL_MODEL_ID


class LanguageModelRouter:
    def __init__(self, loader: Callable[[str], Any], default_model_id: str = MODEL_ID,
                 multilingual_model_id: str = MULTILINGUAL_MODEL_ID):
        self.loader = loader
        self.default_model_id = default_model_id
        self.multilingual_model_id = multilingual_model_id
        self._loaded_id = None
        self._loaded_model = None

    def model_id_for(self, language: str) -> str:
        if language in ("ar", "en"):
            return self.default_model_id
        if language in MULTILINGUAL_LANGUAGES:
            return self.multilingual_model_id
        raise ValueError(f"Unsupported audio language: {language!r}")

    def for_language(self, language: str):
        model_id = self.model_id_for(language)
        if model_id != self._loaded_id:
            self._loaded_model = None
            self._loaded_id = None
            gc.collect()
            try:
                import torch
                if torch.cuda.is_available():
                    torch.cuda.empty_cache()
            except Exception:
                pass
            self._loaded_model = self.loader(model_id)
            self._loaded_id = model_id
            print("Loaded audio model:", model_id)
        return self._loaded_model
