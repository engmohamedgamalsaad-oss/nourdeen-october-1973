from __future__ import annotations

import importlib
import sys
import types
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
sys.modules.setdefault("edge_tts", types.ModuleType("edge_tts"))
generator = importlib.import_module("generate_story_audio")


class ArabicAudioTextIntegrityTests(unittest.TestCase):
    def test_diacritics_are_allowed(self):
        self.assertEqual(
            generator.prepare_arabic_audio_text(
                "مجدي يعقوب درس الطب",
                "مَجْدِي يَعْقُوب دَرَسَ الطِّبَّ",
            ),
            "مَجْدِي يَعْقُوب دَرَسَ الطِّبَّ",
        )

    def test_punctuation_and_spacing_are_allowed(self):
        self.assertEqual(
            generator.prepare_arabic_audio_text(
                "مجدي يعقوب درس الطب",
                "مجدي يعقوب، درس الطب.",
            ),
            "مجدي يعقوب، درس الطب.",
        )

    def test_paraphrase_is_rejected(self):
        with self.assertRaisesRegex(ValueError, "spoken words or their order differ"):
            generator.prepare_arabic_audio_text(
                "العمل مع فريق طبي",
                "العمل مع مجموعة من الأطباء والممرضين والباحثين",
            )

    def test_added_word_is_rejected(self):
        with self.assertRaises(ValueError):
            generator.prepare_arabic_audio_text("درس الطب", "درس الطب في القاهرة")

    def test_removed_word_is_rejected(self):
        with self.assertRaises(ValueError):
            generator.prepare_arabic_audio_text("درس الطب في القاهرة", "درس الطب")

    def test_reordered_words_are_rejected(self):
        with self.assertRaises(ValueError):
            generator.prepare_arabic_audio_text("درس الطب في القاهرة", "درس في القاهرة الطب")

    def test_number_rewording_is_rejected_for_editorial_review(self):
        with self.assertRaisesRegex(ValueError, "number/date wording differs"):
            generator.prepare_arabic_audio_text(
                "وُلد في 16 نوفمبر 1935",
                "وُلِدَ في السادس عشر من نوفمبر سنة ألف وتسعمية خمسة وتلاتين",
            )

    def test_default_text_is_unchanged(self):
        text = "وُلد مجدي يعقوب في بلبيس."
        self.assertEqual(generator.prepare_arabic_audio_text(text), text)


if __name__ == "__main__":
    unittest.main()
