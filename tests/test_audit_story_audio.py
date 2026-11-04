from pathlib import Path
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
import audit_story_audio as audit


class AudioTextComparisonTests(unittest.TestCase):
    def test_arabic_diacritics_do_not_change_word_identity(self):
        self.assertEqual(
            audit.compare_text("مجدي يعقوب درس الطب", "مَجْدِي يَعْقُوب دَرَسَ الطِّبَّ", "ar"),
            "PASS",
        )

    def test_arabic_number_spelling_requires_human_review(self):
        self.assertEqual(
            audit.compare_text("ولد عام 1935", "ولد عام ألف وتسعمية خمسة وتلاتين", "ar"),
            "REVIEW_NUMBER_FORM",
        )

    def test_exact_approved_arabic_number_rewrite_is_accepted(self):
        self.assertEqual(
            audit.compare_text(
                "ولد في 16 نوفمبر 1935",
                "ولد في السادس عشر من نوفمبر سنة ألف وتسعمية خمسة وتلاتين",
                "ar",
                {
                    "16": "السادس عشر من",
                    "1935": "سنة ألف وتسعمية خمسة وتلاتين",
                },
            ),
            "PASS_APPROVED_NUMBER_REWRITE",
        )

    def test_number_whitelist_does_not_allow_unrelated_word_change(self):
        self.assertEqual(
            audit.compare_text(
                "ولد عام 1935 في بلبيس",
                "ولد عام ألف وتسعمية خمسة وتلاتين في القاهرة",
                "ar",
                {"1935": "ألف وتسعمية خمسة وتلاتين"},
            ),
            "FAIL_WORD_IDENTITY_OR_ORDER",
        )

    def test_arabic_added_word_is_a_failure(self):
        self.assertEqual(
            audit.compare_text("العمل مع فريق طبي", "العمل مع مجموعة من الأطباء", "ar"),
            "FAIL_WORD_IDENTITY_OR_ORDER",
        )

    def test_arabic_reordered_words_are_a_failure(self):
        self.assertEqual(
            audit.compare_text("درس الطب في القاهرة", "درس في القاهرة الطب", "ar"),
            "FAIL_WORD_IDENTITY_OR_ORDER",
        )

    def test_english_word_change_is_a_failure(self):
        self.assertEqual(
            audit.compare_text("He studied medicine in Cairo", "He studied science in Cairo", "en"),
            "FAIL_WORD_IDENTITY_OR_ORDER",
        )



class RepositoryCoverageTests(unittest.TestCase):
    def test_reports_missing_translations_for_all_five_languages(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            story_dir = root / "stories" / "science" / "001"
            story_dir.mkdir(parents=True)
            package = {
                "section": "science",
                "slug": "sample-story",
                "i18n": {
                    "ar": {"blocks": [{"speaker": "narrator", "text": "نص تجريبي"}]}
                },
            }
            (story_dir / "story.json").write_text(
                __import__("json").dumps(package, ensure_ascii=False), encoding="utf-8"
            )
            report = audit.audit_repository(root)
            languages = report["stories"][0]["languages"]
            self.assertEqual(set(languages), {"ar", "en", "fr", "it", "de"})
            for language in ("en", "fr", "it", "de"):
                self.assertEqual(languages[language]["status"], "MISSING_STORY_TRANSLATION")

    def test_custom_root_is_used_for_audio_inventory(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            story_dir = root / "stories" / "science" / "001"
            story_dir.mkdir(parents=True)
            audio_dir = root / "assets" / "audio" / "science" / "sample-story" / "ar"
            audio_dir.mkdir(parents=True)
            package = {
                "section": "science",
                "slug": "sample-story",
                "i18n": {"ar": {"blocks": [{"speaker": "narrator", "text": "نص"}]}},
            }
            story_path = story_dir / "story.json"
            story_path.write_text(__import__("json").dumps(package, ensure_ascii=False), encoding="utf-8")
            (audio_dir / "manifest.json").write_text(
                __import__("json").dumps({
                    "story": "sample-story", "section": "science", "language": "ar",
                    "segments": [{"block_index": 0, "chunk_index": 0, "src": "001.mp3", "text": "نص"}],
                }, ensure_ascii=False), encoding="utf-8"
            )
            (audio_dir / "001.mp3").write_bytes(b"x" * 600)
            result = audit.audit_language(story_path, package, "ar", root=root)
            self.assertEqual(result["status"], "TEXT_MATCH")


class AudioPathSafetyTests(unittest.TestCase):
    def test_rejects_path_traversal(self):
        with tempfile.TemporaryDirectory() as tmp:
            folder = Path(tmp) / "audio"
            folder.mkdir()
            self.assertIsNone(audit.safe_audio_file(folder, "../outside.mp3"))

    def test_accepts_file_inside_language_folder(self):
        with tempfile.TemporaryDirectory() as tmp:
            folder = Path(tmp) / "audio"
            folder.mkdir()
            self.assertEqual(audit.safe_audio_file(folder, "001.mp3"), folder / "001.mp3")


if __name__ == "__main__":
    unittest.main()
