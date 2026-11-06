#!/usr/bin/env python3
"""Tests for the isolated audio-only Arabic pronunciation dictionary."""
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
        {
            "id": "studies",
            "match": "وتذكر الدراسات",
            "spoken": "وَتَذْكُرُ الدِّرَاسَاتُ",
        },
        {
            "id": "biography",
            "match": "وتذكر السيرة المهنية",
            "spoken": "وَتَذْكُرُ السِّيرَةُ المِهْنِيَّةُ",
        },
    ],
}


class ArabicPronunciationTests(unittest.TestCase):
    def test_applies_exact_phrase_and_preserves_punctuation(self):
        source = "وتذكر الدراسات، أن العمل مهم."
        result, used = apply_dictionary(source, DICTIONARY)
        self.assertEqual(result, "وَتَذْكُرُ الدِّرَاسَاتُ، أن العمل مهم.")
        self.assertEqual(used, ["studies"])

    def test_applies_second_reviewed_phrase(self):
        result, used = apply_dictionary(
            "وتذكر السيرة المهنية المنشورة ذلك.", DICTIONARY
        )
        self.assertTrue(result.startswith("وَتَذْكُرُ السِّيرَةُ المِهْنِيَّةُ"))
        self.assertEqual(used, ["biography"])

    def test_does_not_match_when_punctuation_splits_phrase(self):
        source = "وتذكر، الدراسات المنشورة."
        result, used = apply_dictionary(source, DICTIONARY)
        self.assertEqual(result, source)
        self.assertEqual(used, [])

    def test_does_not_match_partial_words(self):
        source = "وتذكرت الدراسات المنشورة."
        result, used = apply_dictionary(source, DICTIONARY)
        self.assertEqual(result, source)
        self.assertEqual(used, [])

    def test_preserves_all_lexical_characters(self):
        source = "وتذكر الدراسات أن مركز أسوان للقلب مهم."
        result, _ = apply_dictionary(source, DICTIONARY)
        self.assertEqual(lexical_form(result), lexical_form(source))

    def test_preserves_original_spacing(self):
        source = "وتذكر   الدراسات المنشورة."
        result, _ = apply_dictionary(source, DICTIONARY)
        self.assertIn("   ", result)

    def test_story_override_is_audio_only_input(self):
        result, used = prepare_audio_text(
            "النص الأصلي",
            "وتذكر الدراسات المنشورة ذلك.",
            DICTIONARY,
        )
        self.assertTrue(result.startswith("وَتَذْكُرُ الدِّرَاسَاتُ"))
        self.assertEqual(used, ["studies"])

    def test_rejects_lexical_rewrite(self):
        bad = {
            "schema_version": 1,
            "entries": [
                {"id": "bad", "match": "مركز", "spoken": "مُرَكَّز"}
            ],
        }
        with self.assertRaises(PronunciationDictionaryError):
            apply_dictionary("مركز", bad)

    def test_rejects_uncontextualized_single_word(self):
        bad = {
            "schema_version": 1,
            "entries": [
                {"id": "bad", "match": "مركز", "spoken": "مَرْكَز"}
            ],
        }
        with self.assertRaises(PronunciationDictionaryError):
            apply_dictionary("مركز أسوان", bad)


if __name__ == "__main__":
    unittest.main(verbosity=2)
