from pathlib import Path
import json
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
import review_egyptian_dialect as dialect


class EgyptianDialectReviewTests(unittest.TestCase):
    def make_story(self, root: Path, section: str, slug: str, pronunciation=None) -> Path:
        folder = root / section / slug
        folder.mkdir(parents=True, exist_ok=True)
        story = {
            "format": "KHALEDOON_STORY",
            "section": section,
            "slug": slug,
            "i18n": {
                "ar": {
                    "blocks": [
                        {"speaker": "narrator", "text": "إزاي نقدر نساعد الناس؟ ده سؤال مهم."},
                        {"speaker": "karma", "text": "مش عارفة الإجابة، وعايزة أفهم أكتر."},
                    ]
                }
            },
        }
        path = folder / "story.json"
        path.write_text(json.dumps(story, ensure_ascii=False), encoding="utf-8")
        if pronunciation is not None:
            (folder / "audio-pronunciation.json").write_text(
                json.dumps({
                    "story": slug,
                    "language": "ar",
                    "blocks": pronunciation,
                }, ensure_ascii=False),
                encoding="utf-8",
            )
        return path

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


    def test_report_uses_audio_only_source_without_changing_visible_text(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            path = self.make_story(root, "science", "sample", {"0": "إزاي نقدر نساعد الناس؟ ده سؤال مهم."})
            report = dialect.build_report(path)
            self.assertEqual(report["summary"]["blocks_reviewed"], 2)
            self.assertEqual(report["blocks"][0]["source_kind"], "audio_pronunciation")
            self.assertTrue(all(item["visible_story_text_unchanged"] for item in report["blocks"]))
            self.assertEqual(report["summary"]["automatic_rewrites"], 0)
            self.assertEqual(report["summary"]["fish_audio_calls"], 0)

    def test_missing_pronunciation_file_falls_back_to_spoken_story_blocks(self):
        with tempfile.TemporaryDirectory() as directory:
            path = self.make_story(Path(directory), "science", "sample")
            report = dialect.build_report(path)
            self.assertEqual(report["summary"]["blocks_reviewed"], 2)
            self.assertTrue(all(item["source_kind"] == "story_text_fallback" for item in report["blocks"]))

    def test_all_story_report_scans_non_october_packages_and_excludes_october(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory) / "stories"
            self.make_story(root, "science", "one")
            self.make_story(root, "people", "two")
            self.make_story(root, "october", "protected")
            report = dialect.build_all_stories_report(root)
            self.assertEqual(report["summary"]["stories_reviewed"], 2)
            self.assertEqual(report["summary"]["blocks_reviewed"], 4)
            self.assertEqual(report["summary"]["october_stories_included"], 0)
            self.assertEqual({item["section"] for item in report["stories"]}, {"science", "people"})

    def test_explicit_october_story_is_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            path = self.make_story(Path(directory), "october", "protected")
            with self.assertRaisesRegex(dialect.ReviewError, "October"):
                dialect.build_report(path)

    def test_audio_pronunciation_indexes_must_match_spoken_story_blocks(self):
        with tempfile.TemporaryDirectory() as directory:
            path = self.make_story(Path(directory), "science", "sample", {"99": "إزاي نقدر نساعد الناس؟"})
            with self.assertRaisesRegex(dialect.ReviewError, "not speakable"):
                dialect.build_report(path)


if __name__ == "__main__":
    unittest.main()
