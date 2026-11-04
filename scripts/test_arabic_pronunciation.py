#!/usr/bin/env python3
"""Unit tests for the shared Egyptian-Arabic audio pronunciation dictionary."""
from __future__ import annotations

import unittest

from arabic_pronunciation import (
    PronunciationDictionaryError,
    apply_dictionary,
    lexical_form,
    prepare_audio_text,
)


DICTIONARY = {
    "schema_version": 1,
    "entries": [
        {"id": "centre-after-anna", "match": "مركز أسوان للقلب", "spoken": "مَرْكَزَ أَسْوَانَ لِلْقَلْبِ", "before": "أن"},
        {"id": "centre-full", "match": "مركز أسوان للقلب", "spoken": "مَرْكَزُ أَسْوَانَ لِلْقَلْبِ"},
        {"id": "centre", "match": "مركز أسوان", "spoken": "مَرْكَزُ أَسْوَانَ"},
        {"id": "studies", "match": "وتذكر الدراسات", "spoken": "وَتَذْكُرُ الدِّرَاسَاتُ"},
    ],
}


class ArabicPronunciationTests(unittest.TestCase):
    def test_contextual_phrase_centre(self):
        result, used = apply_dictionary("يعني مركز أسوان مش بس بيعالج المرضى؟", DICTIONARY)
        self.assertIn("مَرْكَزُ أَسْوَانَ", result)
        self.assertEqual(used, ["centre"])

    def test_grammatical_context_selects_accusative_case(self):
        result, used = apply_dictionary("إلى أن مركز أسوان للقلب يجمع المرضى", DICTIONARY)
        self.assertIn("مَرْكَزَ أَسْوَانَ", result)
        self.assertEqual(used, ["centre-after-anna"])

    def test_grammatical_context_keeps_nominative_case(self):
        result, used = apply_dictionary("بدأ مركز أسوان للقلب استقبال المرضى", DICTIONARY)
        self.assertIn("مَرْكَزُ أَسْوَانَ", result)
        self.assertEqual(used, ["centre-full"])

    def test_contextual_phrase_studies(self):
        result, used = apply_dictionary("وتذكر الدراسات المنشورة هذه النتائج.", DICTIONARY)
        self.assertTrue(result.startswith("وَتَذْكُرُ الدِّرَاسَاتُ"))
        self.assertEqual(used, ["studies"])

    def test_no_partial_word_match(self):
        result, used = apply_dictionary("المركز الطبي في أسوان", DICTIONARY)
        self.assertEqual(result, "المركز الطبي في أسوان")
        self.assertEqual(used, [])

    def test_lexical_identity_is_preserved(self):
        source = "وتذكر الدراسات أن مركز أسوان مهم."
        result, _ = apply_dictionary(source, DICTIONARY)
        self.assertEqual(lexical_form(result), lexical_form(source))

    def test_story_override_then_shared_dictionary(self):
        result, used = prepare_audio_text(
            "النص الأصلي",
            "وتذكر الدراسات أن مركز أسوان يقدم الرعاية.",
            DICTIONARY,
        )
        self.assertTrue(result.startswith("وَتَذْكُرُ الدِّرَاسَاتُ"))
        self.assertIn("مَرْكَزُ أَسْوَانَ", result)
        self.assertEqual(set(used), {"studies", "centre"})

    def test_punctuation_is_not_removed_by_phrase_match(self):
        result, used = apply_dictionary("وتذكر، الدراسات مهمة", DICTIONARY)
        self.assertEqual(result, "وتذكر، الدراسات مهمة")
        self.assertEqual(used, [])

    def test_real_magdi_yacoub_audio_source_keeps_all_letters(self):
        import json
        from pathlib import Path
        root = Path(__file__).resolve().parents[1]
        story = json.loads((root / "stories/science/015/story.json").read_text(encoding="utf-8"))
        overrides = json.loads((root / "stories/science/015/audio-pronunciation.json").read_text(encoding="utf-8"))
        from arabic_pronunciation import load_dictionary
        dictionary = load_dictionary(root / "audio/pronunciation/ar-EG.json")
        blocks = story["i18n"]["ar"]["blocks"]
        for index, block in enumerate(blocks):
            if block.get("speaker") != "narrator":
                continue
            source = overrides.get("blocks", {}).get(str(index), block["text"])
            result, _ = apply_dictionary(source, dictionary)
            self.assertEqual(lexical_form(result), lexical_form(source), f"block {index}")

    def test_rejects_lexical_rewrite(self):
        bad = {"schema_version": 1, "entries": [
            {"id": "bad", "match": "مركز", "spoken": "مُرَكَّز"}
        ]}
        with self.assertRaises(PronunciationDictionaryError):
            apply_dictionary("مركز", bad)


if __name__ == "__main__":
    unittest.main(verbosity=2)
