from pathlib import Path
import sys
import types
import unittest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
sys.modules.setdefault("edge_tts", types.ModuleType("edge_tts"))
import generate_story_audio as generator


class ArabicAudioTextIntegrityTests(unittest.TestCase):
    def test_diacritics_and_punctuation_are_allowed(self):
        self.assertEqual(
            generator.prepare_arabic_audio_text(
                "مجدي يعقوب درس الطب",
                "مَجْدِي يَعْقُوب، دَرَسَ الطِّبَّ.",
            ),
            "مَجْدِي يَعْقُوب، دَرَسَ الطِّبَّ.",
        )

    def test_whitespace_changes_are_allowed(self):
        self.assertEqual(
            generator.prepare_arabic_audio_text("مجدي   يعقوب", "مجدي يعقوب"),
            "مجدي يعقوب",
        )

    def test_added_words_are_rejected(self):
        with self.assertRaisesRegex(ValueError, "word identity"):
            generator.prepare_arabic_audio_text(
                "العمل مع فريق طبي",
                "العمل مع مجموعة من الأطباء والممرضين",
            )

    def test_removed_words_are_rejected(self):
        with self.assertRaisesRegex(ValueError, "word identity"):
            generator.prepare_arabic_audio_text(
                "دراسة وخبرة ومهارة",
                "دراسة ومهارة",
            )

    def test_reordered_words_are_rejected(self):
        with self.assertRaisesRegex(ValueError, "word identity"):
            generator.prepare_arabic_audio_text(
                "درس الطب في القاهرة",
                "درس في القاهرة الطب",
            )

    def test_number_to_words_rewrite_is_rejected(self):
        with self.assertRaisesRegex(ValueError, "word identity"):
            generator.prepare_arabic_audio_text(
                "ولد عام 1935",
                "ولد عام ألف وتسعمية خمسة وتلاتين",
            )

    def test_default_text_is_returned_when_no_audio_override_exists(self):
        self.assertEqual(
            generator.prepare_arabic_audio_text("مَجْدِي يَعْقُوب"),
            "مَجْدِي يَعْقُوب",
        )


if __name__ == "__main__":
    unittest.main()
