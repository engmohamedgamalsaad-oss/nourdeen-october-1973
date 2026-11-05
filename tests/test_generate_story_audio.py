from __future__ import annotations

import sys
import tempfile
import types
import unittest
from pathlib import Path

# The generator only needs edge_tts at synthesis time; these safety tests never synthesize.
sys.modules.setdefault("edge_tts", types.SimpleNamespace(Communicate=None))
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
import generate_story_audio as audio


class AudioGenerationSafetyTests(unittest.TestCase):
    def test_arabic_generation_requires_explicit_fish_authorization(self):
        with self.assertRaisesRegex(RuntimeError, "--allow-fish"):
            audio.require_fish_authorization(("ar",), dry_run=False, allow_fish=False)

    def test_dry_run_never_requires_fish_authorization(self):
        audio.require_fish_authorization(("ar",), dry_run=True, allow_fish=False)

    def test_non_arabic_generation_does_not_require_fish_authorization(self):
        audio.require_fish_authorization(("en", "fr"), dry_run=False, allow_fish=False)

    def test_explicit_fish_authorization_allows_arabic_execution(self):
        audio.require_fish_authorization(("ar",), dry_run=False, allow_fish=True)

    def test_orphaned_mp3_files_are_reported_but_never_deleted(self):
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory)
            current = output / "000.mp3"
            stale = output / "old-clip.mp3"
            current.write_bytes(b"current")
            stale.write_bytes(b"stale")
            orphaned = audio.report_orphaned_audio_files(output, {"000.mp3"})
            self.assertEqual(orphaned, ["old-clip.mp3"])
            self.assertTrue(stale.is_file(), "stale audio must be preserved for manual review")
            self.assertTrue(current.is_file())


    def test_manual_workflow_requires_consent_and_never_pushes_to_main(self):
        workflow = (ROOT / ".github" / "workflows" / "story-audio.yml").read_text(encoding="utf-8")
        self.assertIn("confirm_fish_audio_request", workflow)
        self.assertIn("python scripts/generate_story_audio.py --allow-fish", workflow)
        self.assertIn("gh pr create", workflow)
        self.assertNotIn("git push origin HEAD:main", workflow)
        self.assertIn("pull-requests: write", workflow)


if __name__ == "__main__":
    unittest.main()
