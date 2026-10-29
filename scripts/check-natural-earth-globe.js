'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
function read(rel) { return fs.readFileSync(path.join(root, rel), 'utf8'); }
function json(rel) { return JSON.parse(read(rel)); }

const geo = json('khaledoon/assets/geo/natural-earth-110m.json');
assert.match(geo.source_url, /^https:\/\/www\.naturalearthdata\.com\//, 'Natural Earth source URL must be HTTPS');
assert.match(geo.source, /Natural Earth 1:110m/i, 'geography data must declare its Natural Earth scale/source');
assert.match(geo.source + ' ' + geo.attribution, /public domain/i, 'geography attribution/license must be explicit');
assert.ok(Array.isArray(geo.land) && geo.land.length >= 100, 'expected real land geometry, not a few hand-drawn silhouettes');
assert.ok(Array.isArray(geo.borders) && geo.borders.length >= 100, 'expected country-border geometry');
assert.ok(Array.isArray(geo.cities) && geo.cities.length >= 100, 'expected a substantial real-city coordinate set');
for (const city of geo.cities) {
  assert.ok(typeof city.name === 'string' && city.name.trim(), 'every city needs a name');
  assert.ok(Number.isFinite(city.lat) && city.lat >= -90 && city.lat <= 90, 'city latitude must be valid: ' + city.name);
  assert.ok(Number.isFinite(city.lng) && city.lng >= -180 && city.lng <= 180, 'city longitude must be valid: ' + city.name);
}
for (const feature of geo.land) {
  assert.ok(['Polygon', 'MultiPolygon'].includes(feature.type), 'land geometry must be polygonal');
  assert.ok(Array.isArray(feature.coordinates) && feature.coordinates.length, 'land geometry coordinates must exist');
}
for (const feature of geo.borders) {
  assert.ok(['LineString', 'MultiLineString'].includes(feature.type), 'border geometry must be line-based');
  assert.ok(Array.isArray(feature.coordinates) && feature.coordinates.length, 'border coordinates must exist');
}

const world = read('khaledoon/assets/khaledoon-world.js');
const css = read('khaledoon/assets/khaledoon-world.css');
const map = read('khaledoon/assets/khaledoon-map.js');
const publisher = read('supabase/functions/publish-story-pr/index.ts');
const bundle = read('khaledoon/assets/story-template-bundle.js');
for (const token of [
  "var langs=['ar','en','fr','it','de']",
  "khaledoon/assets/geo/natural-earth-110m.json",
  'geography.land.forEach',
  'geography.borders.forEach',
  'geography.cities.forEach',
  'kh-world-story-card',
  'khm-card',
  'function loadSectionPalette',
  'function loadHiddenStories',
  'story_visibility?select=story_id',
  'hidden.indexOf(String(s.id))>=0',
  "dispatchEvent(new CustomEvent('kh:world-select'",
  'sectionColor(q.p.story.section)'
]) assert.ok(world.includes(token), 'globe integration missing: ' + token);
assert.ok(css.includes('.kh-world-story-card'), 'globe character popup needs its card styles');
assert.ok(world.includes('a.style.setProperty(\'--section-color\',sectionColor(section))'), 'story list chips must use the same live section palette as globe markers');
assert.ok(world.includes("approximate:'الموقع تقريبي ويحتاج إلى مراجعة'"), 'approximate-location notice must match the interactive map card');
assert.ok(map.includes("document.addEventListener('kh:world-select'"), 'globe selection must hand off to the existing interactive map');
assert.ok(bundle.includes("files.push({path:'stories/places.json'"), 'story publishing bundle must update the shared map places index');
assert.ok(bundle.includes('if(!hasMapMeta)throw new Error(\'map_location إلزامي لكل حكاية'), 'story bundle must require an explicit map_location decision');
assert.ok(publisher.includes('if (existingIndex < 0 && (!hasStoryPlace || place === null))'), 'new stories must not publish without a verified map point');
assert.ok(publisher.includes('currentPlaces[storyId] = { ...place, lat, lng }'), 'publisher must synchronize a new story location into stories/places.json');
assert.ok(publisher.includes('stories/places.json is required so publishing can synchronize the interactive map automatically'), 'publisher must require the synchronized places index');

const stories = json('stories/index.json');
const places = json('stories/places.json');
const storyIds = new Set(stories.map(s => String(s.id).padStart(3, '0')));
let eligible = 0;
for (const [id, place] of Object.entries(places)) {
  if (!/^\d{3}$/.test(id) || !place || !Number.isFinite(place.lat) || !Number.isFinite(place.lng)) continue;
  const localizedSource = place.source_name && typeof place.source_name === 'object' &&
    ['ar', 'en', 'fr', 'it', 'de'].every(l => typeof place.source_name[l] === 'string' && place.source_name[l].trim());
  if (!/^https:\/\//i.test(String(place.source_url || '')) || !localizedSource) continue;
  assert.ok(storyIds.has(id), 'a sourced map point must resolve to a published story: ' + id);
  eligible++;
}
assert.ok(eligible >= 5, 'expected multiple published stories with fully sourced, five-language map locations');
console.log('Natural Earth globe checks passed: ' + geo.land.length + ' land geometries, ' + geo.borders.length + ' border geometries, ' + geo.cities.length + ' cities, ' + eligible + ' fully sourced story points.');
