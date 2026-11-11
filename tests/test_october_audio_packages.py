from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

from scripts import build_october_audio_packages as builder


class OctoberAudioPackageBuilderTests(unittest.TestCase):
    def test_builder_creates_five_language_readiness_package_without_tts(self):
        with tempfile.TemporaryDirectory() as temp:
            story_dir = Path(temp) / "001"
            story_dir.mkdir()
            (story_dir / "index.html").write_text(
                '<h1 data-i18n="title">عنوان</h1><p data-i18n="body">نص الحكاية</p>',
                encoding="utf-8",
            )
            ui = {
                lang: {"title": f"Title {lang}", "body": f"Body {lang}"}
                for lang in builder.LANGS
            }
            ui["ar"] = {"title": "عنوان الحكاية", "body": "نص الحكاية"}
            package, readiness, report = builder.build_story(story_dir, ui, {}, {})
            self.assertEqual(package["format"], "KHALEDOON_STORY")
            self.assertEqual(set(package["i18n"]), set(builder.LANGS))
            self.assertEqual(len(package["i18n"]["ar"]["blocks"]), 2)
            self.assertTrue(readiness["ready"])
            self.assertEqual(report["blocks"], 2)
            self.assertTrue(all(block["speaker"] == "narrator" for block in package["i18n"]["ar"]["blocks"]))

    def test_missing_translation_blocks_audio_readiness(self):
        with tempfile.TemporaryDirectory() as temp:
            story_dir = Path(temp) / "002"
            story_dir.mkdir()
            (story_dir / "index.html").write_text(
                '<h1 data-i18n="title">عنوان</h1><p data-i18n="body">نص الحكاية</p>',
                encoding="utf-8",
            )
            ui = {lang: {"title": f"Title {lang}", "body": f"Body {lang}"} for lang in builder.LANGS}
            ui["fr"].pop("body")
            package, readiness, report = builder.build_story(story_dir, ui, {}, {})
            self.assertFalse(readiness["ready"])
            self.assertEqual(report["languages"]["fr"]["missing"][0]["index"], 1)
            self.assertEqual(len(package["i18n"]["fr"]["blocks"]), 2)


if __name__ == "__main__":
    unittest.main()
