"""Voice settings for the unified OmniVoice engine.

Each speaker is an independent provider with its own reference voice and
settings. Changing one never changes the other. A settings change must be
recorded as a new ``version`` rather than overwriting a successful one.
"""
from __future__ import annotations

from dataclasses import dataclass

SAMPLE_RATE = 24000
MODEL_ID = "masterofaudio2077/voicetut-egyptian-tashkeel"

# Queue language code -> OmniVoice language code.
LANGUAGE_CODES = {"ar": "arz", "en": "en"}


@dataclass(frozen=True)
class VoiceSettings:
    num_step: int
    guidance_scale: float
    speed: float
    version: str


# Karma: exactly the generation call used in Khaledoon_Karma_Listen_Test_Explained.ipynb.
KARMA_SETTINGS = VoiceSettings(num_step=36, guidance_scale=3.0, speed=0.90, version="karma-approved-0.90-2026-11-11")

# Narrator: values recorded in docs/KHALEDOON_CONTROL_TOWER.md (10-11-2026).
NARRATOR_SETTINGS = VoiceSettings(num_step=48, guidance_scale=3.0, speed=1.05, version="narrator-control-tower-2026-11-10")

# The Karma reference transcript is locked: one wrong character ruins the clone.
KARMA_REF_TEXT_SHA256 = "50cce1612e8f55127d729c355b964e9d5335b21382572da3d96245ca37013346"
