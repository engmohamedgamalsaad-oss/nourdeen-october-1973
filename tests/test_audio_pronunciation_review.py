from __future__ import annotations

import hashlib
import json
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

from scripts import review_audio_pronunciation as reviewer


class FakeModel:
    def __init__(self, words, language="ar", probability=0.98):
        self.words = words
        self.language = language
        self.probability = probability
        self.calls = 0

    def transcribe(self, path, **kwargs):
        self.calls += 1
        segment = SimpleNamespace(
            text=" ".join(word["word"] for word in self.words),
            words=[
                SimpleNamespace(**word)
                for word in self.words
            ],
        )
        info = SimpleNamespace(language=self.language, language_probability=self.probability)
        return iter([segment]), info


class AudioPronunciationReviewTests(unittest.TestCase):
    def write_json(self, path: Path, value: dict) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(value, ensure_ascii=False), encoding="utf-8")

    def test_arabic_normalization_ignores_diacritics_and_alef_variants(self) -> None:
        result = reviewer.compare_transcript(
            "مَجْدِي يَعْقُوب",
            [
                {"word": "مجدي", "start": 0.1, "end": 0.4, "probability": 0.95},
                {"word": "يعقوب", "start": 0.5, "end": 0.9, "probability": 0.94},
            ],
            "ar",
            "ar",
            0.99,
        )
        self.assertEqual(result["match_ratio"], 1.0)
        self.assertEqual(result["status"], "likely_match")
        self.assertTrue(result["needs_human_review"])

    def test_detects_replacement_and_preserves_word_timestamp(self) -> None:
        result = reviewer.compare_transcript(
            "the heart helps people",
            [
                {"word": "the", "start": 0.1, "end": 0.2, "probability": 0.99},
                {"word": "hard", "start": 0.3, "end": 0.6, "probability": 0.4},
                {"word": "helps", "start": 0.7, "end": 0.9, "probability": 0.95},
                {"word": "people", "start": 1.0, "end": 1.3, "probability": 0.96},
            ],
            "en",
            "en",
            0.99,
        )
        self.assertEqual(result["status"], "review_required")
        self.assertTrue(result["mismatches"])
        self.assertEqual(result["low_confidence_words"][0]["word"], "hard")

    def test_uncertain_language_detection_requires_review_even_when_words_match(self) -> None:
        result = reviewer.compare_transcript(
            "bonjour",
            [{"word": "bonjour", "start": 0.1, "end": 0.6, "probability": 0.99}],
            "fr",
            "fr",
            0.42,
        )
        self.assertEqual(result["match_ratio"], 1.0)
        self.assertTrue(result["language_detection_uncertain"])
        self.assertEqual(result["status"], "review_required")

    def test_review_uses_real_file_hash_and_returns_human_review_result(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            story_dir = root / "stories" / "science" / "001"
            audio_dir = root / "assets" / "audio" / "science" / "sample" / "ar"
            audio_dir.mkdir(parents=True)
            story_path = story_dir / "story.json"
            self.write_json(story_path, {
                "format": "KHALEDOON_STORY",
                "section": "science",
                "slug": "sample",
                "i18n": {
                    "ar": {"blocks": [{"speaker": "narrator", "text": "الجملة الأولى."}]}
                },
            })
            audio_path = audio_dir / "000.mp3"
            audio_path.write_bytes(b"audio-bytes")
            digest = hashlib.sha256(audio_path.read_bytes()).hexdigest()
            self.write_json(audio_dir / "manifest.json", {
                "story": "sample",
                "section": "science",
                "language": "ar",
                "segments": [{
                    "block_index": 0,
                    "chunk_index": 0,
                    "speaker": "narrator",
                    "src": "000.mp3",
                    "text": "الجملة الأولى.",
                    "audio_sha256": digest,
                }],
            })
            fake = FakeModel([
                {"word": "الجملة", "start": 0.0, "end": 0.4, "probability": 0.95},
                {"word": "الأولى.", "start": 0.5, "end": 0.9, "probability": 0.95},
            ])
            with patch.object(reviewer, "ROOT", root):
                report = reviewer.review_story_audio(
                    story_path, "ar", root / "assets" / "audio", fake
                )
            self.assertEqual(fake.calls, 1)
            self.assertEqual(report["summary"]["likely_match"], 1)
            self.assertTrue(report["summary"]["human_review_required"])
            self.assertEqual(audio_path.read_bytes(), b"audio-bytes")

    def test_skips_transcription_when_audio_hash_changed(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            story_dir = root / "stories" / "science" / "001"
            audio_dir = root / "assets" / "audio" / "science" / "sample" / "en"
            audio_dir.mkdir(parents=True)
            story_path = story_dir / "story.json"
            self.write_json(story_path, {
                "format": "KHALEDOON_STORY",
                "section": "science",
                "slug": "sample",
                "i18n": {"en": {"blocks": [{"speaker": "narrator", "text": "Hello."}]}},
            })
            (audio_dir / "000.mp3").write_bytes(b"changed")
            self.write_json(audio_dir / "manifest.json", {
                "story": "sample",
                "section": "science",
                "language": "en",
                "segments": [{
                    "block_index": 0,
                    "chunk_index": 0,
                    "speaker": "narrator",
                    "src": "000.mp3",
                    "text": "Hello.",
                    "audio_sha256": "wrong-hash",
                }],
            })
            fake = FakeModel([])
            with patch.object(reviewer, "ROOT", root):
                report = reviewer.review_story_audio(
                    story_path, "en", root / "assets" / "audio", fake
                )
            self.assertEqual(fake.calls, 0)
            self.assertEqual(report["reports"][0]["status"], "audio_hash_mismatch")


if __name__ == "__main__":
    unittest.main()
