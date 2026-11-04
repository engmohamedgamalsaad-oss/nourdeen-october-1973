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
                "ولد في 16 نوفمبر 1935",
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


class MarkPositionTests(unittest.TestCase):
    def test_punctuation_position_is_part_of_comparison(self):
        self.assertNotEqual(
            reviewer.punctuation_marks("أهلاً، يا صديقي."),
            reviewer.punctuation_marks("أهلاً يا، صديقي."),
        )

    def test_diacritic_position_is_part_of_comparison(self):
        self.assertNotEqual(
            reviewer.diacritics("بَت"),
            reviewer.diacritics("بتَ"),
        )


    def test_positioned_mark_records_can_be_diffed(self):
        before = reviewer.punctuation_marks("أهلاً، يا صديقي.")
        after = reviewer.punctuation_marks("أهلاً يا، صديقي.")
        self.assertTrue(reviewer.sequence_differences(before, after))


class ManifestTextComparisonTests(unittest.TestCase):
    def make_segment(self, text: str) -> dict:
        return {
            "chunk_index": 0,
            "text": text,
            "src": "000.mp3",
            "hash": "a" * 64,
            "speaker": "narrator",
            "provider": "test",
        }

    def test_manifest_text_is_compared_when_it_is_available(self):
        report = reviewer.review_block(
            0,
            {"text": "ولد عام 1935", "speaker": "narrator"},
            [self.make_segment("ولد عام 1935")],
            "ولد عام 1935",
        )
        self.assertEqual(report["manifest_text_verification"], "AVAILABLE")
        self.assertEqual(
            report["word_identity_and_order"]["submitted_vs_manifest"]["status"],
            "PASS",
        )
        self.assertEqual(report["textual_result"], "PASS")

    def test_manifest_text_mismatch_is_not_hidden(self):
        report = reviewer.review_block(
            0,
            {"text": "ولد عام 1935", "speaker": "narrator"},
            [self.make_segment("ولد عام 1936")],
            "ولد عام 1935",
        )
        self.assertEqual(
            report["word_identity_and_order"]["submitted_vs_manifest"]["status"],
            "FAIL",
        )
        self.assertEqual(report["textual_result"], "FAIL")


class MagdiYacoubPilotIntegrationTests(unittest.TestCase):
    def test_default_pilot_block_is_structurally_and_textually_valid(self):
        report = reviewer.build_report(
            ROOT / reviewer.DEFAULT_STORY,
            ROOT / reviewer.DEFAULT_MANIFEST,
            "ar",
            reviewer.DEFAULT_BLOCK_INDEX,
        )
        self.assertEqual(report["structural_validation"]["status"], "PASS")
        # The manifest now records the same reviewed text as the pronunciation source.
        # This is a textual match only; it does not verify what the MP3 actually says.
        self.assertEqual(report["overall_textual_result"], "PASS")
        self.assertEqual(report["block"]["textual_result"], "PASS")
        self.assertTrue(report["block"]["listening_review_required"])
        self.assertEqual(report["spoken_pronunciation_result"], "NOT_TESTED")
        self.assertEqual(
            report["block"]["word_identity_and_order"]["visible_vs_submitted"]["status"],
            "PASS",
        )
        self.assertEqual(
            report["block"]["word_identity_and_order"]["submitted_vs_manifest"]["status"],
            "PASS",
        )
        self.assertEqual(
            report["block"]["manifest_text_verification"],
            "AVAILABLE",
        )
        self.assertRegex(report["manifest_sha256"], r"^[0-9a-f]{64}$")
        self.assertRegex(report["block"]["audio_segments"][0]["content_hash"], r"^[0-9a-f]{64}$")

    def test_all_thirteen_magdi_blocks_are_reported_without_false_manifest_passes(self):
        report = reviewer.build_all_report(
            ROOT / reviewer.DEFAULT_STORY,
            ROOT / reviewer.DEFAULT_MANIFEST,
            "ar",
        )
        self.assertEqual(report["scope"]["block_count"], 13)
        self.assertEqual(report["summary"]["structural_failures"], 0)
        # Current manifest text matches the reviewed source; number-form differences
        # remain REVIEW and must not be collapsed into an overall PASS.
        self.assertEqual(report["summary"]["block_results"]["PASS_SOURCE_ONLY"], 0)
        self.assertGreater(report["summary"]["block_results"]["REVIEW"], 0)
        self.assertEqual(report["summary"]["block_results"]["FAIL"], 0)
        self.assertEqual(report["summary"]["overall_textual_result"], "REVIEW")
        self.assertEqual(report["summary"]["spoken_pronunciation_result"], "NOT_TESTED")


if __name__ == "__main__":
    unittest.main()
