from pathlib import Path
import sys
import unittest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
import review_egyptian_dialect as dialect


class EgyptianDialectReviewTests(unittest.TestCase):
    def test_colloquial_egyptian_markers_are_detected(self):
        result = dialect.review_text("إزاي نقدر نساعد الناس؟ ده سؤال مهم، ومش صعب.")
        self.assertEqual(result["register"], "EGYPTIAN_LEANING")
        self.assertIn("إزاي", result["egyptian_cues"])

    def test_formal_constructions_are_advisory_not_errors(self):
        result = dialect.review_text("وبالتالي يُعد هذا العمل مهمًا حيث يساعد المرضى.")
        self.assertEqual(result["register"], "FORMAL_LEANING")
        self.assertTrue(result["warnings"])
        self.assertFalse(result["automatic_rewrite"])

    def test_mixed_register_is_flagged_without_rewriting(self):
        result = dialect.review_text("إزاي نقدر نساعد؟ وبالتالي هذا الأمر مهم.")
        self.assertEqual(result["register"], "MIXED_REGISTER")
        self.assertFalse(result["automatic_rewrite"])

    def test_diacritic_density_is_reported(self):
        result = dialect.review_text("وُلِدَ مَجْدِي يَعْقُوب في مِصْرَ.")
        self.assertGreater(result["diacritic_density"], 0)
        self.assertTrue(any("التشكيل" in warning for warning in result["warnings"]))

    def test_short_or_ambiguous_text_is_not_overclassified(self):
        result = dialect.review_text("هذا مهم")
        self.assertEqual(result["register"], "INSUFFICIENT_EVIDENCE")

    def test_karma_formal_language_gets_child_voice_review(self):
        result = dialect.review_text("وبالتالي يُعد هذا الأمر مهمًا حيث يساعد الأطفال.", "karma")
        self.assertTrue(any("حوار كارما" in warning for warning in result["warnings"]))


if __name__ == "__main__":
    unittest.main()
