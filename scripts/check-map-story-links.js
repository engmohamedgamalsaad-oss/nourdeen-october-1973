#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");
const index = JSON.parse(read("stories/index.json"));
const places = JSON.parse(read("stories/places.json"));
const mapScript = read("khaledoon/assets/khaledoon-map.js");
const homepage = read("index.html");
const errors = [];
const seen = new Set();

function fail(message) { errors.push(message); }
function storyId(value) { return String(value ?? "").padStart(3, "0"); }
function walkStoryData() {
  const found = [];
  const storiesRoot = path.join(root, "stories");
  for (const section of fs.readdirSync(storiesRoot, { withFileTypes: true })) {
    if (!section.isDirectory() || !/^[a-z0-9-]+$/.test(section.name)) continue;
    const sectionPath = path.join(storiesRoot, section.name);
    for (const dir of fs.readdirSync(sectionPath, { withFileTypes: true })) {
      if (!dir.isDirectory() || !/^\d{3}$/.test(dir.name)) continue;
      const dataPath = path.join(sectionPath, dir.name, "data.json");
      if (!fs.existsSync(dataPath)) continue;
      try {
        const data = JSON.parse(fs.readFileSync(dataPath, "utf8"));
        found.push({ id: dir.name, section: section.name, data });
      } catch (e) {
        fail(`Invalid JSON: stories/${section.name}/${dir.name}/data.json`);
      }
    }
  }
  return found;
}

if (!Array.isArray(index)) fail("stories/index.json must be an array.");
else {
  for (const entry of index) {
    if (!entry || typeof entry !== "object") { fail("Story index contains an invalid entry."); continue; }
    const id = storyId(entry.id);
    const key = entry.section + "/" + id;
    if (seen.has(key)) fail(`Duplicate story index entry: ${key}`);
    seen.add(key);
    if (!/^[a-z0-9-]+$/.test(String(entry.section || "")) || !/^\d{3}$/.test(id)) {
      fail(`Invalid story section or ID in index: ${key}`);
      continue;
    }
    const expectedPath = `stories/${entry.section}/${id}/`;
    if (entry.path !== expectedPath) fail(`Wrong story link for ${key}: expected ${expectedPath}, got ${entry.path}`);
    const page = path.join(root, expectedPath, "index.html");
    const dataPath = path.join(root, expectedPath, "data.json");
    if (!fs.existsSync(page)) fail(`Missing target page for ${key}: ${expectedPath}index.html`);
    if (!fs.existsSync(dataPath)) fail(`Missing story data for indexed story ${key}`);
    else {
      try {
        const data = JSON.parse(fs.readFileSync(dataPath, "utf8"));
        if (data.published === false) fail(`Unpublished story is listed in public index: ${key}`);
        if (entry.title !== data.title) fail(`Index title does not match data.json for ${key}`);
      } catch (e) { fail(`Invalid JSON: ${expectedPath}data.json`); }
    }
    const place = places[id];
    if (place && (!Number.isFinite(place.lat) || !Number.isFinite(place.lng) ||
        Math.abs(place.lat) > 90 || Math.abs(place.lng) > 180)) {
      fail(`Invalid map coordinates for ${key}`);
    }
  }
}

for (const story of walkStoryData()) {
  const key = story.section + "/" + story.id;
  const listed = seen.has(key);
  if (story.data.published === false && listed) fail(`Draft story must not appear in the public map index: ${key}`);
  if (story.data.published !== false && !listed) fail(`Published story is missing from stories/index.json and the map directory: ${key}`);
}

if (!homepage.includes("khaledoon/assets/khaledoon-map.css") ||
    !homepage.includes("khaledoon/assets/khaledoon-map.js")) {
  fail("Homepage must load the interactive map CSS and JavaScript.");
}
if (!mapScript.includes("function buildDirectory()") ||
    !mapScript.includes("storiesAll.forEach") ||
    !mapScript.includes("function storyHref(s)") ||
    !mapScript.includes("a.href = storyHref(s)") ||
    !mapScript.includes("T('noPlace')")) {
  fail("Map must render a direct-link directory for all published indexed stories, including stories without verified coordinates.");
}
if (!mapScript.includes("s.published === false")) fail("Map must exclude unpublished drafts.");

if (errors.length) {
  errors.forEach((e) => console.error("FAIL — " + e));
  process.exit(1);
}
console.log(`PASS — ${index.length} published stories have valid direct links in the map directory.`);
console.log("PASS — all published story data files are indexed; drafts are excluded.");
console.log("PASS — map coordinates are validated when present; missing locations are labeled instead of guessed.");
console.log("PASS — homepage map assets and story-link directory are connected.");
