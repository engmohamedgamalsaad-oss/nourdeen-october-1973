#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const base = process.env.BASE_SHA;
const head = process.env.HEAD_SHA;
if (!base || !head) {
  console.error("Story completeness check requires BASE_SHA and HEAD_SHA.");
  process.exit(2);
}

const added = execFileSync("git", ["diff", "--diff-filter=A", "--name-only", base, head], { encoding: "utf8" })
  .split(/\r?\n/).filter(Boolean);
const pages = added.map(p => {
  const m = p.match(/^stories\/([^/]+)\/(\d{3})\/index\.html$/);
  return m ? { path: p, section: m[1], id: m[2] } : null;
}).filter(Boolean);

if (!pages.length) {
  console.log("No newly added nested story pages in this pull request; completeness check skipped.");
  process.exit(0);
}

let failures = 0;
function fail(id, message) {
  failures++;
  console.error("FAIL story " + id + ": " + message);
}
function read(p) {
  try { return fs.readFileSync(p, "utf8"); }
  catch (_) { return null; }
}
function countExternalUrls(s) {
  return (s.match(/https?:\/\/[^\s)"'<>]+/g) || []).length;
}

for (const story of pages) {
  const dir = path.dirname(story.path);
  const html = read(story.path) || "";
  const dataPath = path.join(dir, "data.json");
  const sourcesPath = path.join(dir, "sources.md");
  const quizPath = path.join("stories", "quizzes", story.id + ".json");
  const dataText = read(dataPath);
  const sources = read(sourcesPath);
  const quizText = read(quizPath);

  if (!dataText) fail(story.id, "missing " + dataPath);
  else {
    try {
      const data = JSON.parse(dataText);
      if (!data.title || !String(data.title).trim()) fail(story.id, "data.json has no title");
    } catch (_) { fail(story.id, "data.json is not valid JSON"); }
  }

  if (!html.includes('data-story-slug="' + story.id + '"')) {
    fail(story.id, "page must set data-story-slug to its own story ID");
  }
  if (!html.includes('id="reaction-like"') || !html.includes("data-reaction-choice=") || !/assets\/shared\/reactions\.js/.test(html)) {
    fail(story.id, "missing the shared like/reaction UI or reactions.js");
  }
  if (!html.includes('id="story-quiz-start"') || !html.includes('id="story-quiz-app"') || !/assets\/shared\/story-quiz\.js/.test(html)) {
    fail(story.id, "missing quiz UI or shared story-quiz.js");
  }
  if (!/<section[^>]*class=["'][^"']*sources[^"']*["'][^>]*>/i.test(html)) {
    fail(story.id, "missing a visible sources section in index.html");
  }

  if (!sources) fail(story.id, "missing sources.md beside the story");
  else if (countExternalUrls(sources) < 2) fail(story.id, "sources.md must include at least two actual reference URLs");

  if (!quizText) fail(story.id, "missing " + quizPath);
  else {
    try {
      const quiz = JSON.parse(quizText);
      const questions = quiz.questions;
      if (!Array.isArray(questions) || questions.length < 5) {
        fail(story.id, "quiz bank must contain at least five questions");
      } else {
        const langs = ["en", "fr", "it", "de"];
        questions.forEach((q, index) => {
          const label = "question " + (index + 1);
          if (!q.q || !Array.isArray(q.o) || q.o.length < 4 || !Number.isInteger(q.a) || q.a < 0 || q.a >= q.o.length || !q.e) {
            fail(story.id, label + " needs text, four options, a valid answer index, and an explanation");
          }
          for (const lang of langs) {
            const t = q.i18n && q.i18n[lang];
            if (!t || !t.q || !Array.isArray(t.o) || t.o.length < 4 || !t.e) {
              fail(story.id, label + " is missing complete " + lang + " question/options/explanation");
            }
          }
        });
      }
      if (quiz.id && String(quiz.id).padStart(3, "0") !== story.id) {
        fail(story.id, "quiz ID does not match the story directory");
      }
    } catch (_) { fail(story.id, "quiz JSON is invalid"); }
  }
}

if (failures) {
  console.error("\n" + failures + " story completeness check(s) failed.");
  process.exit(1);
}
console.log("Passed: " + pages.length + " new story page(s) include reactions, a five-question five-language quiz bank, and documented sources.");
