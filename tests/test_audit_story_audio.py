from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path

from scripts.audit_story_audio import LANGUAGES, audit


class AudioInventoryTests(unittest.TestCase):
    def write_json(self, path: Path, value: dict) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(value, ensure_ascii=False), encoding="utf-8")

    def make_story(self, root: Path, section: str, story_id: str, slug: str, published: bool = True) -> Path:
        story_dir = root / "stories" / section / story_id
        self.write_json(story_dir / "data.json", {"published": published})
        package = {
            "format": "KHALEDOON_STORY",
            "section": section,
            "slug": slug,
            "i18n": {
                language: {
                    "blocks": [
                        {"speaker": "narrator", "text": f"Text {language}"},
                        {"speaker": "karma", "text": f"Reply {language}"},
                        {"speaker": "narrator", "text": ""},
                    ]
                }
                for language in LANGUAGES
            },
        }
        self.write_json(story_dir / "story.json", package)
        return story_dir

    def test_skips_october_and_unpublished_stories(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            self.make_story(root, "october", "001", "october-story")
            self.make_story(root, "science", "002", "draft-story", published=False)
            report = audit(root)
            self.assertEqual(report["published_non_october_stories"], 0)
            self.assertEqual(report["october_stories_skipped"], 1)
            self.assertEqual(report["tts_requests"], 0)
            self.assertEqual(report["files_modified"], 0)

    def test_reports_missing_manifests_for_every_language_without_writing(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            self.make_story(root, "science", "001", "sample")
            before = sorted(str(path.relative_to(root)) for path in root.rglob("*") if path.is_file())
            report = audit(root)
            after = sorted(str(path.relative_to(root)) for path in root.rglob("*") if path.is_file())
            story = report["stories"][0]
            self.assertEqual(story["status"], "incomplete")
            self.assertEqual(set(story["languages"]), set(LANGUAGES))
            for language in LANGUAGES:
                self.assertFalse(story["languages"][language]["manifest"])
                self.assertEqual(story["languages"][language]["missing_blocks"], [0, 1])
            self.assertEqual(before, after)
            self.assertEqual(report["tts_requests"], 0)
            self.assertEqual(report["files_modified"], 0)

    def test_detects_missing_audio_and_extra_mp3_without_deleting_either(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            self.make_story(root, "science", "001", "sample")
            audio_dir = root / "assets" / "audio" / "science" / "sample" / "ar"
            audio_dir.mkdir(parents=True)
            (audio_dir / "000.mp3").write_bytes(b"audio")
            (audio_dir / "old.mp3").write_bytes(b"old")
            self.write_json(audio_dir / "manifest.json", {
                "story": "sample",
                "section": "science",
                "language": "ar",
                "segments": [
                    {"block_index": 0, "src": "000.mp3"},
                    {"block_index": 1, "src": "001.mp3"},
                ],
            })
            report = audit(root)
            arabic = report["stories"][0]["languages"]["ar"]
            self.assertEqual(arabic["missing_files"], ["001.mp3"])
            self.assertEqual(arabic["extra_mp3_files"], ["old.mp3"])
            self.assertTrue((audio_dir / "old.mp3").is_file())

    def test_rejects_path_traversal_and_duplicate_block_entries(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            self.make_story(root, "science", "001", "sample")
            audio_dir = root / "assets" / "audio" / "science" / "sample" / "ar"
            audio_dir.mkdir(parents=True)
            (audio_dir / "000.mp3").write_bytes(b"audio")
            self.write_json(audio_dir / "manifest.json", {
                "story": "sample",
                "section": "science",
                "language": "ar",
                "segments": [
                    {"block_index": 0, "src": "000.mp3"},
                    {"block_index": 0, "src": "../outside.mp3"},
                ],
            })
            arabic = audit(root)["stories"][0]["languages"]["ar"]
            self.assertEqual(arabic["duplicate_blocks"], [0])
            self.assertTrue(any("invalid src" in error for error in arabic["manifest_errors"]))


if __name__ == "__main__":
    unittest.main()
