import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const packagePath = path.join(here, '../story-packages/october-sea-men.v2.json');
const archivePath = path.join(here, '../../source-archives/october-sea-men-legacy-quiz-001.json');

test('October V2 package preserves every legacy quiz question and correct answer', async () => {
  const [pkg, archive] = await Promise.all([
    readFile(packagePath, 'utf8').then(JSON.parse),
    readFile(archivePath, 'utf8').then(JSON.parse)
  ]);

  assert.equal(archive.id, '001');
  assert.equal(archive.questions.length, 20, 'the archived source bank must remain intact');
  assert.equal(pkg.quiz.length, 23, '20 legacy questions plus 3 supplemental questions are expected');

  for (const [index, oldQuestion] of archive.questions.entries()) {
    const question = pkg.quiz[index];
    assert.ok(question, 'missing converted question ' + (index + 1));
    const ar = question.i18n?.ar;
    assert.equal(ar?.question, oldQuestion.q, 'Arabic question text changed at index ' + index);
    assert.deepEqual(
      [...ar.options].sort(),
      [...oldQuestion.o].sort(),
      'Arabic answer choices were lost or changed at index ' + index
    );
    assert.equal(
      ar.options[question.correct_option],
      oldQuestion.o[oldQuestion.a],
      'correct answer text changed at index ' + index
    );

    for (const lang of ['ar', 'en', 'fr', 'it', 'de']) {
      const localized = question.i18n?.[lang];
      assert.ok(localized?.question?.trim(), 'missing question translation: ' + (index + 1) + '/' + lang);
      assert.equal(localized.options?.length, 4, 'expected four options: ' + (index + 1) + '/' + lang);
      assert.ok(localized.options.every(option => typeof option === 'string' && option.trim()), 'empty option: ' + (index + 1) + '/' + lang);
      assert.ok(localized.explanation?.trim(), 'missing explanation: ' + (index + 1) + '/' + lang);
    }
  }

  for (const question of pkg.quiz.slice(20)) {
    assert.ok(question.id, 'supplemental questions need stable IDs');
    assert.ok(question.i18n?.ar?.question, 'supplemental question needs Arabic text');
  }
});
