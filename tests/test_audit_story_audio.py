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
