from pathlib import Path
import sys
import unittest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

import review_pronunciation as reviewer


class NumberFormClassificationTests(unittest.TestCase):
    def classify(self, visible: str, spoken: str) -> bool:
        return reviewer.is_number_form_only_difference(
            reviewer.tokenize(visible),
            reviewer.tokenize(spoken),
        )

    def test_deleting_ordinary_words_is_not_a_number_rewrite(self):
        self.assertFalse(
            self.classify("حضر عام 2020 من القاهرة", "حضر 2020 القاهرة")
        )

    def test_number_rewrite_requires_human_review(self):
        self.assertTrue(
            self.classify("ولد عام 1935", "ولد عام ألف وتسعمية خمسة وتلاتين")
        )

    def test_non_number_word_change_is_not_a_number_rewrite(self):
        self.assertFalse(
            self.classify("ولد عام 1935", "عاش عام 1935")
        )

    def test_date_spoken_with_ordinal_and_month_connector_requires_review(self):
        self.assertTrue(
            self.classify(
                "ولد في 16 نوفمبر سنة 1935",
                "ولد في السادس عشر من نوفمبر سنة ألف وتسعمية خمسة وتلاتين",
            )
        )

    def test_removing_from_before_a_city_is_not_a_number_rewrite(self):
        self.assertFalse(
            self.classify("حضر عام 2020 من القاهرة", "حضر عام ألفين وعشرين القاهرة")
        )

    def test_identical_text_is_not_a_difference(self):
        self.assertFalse(
            self.classify("ولد عام 1935", "ولد عام 1935")
        )


class MagdiYacoubPilotIntegrationTests(unittest.TestCase):
    def test_default_pilot_block_is_structurally_and_textually_valid(self):
        report = reviewer.build_report(
            ROOT / reviewer.DEFAULT_STORY,
            ROOT / reviewer.DEFAULT_MANIFEST,
            "ar",
            reviewer.DEFAULT_BLOCK_INDEX,
        )
        self.assertEqual(report["structural_validation"]["status"], "PASS")
        self.assertEqual(report["overall_textual_result"], "PASS_SOURCE_ONLY")
        self.assertEqual(report["block"]["textual_result"], "PASS")
        self.assertEqual(
            report["block"]["word_identity_and_order"]["visible_vs_submitted"]["visible_word_count"],
            33,
        )
        self.assertEqual(
            report["block"]["word_identity_and_order"]["submitted_vs_manifest"]["status"],
            "NOT_AVAILABLE",
        )
        self.assertEqual(
            report["block"]["manifest_text_verification"],
            "NOT_STORED_IN_MANIFEST",
        )

    def test_all_thirteen_magdi_blocks_are_reported_without_false_manifest_passes(self):
        report = reviewer.build_all_report(
            ROOT / reviewer.DEFAULT_STORY,
            ROOT / reviewer.DEFAULT_MANIFEST,
            "ar",
        )
        self.assertEqual(report["scope"]["block_count"], 13)
        self.assertEqual(report["summary"]["structural_failures"], 0)
        self.assertEqual(report["summary"]["block_results"]["PASS_SOURCE_ONLY"], 7)
        self.assertEqual(report["summary"]["block_results"]["REVIEW"], 6)
        self.assertEqual(report["summary"]["block_results"]["FAIL"], 0)
        self.assertEqual(report["summary"]["overall_textual_result"], "REVIEW")


if __name__ == "__main__":
    unittest.main()
