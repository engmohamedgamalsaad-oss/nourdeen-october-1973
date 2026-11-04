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

    def test_rejects_number_rewrites(self):
        with self.assertRaisesRegex(ValueError, "block 0"):
            validate_pronunciation_blocks(
                blocks("ولد عام 1935"),
                {"0": "ولد عام ألف وتسعمية خمسة وتلاتين"},
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
