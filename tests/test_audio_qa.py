import json
import sys
import tempfile
import types
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
import audio_qa


class ArabicTokenTests(unittest.TestCase):
    def test_tokenizer_covers_full_arabic_alphabet(self):
        tokens = audio_qa.tokenize("فريق طبي يزور أسوان")
        self.assertEqual([item["raw"] for item in tokens], ["فريق", "طبي", "يزور", "أسوان"])

    def test_diacritics_and_tatweel_are_ignored_in_comparison_keys(self):
        plain = audio_qa.tokenize("مجدي يعقوب")
        marked = audio_qa.tokenize("مَجْدِي يَعْقُوب")
        self.assertEqual([x["key"] for x in plain], [x["key"] for x in marked])
        self.assertEqual(audio_qa.strip_marks("مَـجْدِي"), "مجدي")


class LexiconTests(unittest.TestCase):
    def test_finds_canonical_entity_and_variant_with_attached_prefix(self):
        lexicon = {
            "entities": [{
                "id": "aswan",
                "forms": [{"raw": "أسوان", "keys": ("اسوان",)},
                          {"raw": "مدينة أسوان", "keys": ("مدينه", "اسوان")}],
            }]
        }
        hits = audio_qa.find_entities("وزار أسوان ثم مدينة أسوان", lexicon)
        self.assertEqual([hit["entity"] for hit in hits], ["aswan", "aswan"])
        self.assertEqual([hit["raw"] for hit in hits], ["أسوان", "مدينة أسوان"])

    def test_lexicon_rejects_duplicate_or_missing_entity_ids(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "lexicon.json"
            path.write_text(json.dumps({
                "entities": [
                    {"id": "same", "canonical": "أسوان", "variants": []},
                    {"id": "same", "canonical": "القاهرة", "variants": []},
                ]
            }, ensure_ascii=False), encoding="utf-8")
            fake_generator = types.SimpleNamespace(read_json=audio_qa.read_json)
            with self.assertRaisesRegex(ValueError, "unique id"):
                audio_qa.load_lexicon(fake_generator, path)


class PathSafetyTests(unittest.TestCase):
    def test_rejects_path_traversal_and_nested_filename(self):
        with tempfile.TemporaryDirectory() as tmp:
            folder = Path(tmp)
            for name in ("../outside.mp3", "nested/001.mp3", ""):
                with self.subTest(name=name):
                    with self.assertRaises(ValueError):
                        audio_qa.safe_audio_path(folder, name)

    def test_rejects_symlinked_audio_file(self):
        with tempfile.TemporaryDirectory() as tmp:
            folder = Path(tmp)
            target = folder / "real.mp3"
            target.write_bytes(b"audio")
            link = folder / "linked.mp3"
            try:
                link.symlink_to(target)
            except (OSError, NotImplementedError):
                self.skipTest("Symlinks are unavailable on this runner")
            with self.assertRaisesRegex(ValueError, "symlinked"):
                audio_qa.safe_audio_path(folder, "linked.mp3")




class AudioTextResolutionTests(unittest.TestCase):
    def test_legacy_hash_is_pinned_to_version_three(self):
        import hashlib
        import json
        fake_generator = types.SimpleNamespace(GENERATOR_VERSION="4")
        actual = audio_qa.legacy_hash(fake_generator, "مجدي يعقوب", "voice", "-2%", "+0Hz")
        expected = hashlib.sha256(json.dumps(
            [3, "ar", "مجدي يعقوب", "voice", "-2%", "+0Hz"],
            ensure_ascii=False, separators=(",", ":")
        ).encode("utf-8")).hexdigest()
        self.assertEqual(actual, expected)

    def test_audio_text_resolution_uses_reviewed_override(self):
        fake_generator = types.SimpleNamespace(
            prepare_arabic_audio_text=lambda original, reviewed=None: reviewed or original
        )
        resolved = audio_qa.resolve_audio_text(
            fake_generator, "مجدي يعقوب", 0, {"0": "مَجْدِي يَعْقُوب"}
        )
        self.assertEqual(resolved, "مَجْدِي يَعْقُوب")

    def test_audio_text_resolution_falls_back_to_visible_story_text(self):
        fake_generator = types.SimpleNamespace(
            prepare_arabic_audio_text=lambda original, reviewed=None: reviewed or original
        )
        resolved = audio_qa.resolve_audio_text(fake_generator, "مجدي يعقوب", 0, {})
        self.assertEqual(resolved, "مجدي يعقوب")


class ReportTests(unittest.TestCase):
    def test_finding_ids_are_unique_within_a_report(self):
        report = audio_qa.Report("science/015")
        report.add("candidate_name", "info", "first")
        report.add("candidate_name", "info", "second")
        self.assertNotEqual(report.findings[0]["id"], report.findings[1]["id"])
        self.assertTrue(all(not x["pronunciation_error_proven"] for x in report.findings))


if __name__ == "__main__":
    unittest.main()
