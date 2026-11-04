import asyncio
import json
import sys
import tempfile
import types
import unittest
from unittest.mock import AsyncMock, patch
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
sys.modules.setdefault("edge_tts", types.ModuleType("edge_tts"))
import generate_story_audio as generator


class GenerationConfirmationTests(unittest.TestCase):
    def test_real_generation_requires_explicit_confirmation(self):
        with patch.object(sys, "argv", ["generate_story_audio.py"]):
            with patch.object(generator, "generate_story", new=AsyncMock()) as run:
                result = asyncio.run(generator.main())
        self.assertEqual(result, 2)
        run.assert_not_awaited()

    def test_dry_run_does_not_require_generation_confirmation(self):
        with patch.object(
            sys, "argv",
            ["generate_story_audio.py", "--dry-run", "--languages", "ar", "en"],
        ):
            with patch.object(
                generator, "generate_story", new=AsyncMock(return_value=True)
            ) as run:
                result = asyncio.run(generator.main())
        self.assertEqual(result, 0)
        run.assert_awaited_once()
        args = run.await_args
        self.assertTrue(args.kwargs["dry_run"])
        self.assertEqual(args.kwargs["languages"], ("ar", "en"))

    def test_dry_run_writes_no_files_and_calls_no_tts_provider(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            story_path = root / "stories" / "science" / "001" / "story.json"
            story_path.parent.mkdir(parents=True)
            package = {
                "format": "KHALEDOON_STORY",
                "section": "science",
                "slug": "test-story",
                "i18n": {
                    language: {
                        "blocks": [{"speaker": "narrator", "text": "نص تجريبي"}]
                    }
                    for language in generator.LANGUAGES
                },
            }
            story_path.write_text(json.dumps(package, ensure_ascii=False), encoding="utf-8")
            (story_path.parent / "data.json").write_text(
                json.dumps({"published": True}), encoding="utf-8"
            )
            audio_dir = root / "assets" / "audio" / "science" / "test-story"
            with patch.object(generator, "ROOT", root):
                with patch.object(generator, "synthesize", new=AsyncMock()) as edge_tts:
                    with patch.object(generator, "synthesize_fish_audio", new=AsyncMock()) as fish_tts:
                        result = asyncio.run(
                            generator.generate_story(
                                story_path, dry_run=True, languages=("ar", "en")
                            )
                        )
            self.assertTrue(result)
            self.assertFalse(audio_dir.exists())
            edge_tts.assert_not_awaited()
            fish_tts.assert_not_awaited()

    def test_confirmed_generation_passes_selected_story_and_languages(self):
        with patch.object(
            sys, "argv",
            [
                "generate_story_audio.py",
                "--story", "stories/science/001/story.json",
                "--languages", "ar", "fr",
                "--confirm-generation",
            ],
        ):
            with patch.object(
                generator, "generate_story", new=AsyncMock(return_value=True)
            ) as run:
                result = asyncio.run(generator.main())
        self.assertEqual(result, 0)
        run.assert_awaited_once()
        args = run.await_args
        self.assertEqual(args.args[0], ROOT / "stories/science/001/story.json")
        self.assertFalse(args.kwargs["dry_run"])
        self.assertEqual(args.kwargs["languages"], ("ar", "fr"))


if __name__ == "__main__":
    unittest.main()
