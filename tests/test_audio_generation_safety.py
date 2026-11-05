from __future__ import annotations

import asyncio
import hashlib
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import AsyncMock, patch

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
            "approved_audio_only_rewrites": ["0"],
            "blocks": {"0": "Narrator pronunciation."},
        })
        return story_dir / "story.json"

    def test_dry_run_does_not_call_tts_or_create_staging_files(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            story = self.make_story(root)
            staging = root / ".audio-staging"
            fish = AsyncMock()
            edge = AsyncMock()
            with patch.object(audio, "ROOT", root), patch.object(audio, "STAGING_ROOT", staging), \
                 patch.object(audio, "synthesize_fish_audio", fish), patch.object(audio, "synthesize", edge):
                result = asyncio.run(audio.generate_story(story, dry_run=True))
            self.assertTrue(result)
            fish.assert_not_awaited()
            edge.assert_not_awaited()
            self.assertFalse(staging.exists())

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

    def test_unapproved_arabic_rewrite_is_ignored(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            story = self.make_story(root)
            self.write_json(story.parent / "audio-pronunciation.json", {
                "story": "sample-story", "language": "ar",
                "approved_audio_only_rewrites": ["1"],
                "blocks": {"0": "Unapproved.", "1": "Approved."},
            })
            with patch.object(audio, "ROOT", root):
                plan = audio.inspect_generation_plan(
                    story, root / ".audio-staging", languages=("ar",)
                )
            self.assertEqual(plan["languages"]["ar"]["segments_to_generate"], 2)

    def test_non_arabic_plan_does_not_depend_on_arabic_pronunciation_file(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            story = self.make_story(root)
            (story.parent / "audio-pronunciation.json").write_text("{broken", encoding="utf-8")
            with patch.object(audio, "ROOT", root):
                plan = audio.inspect_generation_plan(
                    story, root / ".audio-staging", languages=("en",)
                )
                self.assertEqual(set(plan["languages"]), {"en"})
                with self.assertRaises(ValueError):
                    audio.inspect_generation_plan(
                        story, root / ".audio-staging", languages=("ar",)
                    )

    def test_language_scoped_plan_does_not_expand_to_other_languages(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            story = self.make_story(root)
            with patch.object(audio, "ROOT", root):
                plan = audio.inspect_generation_plan(
                    story, root / ".audio-staging", languages=("ar",)
                )
            self.assertEqual(set(plan["languages"]), {"ar"})
            self.assertEqual(plan["fish_segments_to_generate"], 2)

    def test_rejects_unsupported_language_selection(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            story = self.make_story(root)
            with patch.object(audio, "ROOT", root):
                with self.assertRaises(ValueError):
                    audio.inspect_generation_plan(
                        story, root / ".audio-staging", languages=("xx",)
                    )

    def test_forced_block_plans_only_the_selected_clip(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            story = self.make_story(root)
            staging = root / ".audio-staging"
            lang_dir = staging / "science" / "sample-story" / "ar"
            lang_dir.mkdir(parents=True)
            segments = []
            for index, speaker, text in (
                (0, "narrator", "Narrator pronunciation."),
                (1, "karma", "Karma ar."),
            ):
                voice, rate, pitch = audio.VOICE_SETTINGS["ar"][speaker]
                selected_voice = (
                    audio.FISH_AUDIO_NARRATOR_VOICE_ID if speaker == "narrator"
                    else audio.FISH_AUDIO_KARMA_VOICE_ID
                )
                filename = f"{index:03d}.mp3"
                (lang_dir / filename).write_bytes(b"x" * 600)
                segments.append({
                    "block_index": index,
                    "chunk_index": 0,
                    "voice": selected_voice,
                    "hash": audio.text_hash(text, selected_voice, rate, pitch, "ar"),
                    "src": filename,
                })
            self.write_json(lang_dir / "manifest.json", {
                "story": "sample-story",
                "section": "science",
                "language": "ar",
                "segments": segments,
            })
            with patch.object(audio, "ROOT", root):
                plan = audio.inspect_generation_plan(
                    story, staging, languages=("ar",), force_blocks=(1,)
                )
            self.assertEqual(plan["segments_to_generate"], 1)
            self.assertEqual(plan["fish_segments_to_generate"], 1)

    def test_seeds_published_baseline_into_staging_without_mutating_source(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            story = self.make_story(root)
            published = root / "assets" / "audio" / "science" / "sample-story" / "ar"
            published.mkdir(parents=True)
            segments = []
            for index, speaker, text in (
                (0, "narrator", "Narrator pronunciation."),
                (1, "karma", "Karma ar."),
            ):
                voice, rate, pitch = audio.VOICE_SETTINGS["ar"][speaker]
                selected_voice = (
                    audio.FISH_AUDIO_NARRATOR_VOICE_ID if speaker == "narrator"
                    else audio.FISH_AUDIO_KARMA_VOICE_ID
                )
                filename = f"{index:03d}.mp3"
                payload = (f"audio-{index}").encode()
                (published / filename).write_bytes(payload)
                segments.append({
                    "block_index": index,
                    "chunk_index": 0,
                    "voice": selected_voice,
                    "hash": audio.text_hash(text, selected_voice, rate, pitch, "ar"),
                    "src": filename,
                    "audio_sha256": hashlib.sha256(payload).hexdigest(),
                })
            self.write_json(published / "manifest.json", {
                "story": "sample-story",
                "section": "science",
                "language": "ar",
                "segments": segments,
            })
            staging = root / ".audio-staging"
            with patch.object(audio, "ROOT", root):
                audio.seed_staging_from_published(story, ("ar",), staging)
                plan = audio.inspect_generation_plan(
                    story, staging, languages=("ar",), force_blocks=(1,)
                )
            self.assertEqual(plan["segments_to_generate"], 1)
            self.assertTrue((staging / "science" / "sample-story" / "ar" / "000.mp3").is_file())
            self.assertEqual((published / "000.mp3").read_bytes(), b"audio-0")
            self.assertEqual((published / "001.mp3").read_bytes(), b"audio-1")

    def test_arabic_single_block_regeneration_stops_before_fish_without_approval(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            story = self.make_story(root)
            published = root / "assets" / "audio" / "science" / "sample-story" / "ar"
            published.mkdir(parents=True)
            segments = []
            for index, speaker, text in (
                (0, "narrator", "Narrator pronunciation."),
                (1, "karma", "Karma ar."),
            ):
                voice, rate, pitch = audio.VOICE_SETTINGS["ar"][speaker]
                selected_voice = (
                    audio.FISH_AUDIO_NARRATOR_VOICE_ID if speaker == "narrator"
                    else audio.FISH_AUDIO_KARMA_VOICE_ID
                )
                filename = f"{index:03d}.mp3"
                (published / filename).write_bytes(b"p" * 600)
                segments.append({
                    "block_index": index,
                    "chunk_index": 0,
                    "voice": selected_voice,
                    "hash": audio.text_hash(text, selected_voice, rate, pitch, "ar"),
                    "src": filename,
                })
            self.write_json(published / "manifest.json", {
                "story": "sample-story",
                "section": "science",
                "language": "ar",
                "segments": segments,
            })
            fish = AsyncMock()
            edge = AsyncMock()
            staging = root / ".audio-staging"
            with patch.object(audio, "ROOT", root), patch.object(audio, "STAGING_ROOT", staging), \
                 patch.object(audio, "synthesize_fish_audio", fish), patch.object(audio, "synthesize", edge):
                with self.assertRaises(RuntimeError):
                    asyncio.run(audio.generate_story(
                        story, dry_run=False, allow_fish_audio=False,
                        languages=("ar",), force_blocks=(1,)
                    ))
            fish.assert_not_awaited()
            edge.assert_not_awaited()
            self.assertTrue((staging / "science" / "sample-story" / "ar" / "000.mp3").is_file())
            self.assertEqual((published / "000.mp3").read_bytes(), b"p" * 600)

    def test_single_block_seed_refuses_missing_published_baseline(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            story = self.make_story(root)
            with patch.object(audio, "ROOT", root):
                with self.assertRaises(RuntimeError):
                    audio.seed_staging_from_published(
                        story, ("ar",), root / ".audio-staging"
                    )

    def test_rejects_forced_block_not_present_in_selected_language(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            story = self.make_story(root)
            with patch.object(audio, "ROOT", root):
                with self.assertRaises(ValueError):
                    audio.inspect_generation_plan(
                        story, root / ".audio-staging", languages=("ar",), force_blocks=(99,)
                    )

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
                self.write_json(lang_dir / "manifest.json", {"story": "sample-story", "section": "science", "language": language, "segments": segments})
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
