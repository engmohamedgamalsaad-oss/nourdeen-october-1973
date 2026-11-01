#!/usr/bin/env node
"use strict";

// Enforce the minimum publishing bundle for each newly added canonical story page.
// Legacy redirect stubs at stories/001/index.html are intentionally excluded.
const fs = require("node:fs");
const { execFileSync } = require("node:child_process");

const base = process.env.STORY_CHECK_BASE || process.env.GITHUB_BASE_REF || "main";
let changed;
try {
  execFileSync("git", ["fetch", "origin", base], { stdio: "ignore" });
  changed = execFileSync("git", ["diff", "--diff-filter=A", "--name-only", `origin/${base}...HEAD`], { encoding: "utf8" })
    .split(/\r?\n/).filter(Boolean);
} catch (error) {
  console.error("Could not determine newly added files against base branch:", error.message);
  process.exit(2);
}

const pages = changed.filter(p => /^stories\/[^/]+\/\d{3}\/index\.html$/.test(p));
if (!pages.length) {
  console.log("No newly added canonical story pages; story readiness gate passed.");
  process.exit(0);
}

let failed = false;
function requireCheck(ok, story, message) {
  console.log(`${ok ? "PASS" : "FAIL"} [${story}] ${message}`);
  if (!ok) failed = true;
}
function read(file) {
  try { return fs.readFileSync(file, "utf8"); }
  catch { return null; }
}

for (const pagePath of pages) {
  const match = pagePath.match(/^stories\/([^/]+)\/(\d{3})\/index\.html$/);
  const section = match[1];
  const id = match[2];
  const story = `${section}/${id}`;
  const html = read(pagePath);
  const quizPath = `stories/quizzes/${id}.json`;
  const quizText = read(quizPath);
  const sourcePath = `stories/${section}/${id}/sources.md`;
  const sourceText = read(sourcePath);
  const dataPath = `stories/${section}/${id}/data.json`;
  const dataText = read(dataPath);
  requireCheck(Boolean(html), story, "story page exists");
  if (!html) continue;

  // V2 is canonical: validate the package and skip every V1 quiz/data requirement.
  const storyPage = html.includes('data-kh-story-reader') &&
    /data-story-path=["']data\.v2\.json["']/.test(html) &&
    html.includes('rebuild/reader.js');
  if (storyPage) {
    const storyPath = `stories/${section}/${id}/story.json`;
    const v2Text = read(storyPath);
    let v2 = null;
    try { v2 = v2Text ? JSON.parse(v2Text) : null; } catch {}
    requireCheck(Boolean(v2), story, `V2 package ${storyPath} exists and is valid JSON`);
    requireCheck(Boolean(v2 && v2.format === "KHALEDOON_STORY"), story, "V2 package is the canonical story format");
    requireCheck(html.includes('name="robots" content="noindex,nofollow"'), story, "new V2 page remains unlisted until reviewed and approved");
    let validationOutput = "";
    let valid = false;
    if (v2) {
      try {
        validationOutput = execFileSync(process.execPath, ["rebuild/validate-package.mjs", storyPath], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
        valid = true;
      } catch (error) {
        validationOutput = (error.stdout || "") + (error.stderr || "");
      }
    }
    requireCheck(valid, story, "V2 contract, translations, quiz, source and image metadata validate" + (valid ? "" : ": " + validationOutput.trim().slice(0, 500)));
    continue;
  }

  requireCheck(new RegExp(`data-story-slug=["']${id}["']`).test(html), story, `page uses its own data-story-slug ${id}`);
  requireCheck(html.includes("assets/shared/reactions.css") && html.includes("assets/shared/reactions.js"), story, "shared reaction styles and behavior are connected");
  requireCheck(html.includes('id="reaction-like"') && html.includes('class="reactions-section"') && (html.match(/data-reaction-choice=/g) || []).length >= 4 && (html.match(/data-reaction-count=/g) || []).length >= 5, story, "like button, four preset response choices, and reaction counters are present");
  requireCheck(html.includes("assets/shared/story-quiz.js") && html.includes('id="story-quiz-start"') && html.includes('id="story-quiz-app"'), story, "shared interactive quiz is connected to the page");

  let quiz = null;
  try { quiz = quizText ? JSON.parse(quizText) : null; } catch {}
  requireCheck(Boolean(quiz), story, `question bank ${quizPath} exists and contains valid JSON`);
  if (quiz) {
    const questions = Array.isArray(quiz.questions) ? quiz.questions : [];
    requireCheck(questions.length >= 5, story, `question bank has at least five questions (found ${questions.length})`);
    questions.forEach((q, index) => {
      const valid = q && typeof q.q === "string" && q.q.trim() &&
        Array.isArray(q.o) && q.o.length >= 2 &&
        Number.isInteger(q.a) && q.a >= 0 && q.a < q.o.length &&
        typeof q.e === "string" && q.e.trim();
      requireCheck(Boolean(valid), story, `question ${index + 1} has a prompt, options, a valid answer, and explanation`);
      for (const lang of ["en", "fr", "it", "de"]) {
        const translated = q && q.i18n && q.i18n[lang];
        const translationValid = translated && typeof translated.q === "string" && translated.q.trim() &&
          Array.isArray(translated.o) && translated.o.length === q.o.length &&
          translated.o.every(option => typeof option === "string" && option.trim()) &&
          typeof translated.e === "string" && translated.e.trim();
        requireCheck(Boolean(translationValid), story, `question ${index + 1} has complete ${lang} translation`);
      }
    });
  }

  const sourceUrls = sourceText ? [...new Set(sourceText.match(/https?:\/\/[^\s)\]>]+/g) || [])] : [];
  requireCheck(Boolean(sourceText) && sourceUrls.length >= 2, story, `sources.md lists at least two source URLs (found ${sourceUrls.length})`);
  const sourceSection = html.match(/<section\b[^>]*\bid=["']sources["'][^>]*>[\s\S]*?<\/section>/i);
  requireCheck(Boolean(sourceSection && /https?:\/\//i.test(sourceSection[0])), story, "page has a visible sources section with source links");

  let data = null;
  try { data = dataText ? JSON.parse(dataText) : null; } catch {}
  requireCheck(Boolean(data && typeof data.published === "boolean" && typeof data.title === "string" && data.title.trim()), story, "story data.json exists with a title and an explicit publish state (drafts are allowed during review)");
}
process.exit(failed ? 1 : 0);
