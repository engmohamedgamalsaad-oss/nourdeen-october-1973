"""Unified OmniVoice audio engine for Khaledoon.

Karma and the narrator are independent voice providers behind one queue worker.
"""
from .client import WorkerClient, WorkerHTTPError
from .config import KARMA_SETTINGS, MODEL_ID, NARRATOR_SETTINGS
from .providers import KarmaProvider, NarratorProvider, ProviderError, ProviderRegistry
from .worker import process_job, run_worker

__all__ = [
    "KARMA_SETTINGS",
    "MODEL_ID",
    "NARRATOR_SETTINGS",
    "KarmaProvider",
    "NarratorProvider",
    "ProviderError",
    "ProviderRegistry",
    "WorkerClient",
    "WorkerHTTPError",
    "process_job",
    "run_worker",
]
