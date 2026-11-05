from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from scripts import generate_story_audio as audio


class AudioGenerationSafetyTests(unittest.TestCase):
    def write_json(self, path: Path, value: dict) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(value, ensure_ascii=False), encoding="utf-8")

    def make_story(self, root: Path, section: str = "science", story_id: str = "001") -> Path:
        story_dir = root / "stories" / section / story_id
        languages = {
            language: {
                "blocks": [
                    {"speaker": "narrator", "text": f"Narrator {language}."},
                    {"speaker": "karma", "text": f"Karma {language}."},
                ]
            }
            for language in audio.LANGUAGES
        }
        self.write_json(story_dir / "story.json", {
            "format": "KHALEDOON_STORY",
            "section": section,
            "slug": "sample-story",
            "i18n": languages,
        })
        self.write_json(story_dir / "data.json", {"published": True})
        self.write_json(story_dir / "audio-pronunciation.json", {
            "story": "sample-story",
            "language": "ar",
            "blocks": {"0": "Narrator pronunciation."},
        })
        return story_dir / "story.json"

    def test_pronunciation_file_does_not_skip_other_languages(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            story = self.make_story(root)
            staging = root / ".audio-staging"
            with patch.object(audio, "ROOT", root):
                plan = audio.inspect_generation_plan(story, staging)
            self.assertEqual(set(plan["languages"]), set(audio.LANGUAGES))
            self.assertEqual(plan["languages"]["ar"]["segments_to_generate"], 2)
            for language in ("en", "fr", "it", "de"):
                self.assertEqual(plan["languages"][language]["segments_to_generate"], 2)
            self.assertEqual(plan["fish_segments_to_generate"], 2)
            self.assertFalse(staging.exists())

    def test_all_story_plan_skips_october_and_never_writes(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            story = self.make_story(root)
            self.make_story(root, section="october", story_id="002")
            staging = root / ".audio-staging"
            with patch.object(audio, "ROOT", root):
                report = audio.inspect_all_generation_plans(root, staging)
            self.assertEqual(report["published_non_october_stories"], 1)
            self.assertEqual(report["october_stories_skipped"], 1)
            self.assertEqual(report["tts_requests"], 0)
            self.assertEqual(report["files_modified"], 0)
            self.assertEqual(report["fish_segments_to_generate"], 2)
            self.assertFalse(staging.exists())

    def test_existing_complete_staging_assets_are_not_planned_again(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            story = self.make_story(root)
            staging = root / ".audio-staging"
            for language in audio.LANGUAGES:
                lang_dir = staging / "science" / "sample-story" / language
                lang_dir.mkdir(parents=True)
                segments = []
                for index, speaker in enumerate(("narrator", "karma")):
                    text = f"{speaker.title()} {'Arabic' if language == 'ar' else language}."
                    if language == "ar" and index == 0:
                        text = "Narrator pronunciation."
                    voice, rate, pitch = audio.VOICE_SETTINGS[language][speaker]
                    selected_voice = (
                        audio.FISH_AUDIO_NARRATOR_VOICE_ID if index == 0
                        else audio.FISH_AUDIO_KARMA_VOICE_ID
                    ) if language == "ar" else voice
                    filename = f"{index:03d}.mp3"
                    (lang_dir / filename).write_bytes(b"x" * 600)
                    segments.append({
                        "block_index": index,
                        "chunk_index": 0,
                        "voice": selected_voice,
                        "hash": audio.text_hash(text, selected_voice, rate, pitch, language),
                        "src": filename,
                    })
                self.write_json(lang_dir / "manifest.json", {"segments": segments})
            with patch.object(audio, "ROOT", root):
                plan = audio.inspect_generation_plan(story, staging)
            self.assertEqual(plan["segments_to_generate"], 0)
            self.assertEqual(plan["fish_segments_to_generate"], 0)

    def test_plan_reports_errors_without_touching_published_audio_tree(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            story = self.make_story(root)
            published = root / "assets" / "audio"
            published.mkdir(parents=True)
            sentinel = published / "keep.mp3"
            sentinel.write_bytes(b"published")
            before = sentinel.read_bytes()
            staging = root / ".audio-staging"
            with patch.object(audio, "ROOT", root):
                plan = audio.inspect_generation_plan(story, staging)
            self.assertGreater(plan["segments_to_generate"], 0)
            self.assertEqual(sentinel.read_bytes(), before)
            self.assertFalse(staging.exists())


if __name__ == "__main__":
    unittest.main()
