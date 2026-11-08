from __future__ import annotations

import asyncio
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import AsyncMock, patch

from scripts import generate_story_audio as audio


class OctoberAudioPackageTests(unittest.TestCase):
    def write_json(self, path: Path, value: dict) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(value, ensure_ascii=False), encoding="utf-8")

    def make_package(self, root: Path, story_id: str = "001", ready: bool = True, approved: bool = True) -> Path:
        directory = root / "stories" / "october" / story_id
        self.write_json(directory / "story.json", {
            "format": "KHALEDOON_STORY",
            "section": "october",
            "slug": story_id,
            "i18n": {
                lang: {"blocks": [
                    {"type": "heading", "speaker": "narrator", "text": f"Title {lang}"},
                    {"type": "paragraph", "speaker": "narrator", "text": f"Body {lang}"},
                ]}
                for lang in audio.LANGUAGES
            },
        })
        self.write_json(directory / "data.json", {"published": True, "audio_text_review_required": True})
        self.write_json(directory / "audio-readiness.json", {
            "format": audio.OCTOBER_READINESS_FORMAT,
            "story": story_id,
            "ready": ready,
        })
        if approved:
            review_segments = []
            for language in audio.AUDIO_PHASE_LANGUAGES:
                for index, text in enumerate((f"Title {language}", f"Body {language}")):
                    review_segments.append({
                        "lang": language, "block_index": index, "speaker": "narrator",
                        "source_text": text, "approved_audio_text": text, "decision": "approved_original",
                    })
            self.write_json(directory / "audio-pronunciation.json", {
                "format": "KHALEDOON_AUDIO_PRONUNCIATION_V1",
                "story": story_id, "section": "october",
                "review": {
                    "format": "KHALEDOON_AUDIO_TEXT_REVIEW_APPROVAL_V1",
                    "status": "approved_by_admin", "languages": list(audio.AUDIO_PHASE_LANGUAGES),
                    "total_segments": len(review_segments), "segments": review_segments,
                },
                "approved_audio_text_rewrites": {language: {} for language in audio.LANGUAGES},
                "blocks": {}, "approved_audio_only_rewrites": [],
            })
        return directory / "story.json"

    def test_ready_package_is_planned_for_current_audio_languages_without_writes(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            story = self.make_package(root)
            staging = root / ".audio-staging"
            with patch.object(audio, "ROOT", root):
                plan = audio.inspect_generation_plan(story, staging)
            self.assertEqual(set(plan["languages"]), set(audio.AUDIO_PHASE_LANGUAGES))
            self.assertEqual(plan["segments_to_generate"], 4)
            self.assertEqual(plan["fish_segments_to_generate"], 2)
            self.assertFalse(staging.exists())

    def test_not_ready_package_is_blocked(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            story = self.make_package(root, ready=False)
            with patch.object(audio, "ROOT", root):
                with self.assertRaises(audio.OctoberPackageNotReady):
                    audio.inspect_generation_plan(story, root / ".audio-staging")

    def test_missing_readiness_file_is_blocked(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            story = self.make_package(root)
            (story.parent / "audio-readiness.json").unlink()
            with patch.object(audio, "ROOT", root):
                with self.assertRaises(audio.OctoberPackageNotReady):
                    audio.inspect_generation_plan(story, root / ".audio-staging")

    def test_plan_all_reports_october_packages_and_blocked_ones(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            self.make_package(root, "001")
            self.make_package(root, "002", ready=False)
            staging = root / ".audio-staging"
            with patch.object(audio, "ROOT", root):
                report = audio.inspect_all_generation_plans(root, staging)
            self.assertEqual(report["october_audio_packages"], 2)
            self.assertEqual(report["october_audio_packages_blocked"], 2)
            self.assertEqual(report["stories_with_errors"], 0)
            self.assertEqual(report["tts_requests"], 0)
            self.assertEqual(report["segments_to_generate"], 0)
            self.assertFalse(staging.exists())

    def test_ready_source_without_human_approval_is_blocked_in_plan_all(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            self.make_package(root, approved=False)
            with patch.object(audio, "ROOT", root):
                report = audio.inspect_all_generation_plans(root, root / ".audio-staging")
            self.assertEqual(report["october_audio_packages"], 1)
            self.assertEqual(report["october_audio_packages_blocked"], 1)
            self.assertEqual(report["october_packages"][0]["path"], "stories/october/001/story.json")
            self.assertIn("select one October story explicitly", report["october_packages"][0]["blocked"])
            self.assertEqual(report["segments_to_generate"], 0)
            self.assertEqual(report["tts_requests"], 0)
            self.assertEqual(report["files_modified"], 0)
    def test_generation_uses_the_shared_human_approval_gate_before_any_tts(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            story = self.make_package(root, approved=False)
            staging = root / ".audio-staging"
            fish, edge = AsyncMock(), AsyncMock()
            with patch.object(audio, "ROOT", root), patch.object(audio, "STAGING_ROOT", staging), \
                 patch.object(audio, "synthesize_fish_audio", fish), patch.object(audio, "synthesize", edge):
                with self.assertRaisesRegex(ValueError, "admin-approved Arabic-English"):
                    asyncio.run(audio.generate_story(story, dry_run=False, allow_fish_audio=True))
            fish.assert_not_awaited()
            edge.assert_not_awaited()
            self.assertFalse(staging.exists())

    def test_dry_run_of_package_makes_no_requests_or_files(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            story = self.make_package(root)
            staging = root / ".audio-staging"
            fish, edge = AsyncMock(), AsyncMock()
            with patch.object(audio, "ROOT", root), patch.object(audio, "STAGING_ROOT", staging), \
                 patch.object(audio, "synthesize_fish_audio", fish), patch.object(audio, "synthesize", edge):
                self.assertTrue(asyncio.run(audio.generate_story(story, dry_run=True)))
            fish.assert_not_awaited()
            edge.assert_not_awaited()
            self.assertFalse(staging.exists())

    def test_published_october_html_remains_protected(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            page = root / "stories" / "october" / "001" / "index.html"
            page.parent.mkdir(parents=True)
            page.write_text("<html>published page</html>", encoding="utf-8")
            with patch.object(audio, "ROOT", root):
                with self.assertRaises(ValueError):
                    audio.locate_story(page)

    def test_october_uses_the_canonical_story_directory(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            story = self.make_package(root)
            with patch.object(audio, "ROOT", root):
                relative, section, is_package = audio.locate_story(story)
            self.assertEqual(section, "october")
            self.assertTrue(is_package)
            self.assertEqual(relative.parts[:2], ("stories", "october"))

    def test_committed_october_source_package_is_accepted_by_generator(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            generated_story = self.make_package(root)
            source_dir = root / "rebuild" / "october-audio-packages" / "001"
            source_dir.parent.mkdir(parents=True)
            generated_story.parent.rename(source_dir)
            story = source_dir / "story.json"
            with patch.object(audio, "ROOT", root):
                relative, section, is_package = audio.locate_story(story)
                audio.require_october_readiness(story, audio.read_json(story))
            self.assertEqual(section, "october")
            self.assertTrue(is_package)
            self.assertEqual(relative.parts[:3], ("rebuild", "october-audio-packages", "001"))


if __name__ == "__main__":
    unittest.main()
