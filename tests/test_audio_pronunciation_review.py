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

    def test_transcript_comparison_supports_all_five_project_languages(self) -> None:
        samples = {
            "ar": ("مَجْدِي يَعْقُوب", ["مجدي", "يعقوب"]),
            "en": ("heart surgery", ["heart", "surgery"]),
            "fr": ("chirurgie cardiaque", ["chirurgie", "cardiaque"]),
            "it": ("chirurgia cardiaca", ["chirurgia", "cardiaca"]),
            "de": ("Herzchirurgie", ["Herzchirurgie"]),
        }
        for language, (expected, recognized) in samples.items():
            with self.subTest(language=language):
                result = reviewer.compare_transcript(
                    expected,
                    [
                        {
                            "word": word,
                            "start": index * 0.4,
                            "end": index * 0.4 + 0.3,
                            "probability": 0.98,
                        }
                        for index, word in enumerate(recognized)
                    ],
                    language,
                    language,
                    0.99,
                )
                self.assertEqual(result["match_ratio"], 1.0)
                self.assertEqual(result["status"], "likely_match")
                self.assertTrue(result["needs_human_review"])

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

    def test_selected_block_review_ignores_unselected_manifest_clips(self) -> None:
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
                "i18n": {"ar": {"blocks": [
                    {"speaker": "narrator", "text": "First block."},
                    {"speaker": "karma", "text": "Second block."},
                ]}},
            })
            segments = []
            for index, filename, text in (
                (0, "000.mp3", "First block."),
                (1, "001.mp3", "Second block."),
            ):
                payload = f"audio-{index}".encode()
                (audio_dir / filename).write_bytes(payload)
                segments.append({
                    "block_index": index,
                    "chunk_index": 0,
                    "speaker": "narrator" if index == 0 else "karma",
                    "src": filename,
                    "text": text,
                    "audio_sha256": hashlib.sha256(payload).hexdigest(),
                })
            self.write_json(audio_dir / "manifest.json", {
                "story": "sample", "section": "science", "language": "ar",
                "segments": segments,
            })
            fake = FakeModel([
                {"word": "Second", "start": 0.1, "end": 0.3, "probability": 0.98},
                {"word": "block.", "start": 0.4, "end": 0.7, "probability": 0.98},
            ])
            with patch.object(reviewer, "ROOT", root):
                report = reviewer.review_story_audio(
                    story_path, "ar", root / "assets" / "audio", fake,
                    block_indexes=(1,),
                )
            self.assertEqual(fake.calls, 1)
            self.assertEqual(report["selected_blocks"], [1])
            self.assertEqual(report["missing_blocks"], [])
            self.assertEqual(len(report["reports"]), 1)
            self.assertEqual(report["reports"][0]["block_index"], 1)

    def test_unapproved_pronunciation_override_is_not_used_as_expected_audio_text(self) -> None:
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
                "i18n": {"ar": {"blocks": [{"speaker": "narrator", "text": "Visible story text."}]}},
            })
            self.write_json(story_dir / "audio-pronunciation.json", {
                "story": "sample",
                "language": "ar",
                "approved_audio_only_rewrites": [],
                "blocks": {"0": "Unapproved audio rewrite."},
            })
            audio_bytes = b"audio"
            (audio_dir / "000.mp3").write_bytes(audio_bytes)
            self.write_json(audio_dir / "manifest.json", {
                "story": "sample", "section": "science", "language": "ar",
                "segments": [{"block_index": 0, "chunk_index": 0, "speaker": "narrator", "src": "000.mp3",
                              "audio_sha256": hashlib.sha256(audio_bytes).hexdigest()}],
            })
            fake = FakeModel([{"word": "Visible", "start": 0.1, "end": 0.3, "probability": 0.98},
                              {"word": "story", "start": 0.4, "end": 0.6, "probability": 0.98},
                              {"word": "text.", "start": 0.7, "end": 0.9, "probability": 0.98}])
            with patch.object(reviewer, "ROOT", root):
                report = reviewer.review_story_audio(story_path, "ar", root / "assets" / "audio", fake)
            self.assertEqual(report["reports"][0]["expected_text"], "Visible story text.")

    def test_stale_manifest_text_is_blocked_before_asr(self) -> None:
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
                "i18n": {"en": {"blocks": [{"speaker": "narrator", "text": "Current story text."}]}},
            })
            audio_bytes = b"audio"
            (audio_dir / "000.mp3").write_bytes(audio_bytes)
            self.write_json(audio_dir / "manifest.json", {
                "story": "sample", "section": "science", "language": "en",
                "segments": [{"block_index": 0, "chunk_index": 0, "speaker": "narrator",
                              "src": "000.mp3", "text": "Stale manifest text.",
                              "audio_sha256": hashlib.sha256(audio_bytes).hexdigest()}],
            })
            fake = FakeModel([])
            with patch.object(reviewer, "ROOT", root):
                report = reviewer.review_story_audio(story_path, "en", root / "assets" / "audio", fake)
            self.assertEqual(fake.calls, 0)
            self.assertEqual(report["reports"][0]["status"], "manifest_text_mismatch")

    def test_skips_transcription_when_manifest_audio_hash_is_missing(self) -> None:
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
            (audio_dir / "000.mp3").write_bytes(b"audio-without-manifest-hash")
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
                }],
            })
            fake = FakeModel([])
            with patch.object(reviewer, "ROOT", root):
                report = reviewer.review_story_audio(
                    story_path, "en", root / "assets" / "audio", fake
                )
            self.assertEqual(fake.calls, 0)
            self.assertEqual(report["reports"][0]["status"], "audio_hash_missing")
            self.assertTrue(report["reports"][0]["needs_human_review"])

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
                    "audio_sha256": "0" * 64,
                }],
            })
            fake = FakeModel([])
            with patch.object(reviewer, "ROOT", root):
                report = reviewer.review_story_audio(
                    story_path, "en", root / "assets" / "audio", fake
                )
            self.assertEqual(fake.calls, 0)
            self.assertEqual(report["reports"][0]["status"], "audio_hash_mismatch")


    def test_october_audio_package_uses_the_shared_read_only_asr_review(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            story_dir = root / "rebuild" / "october-audio-packages" / "001"
            audio_dir = root / "assets" / "audio" / "october" / "sample" / "ar"
            audio_dir.mkdir(parents=True)
            story_path = story_dir / "story.json"
            self.write_json(story_path, {
                "format": "KHALEDOON_STORY",
                "section": "october",
                "slug": "sample",
                "i18n": {"ar": {"blocks": [
                    {"speaker": "narrator", "text": "رجال البحر."}
                ]}},
            })
            audio_bytes = b"october-audio"
            (audio_dir / "000.mp3").write_bytes(audio_bytes)
            self.write_json(audio_dir / "manifest.json", {
                "story": "sample", "section": "october", "language": "ar",
                "segments": [{
                    "block_index": 0, "chunk_index": 0, "speaker": "narrator",
                    "src": "000.mp3", "text": "رجال البحر.",
                    "audio_sha256": hashlib.sha256(audio_bytes).hexdigest(),
                }],
            })
            fake = FakeModel([
                {"word": "رجال", "start": 0.1, "end": 0.3, "probability": 0.98},
                {"word": "البحر.", "start": 0.4, "end": 0.7, "probability": 0.98},
            ])
            with patch.object(reviewer, "ROOT", root):
                report = reviewer.review_story_audio(
                    story_path, "ar", root / "assets" / "audio", fake
                )
            self.assertEqual(fake.calls, 1)
            self.assertEqual(report["section"], "october")
            self.assertEqual(report["summary"]["likely_match"], 1)
            self.assertEqual(report["tts_requests"], 0)


if __name__ == "__main__":
    unittest.main()
