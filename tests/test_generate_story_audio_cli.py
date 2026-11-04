import asyncio
import sys
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
