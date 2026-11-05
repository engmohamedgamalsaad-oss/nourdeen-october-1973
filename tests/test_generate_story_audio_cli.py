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
    def test_arabic_generation_requires_separate_fish_confirmation(self):
        with patch.object(
            sys, "argv",
            ["generate_story_audio.py", "--languages", "ar", "--confirm-generation"],
        ):
            with patch.object(generator, "generate_story", new=AsyncMock()) as run:
                result = asyncio.run(generator.main())
        self.assertEqual(result, 2)
        run.assert_not_awaited()

    def test_non_arabic_generation_does_not_require_fish_confirmation(self):
        with patch.object(
            sys, "argv",
            ["generate_story_audio.py", "--languages", "en", "--confirm-generation"],
        ):
            with patch.object(
                generator, "generate_story", new=AsyncMock(return_value=True)
            ) as run:
                result = asyncio.run(generator.main())
        self.assertEqual(result, 0)
        run.assert_awaited_once()
        self.assertEqual(run.await_args.kwargs["languages"], ("en",))

    def test_confirmed_generation_defaults_to_arabic_only(self):
        with patch.object(
            sys, "argv",
            ["generate_story_audio.py", "--confirm-generation", "--confirm-fish-audio"],
        ):
            with patch.object(
                generator, "generate_story", new=AsyncMock(return_value=True)
            ) as run:
                result = asyncio.run(generator.main())
        self.assertEqual(result, 0)
        run.assert_awaited_once()
        self.assertEqual(run.await_args.kwargs["languages"], ("ar",))

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



    def test_magdi_preflight_stops_before_tts_for_unapproved_block(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            story_path = root / "stories" / "science" / "001" / "story.json"
            story_path.parent.mkdir(parents=True)
            blocks = [
                {"speaker": "karma", "text": "مرحبا"},
                {"speaker": "narrator", "text": "النص الأول"},
                {"speaker": "other", "text": ""},
                {"speaker": "other", "text": ""},
                {"speaker": "other", "text": ""},
                {"speaker": "narrator", "text": "النص الأخير"},
            ]
            package = {
                "format": "KHALEDOON_STORY",
                "section": "science",
                "slug": "magdi-yacoub",
                "i18n": {"ar": {"blocks": blocks}},
            }
            story_path.write_text(json.dumps(package, ensure_ascii=False), encoding="utf-8")
            (story_path.parent / "data.json").write_text(
                json.dumps({"published": True}), encoding="utf-8"
            )
            pronunciation = {
                "story": "magdi-yacoub",
                "language": "ar",
                "blocks": {"0": "مرحبا", "1": "النص الأول", "5": "النص الأخير"},
            }
            (story_path.parent / "audio-pronunciation.json").write_text(
                json.dumps(pronunciation, ensure_ascii=False), encoding="utf-8"
            )
            audio_dir = root / "assets" / "audio" / "science" / "magdi-yacoub" / "ar"
            with patch.object(generator, "ROOT", root):
                with patch.object(generator, "is_original_karma_clip", return_value=True):
                    with patch.object(generator, "synthesize_fish_audio", new=AsyncMock()) as fish_tts:
                        with self.assertRaisesRegex(RuntimeError, "unexpected regeneration for block 5"):
                            asyncio.run(
                                generator.generate_story(
                                    story_path, dry_run=False, languages=("ar",)
                                )
                            )
            fish_tts.assert_not_awaited()
            self.assertFalse(audio_dir.exists())

    def test_approved_karma_block_3_is_regenerated_once_then_preserved(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            story_path = root / "stories" / "science" / "001" / "story.json"
            story_path.parent.mkdir(parents=True)
            text = "يعني مَرْكَز أسوان مش بس بيعالج المرضى؟"
            blocks = [
                {"speaker": "other", "text": ""},
                {"speaker": "other", "text": ""},
                {"speaker": "other", "text": ""},
                {"speaker": "karma", "text": text},
            ]
            package = {
                "format": "KHALEDOON_STORY",
                "section": "science",
                "slug": "magdi-yacoub",
                "i18n": {"ar": {"blocks": blocks}},
            }
            story_path.write_text(json.dumps(package, ensure_ascii=False), encoding="utf-8")
            (story_path.parent / "data.json").write_text(
                json.dumps({"published": True}), encoding="utf-8"
            )
            (story_path.parent / "audio-pronunciation.json").write_text(
                json.dumps({
                    "story": "magdi-yacoub",
                    "language": "ar",
                    "blocks": {"3": text},
                }, ensure_ascii=False),
                encoding="utf-8",
            )
            audio_dir = root / "assets" / "audio" / "science" / "magdi-yacoub" / "ar"
            audio_dir.mkdir(parents=True)
            destination = audio_dir / "003.mp3"
            destination.write_bytes(b"o" * 1024)
            original_manifest = {
                "version": 1,
                "engine": "fish-audio+edge-tts",
                "story": "magdi-yacoub",
                "section": "science",
                "language": "ar",
                "segments": [{
                    "block_index": 3,
                    "chunk_index": 0,
                    "speaker": "karma",
                    "voice": generator.FISH_AUDIO_KARMA_VOICE_ID,
                    "provider": "fish-audio",
                    "model": generator.FISH_AUDIO_MODEL,
                    "src": "003.mp3",
                    "hash": generator.KARMA_ORIGINAL_MANIFEST_HASH[3],
                    "text": text,
                }],
            }
            (audio_dir / "manifest.json").write_text(
                json.dumps(original_manifest, ensure_ascii=False), encoding="utf-8"
            )

            async def fake_fish_audio(request_text, target, voice_id):
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_bytes(b"n" * 1024)

            with patch.object(generator, "ROOT", root):
                with patch.object(
                    generator, "synthesize_fish_audio", new=AsyncMock(side_effect=fake_fish_audio)
                ) as fish_tts:
                    first = asyncio.run(
                        generator.generate_story(story_path, dry_run=False, languages=("ar",))
                    )
                    second = asyncio.run(
                        generator.generate_story(story_path, dry_run=False, languages=("ar",))
                    )

            self.assertTrue(first)
            self.assertTrue(second)
            fish_tts.assert_awaited_once_with(
                text, destination, generator.FISH_AUDIO_KARMA_VOICE_ID
            )
            saved = json.loads((audio_dir / "manifest.json").read_text(encoding="utf-8"))
            self.assertEqual(
                saved["segments"][0]["hash"],
                generator.text_hash(
                    text,
                    generator.FISH_AUDIO_KARMA_VOICE_ID,
                    generator.VOICE_SETTINGS["ar"]["karma"][1],
                    generator.VOICE_SETTINGS["ar"]["karma"][2],
                    "ar",
                ),
            )
            self.assertEqual(destination.read_bytes(), b"n" * 1024)

    def test_legacy_v3_manifest_hash_preserves_existing_audio_without_tts(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            story_path = root / "stories" / "science" / "001" / "story.json"
            story_path.parent.mkdir(parents=True)
            text = "A verified narrator sentence."
            package = {
                "format": "KHALEDOON_STORY",
                "section": "science",
                "slug": "legacy-audio-story",
                "i18n": {"en": {"blocks": [{"speaker": "narrator", "text": text}]}},
            }
            story_path.write_text(json.dumps(package), encoding="utf-8")
            (story_path.parent / "data.json").write_text(
                json.dumps({"published": True}), encoding="utf-8"
            )
            voice, rate, pitch = generator.VOICE_SETTINGS["en"]["narrator"]
            old_hash = generator.legacy_text_hash(text, voice, rate, pitch, "en")
            expected_legacy_hash = __import__("hashlib").sha256(json.dumps(
                [3, "en", text, voice, rate, pitch],
                ensure_ascii=False, separators=(",", ":")
            ).encode("utf-8")).hexdigest()
            self.assertEqual(old_hash, expected_legacy_hash)
            audio_dir = root / "assets" / "audio" / "science" / "legacy-audio-story" / "en"
            audio_dir.mkdir(parents=True)
            audio_bytes = b"x" * 1024
            (audio_dir / "000.mp3").write_bytes(audio_bytes)
            orphaned_path = audio_dir / "999.mp3"
            orphaned_path.write_bytes(b"preserve this older clip")
            manifest = {
                "version": 1,
                "engine": "fish-audio+edge-tts",
                "story": "legacy-audio-story",
                "section": "science",
                "language": "en",
                "segments": [{
                    "block_index": 0, "chunk_index": 0, "speaker": "narrator",
                    "voice": voice, "provider": "edge-tts", "model": "edge-tts",
                    "src": "000.mp3", "hash": old_hash, "text": text,
                }],
            }
            (audio_dir / "manifest.json").write_text(
                json.dumps(manifest), encoding="utf-8"
            )
            with patch.object(generator, "ROOT", root):
                with patch.object(generator, "synthesize", new=AsyncMock()) as edge_tts:
                    with patch.object(generator, "synthesize_fish_audio", new=AsyncMock()) as fish_tts:
                        result = asyncio.run(generator.generate_story(
                            story_path, dry_run=False, languages=("en",)
                        ))
            self.assertTrue(result)
            edge_tts.assert_not_awaited()
            fish_tts.assert_not_awaited()
            saved = json.loads((audio_dir / "manifest.json").read_text(encoding="utf-8"))
            self.assertEqual(saved["segments"][0]["hash"], old_hash)
            self.assertEqual(
                saved["segments"][0]["audio_sha256"],
                __import__("hashlib").sha256(audio_bytes).hexdigest(),
            )
            self.assertTrue(orphaned_path.exists(), "unreferenced MP3 files must be preserved for manual review")

    def test_generator_rejects_story_path_outside_repository(self):
        with tempfile.TemporaryDirectory() as temporary:
            outside = Path(temporary) / "story.json"
            with patch.object(generator, "ROOT", ROOT):
                with self.assertRaisesRegex(ValueError, "inside the repository"):
                    asyncio.run(generator.generate_story(outside, dry_run=True))

    def test_generator_protects_october_section_aliases(self):
        for alias in ("october", "october-1973", "october1973", "october_1973", "October 1973"):
            with self.subTest(alias=alias), tempfile.TemporaryDirectory() as temporary:
                root = Path(temporary)
                story_path = root / "stories" / alias / "001" / "story.json"
                story_path.parent.mkdir(parents=True)
                with patch.object(generator, "ROOT", root):
                    result = asyncio.run(generator.generate_story(story_path, dry_run=True))
                self.assertFalse(result)
                self.assertFalse((root / "assets").exists())

    def test_confirmed_generation_passes_selected_story_and_languages(self):
        with patch.object(
            sys, "argv",
            [
                "generate_story_audio.py",
                "--story", "stories/science/001/story.json",
                "--languages", "ar", "fr",
                "--confirm-generation",
                "--confirm-fish-audio",
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
