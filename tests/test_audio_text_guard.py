import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
from audio_text_guard import validate_pronunciation_blocks


def blocks(text):
    return [{"speaker": "narrator", "text": text}]


class PronunciationTextGuardTests(unittest.TestCase):
    def test_allows_diacritics(self):
        validate_pronunciation_blocks(
            blocks("مجدي يعقوب درس الطب"),
            {"0": "مَجْدِي يَعْقُوب دَرَسَ الطِّبَّ"},
        )

    def test_allows_punctuation_and_spacing(self):
        validate_pronunciation_blocks(
            blocks("درس الطب في القاهرة"),
            {"0": "درسُ الطبِّ، في القاهرة."},
        )

    def test_rejects_added_or_replaced_words(self):
        with self.assertRaisesRegex(ValueError, "block 0"):
            validate_pronunciation_blocks(
                blocks("العمل مع فريق طبي"),
                {"0": "العمل مع مجموعة من الأطباء"},
            )

    def test_rejects_reordered_words(self):
        with self.assertRaisesRegex(ValueError, "block 0"):
            validate_pronunciation_blocks(
                blocks("درس الطب في القاهرة"),
                {"0": "درس في القاهرة الطب"},
            )

    def test_rejects_unapproved_number_rewrites(self):
        with self.assertRaisesRegex(ValueError, "block 0"):
            validate_pronunciation_blocks(
                blocks("ولد عام 1935"),
                {"0": "ولد عام ألف وتسعمية خمسة وتلاتين"},
            )

    def test_allows_exact_approved_number_rewrites(self):
        validate_pronunciation_blocks(
            blocks("وُلد في 16 نوفمبر 1935"),
            {"0": "وُلِدَ في السادس عشر من نوفمبر سنة ألف وتسعمية خمسة وتلاتين"},
            {
                "0": {
                    "16": "السادس عشر من",
                    "1935": "سنة ألف وتسعمية خمسة وتلاتين",
                }
            },
        )

    def test_rejects_wrong_spoken_value_for_approved_number(self):
        with self.assertRaisesRegex(ValueError, "exactly once"):
            validate_pronunciation_blocks(
                blocks("ولد عام 1935"),
                {"0": "ولد عام ألف وتسعمية ستة وتلاتين"},
                {"0": {"1935": "ألف وتسعمية خمسة وتلاتين"}},
            )

    def test_rejects_non_number_rewrite_even_with_number_whitelist(self):
        with self.assertRaisesRegex(ValueError, "block 0"):
            validate_pronunciation_blocks(
                blocks("ولد عام 1935 في بلبيس"),
                {"0": "ولد عام ألف وتسعمية خمسة وتلاتين في القاهرة"},
                {"0": {"1935": "ألف وتسعمية خمسة وتلاتين"}},
            )

    def test_rejects_repeated_approved_phrase(self):
        with self.assertRaisesRegex(ValueError, "exactly once"):
            validate_pronunciation_blocks(
                blocks("عام 1935"),
                {"0": "ألف وتسعمية خمسة وتلاتين ثم ألف وتسعمية خمسة وتلاتين"},
                {"0": {"1935": "ألف وتسعمية خمسة وتلاتين"}},
            )

    def test_rejects_unknown_block(self):
        with self.assertRaisesRegex(ValueError, "outside story.json"):
            validate_pronunciation_blocks(blocks("النص"), {"1": "النص"})

    def test_rejects_non_speakable_block(self):
        with self.assertRaisesRegex(ValueError, "does not target"):
            validate_pronunciation_blocks(
                [{"speaker": "heading", "text": "عنوان"}], {"0": "عنوان"}
            )


if __name__ == "__main__":
    unittest.main()
