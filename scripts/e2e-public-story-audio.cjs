#!/usr/bin/env node
'use strict';
const assert = require('node:assert/strict');
const { chromium } = require('playwright');

const STORY_URL = 'https://engmohamedgamalsaad-oss.github.io/nourdeen-october-1973/stories/history/005/';
const MANIFEST_URL = 'https://ypwprddkscnfblhftkeb.supabase.co/storage/v1/object/public/khaledoon-story-audio-public/history/ibn-sina/ar/manifest.json';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1366, height: 900 } });
  const pageErrors = [];
  const failedRequests = [];
  const manifestResponses = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  page.on('requestfailed', request => failedRequests.push({ url: request.url(), error: request.failure()?.errorText }));
  page.on('response', response => {
    if (response.url().includes('/history/ibn-sina/ar/manifest.json')) {
      manifestResponses.push({ url: response.url(), status: response.status(), contentType: response.headers()['content-type'] });
    }
  });
  try {
    await page.goto(STORY_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.locator('#story').waitFor({ state: 'visible', timeout: 30000 });
    await page.waitForFunction(() => window.__KH_STORY_PACKAGE && window.__KH_STORY_PACKAGE.slug === 'ibn-sina', null, { timeout: 10000 });
    await page.waitForFunction(() => document.getElementById('kh-story-audio-script')?.dataset.loaded === '1' ||
      document.getElementById('kh-audio-player') !== null, null, { timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(2500);
    const diagnostic = await page.evaluate(async () => {
      const story = window.__KH_STORY_PACKAGE;
      const player = document.getElementById('kh-audio-player');
      const script = document.getElementById('kh-story-audio-script');
      let manifest = null;
      let manifestStatus = null;
      try {
        const response = await fetch('https://ypwprddkscnfblhftkeb.supabase.co/storage/v1/object/public/khaledoon-story-audio-public/history/ibn-sina/ar/manifest.json', { cache: 'no-store' });
        manifestStatus = response.status;
        if (response.ok) {
          const data = await response.json();
          manifest = {
            version: data.version, section: data.section, story: data.story, language: data.language,
            provider: data.provider, model: data.model, segmentCount: Array.isArray(data.segments) ? data.segments.length : null,
            firstSegment: Array.isArray(data.segments) ? data.segments[0] : null,
            invalidSegments: Array.isArray(data.segments) ? data.segments.map((segment, index) => {
              const expectedVoice = segment.speaker === 'karma' ? 'omnivoice-karma-reference' : 'omnivoice-narrator-reference';
              const checks = {
                provider: segment.provider === 'omnivoice',
                model: segment.model === 'VoiceTut Egyptian Tashkeel',
                voice: segment.voice === expectedVoice,
                src: /^[A-Za-z0-9_-]+\.mp3$/.test(String(segment.src || '')),
                speaker: ['karma', 'narrator'].includes(segment.speaker)
              };
              return Object.values(checks).every(Boolean) ? null : { index, src: segment.src, speaker: segment.speaker, provider: segment.provider, model: segment.model, voice: segment.voice, checks };
            }).filter(Boolean) : []
          };
        }
      } catch (error) { manifestStatus = String(error); }
      return {
        pageLanguage: document.documentElement.lang,
        storyIdentity: story && { section: story.section, slug: story.slug },
        scriptSrc: script && script.src,
        playerExists: !!player,
        playerHidden: player ? player.hidden : null,
        manifestStatus, manifest,
        playerText: player?.textContent?.slice(0, 300) || null
      };
    });
    console.log(JSON.stringify({ diagnostic, manifestResponses, pageErrors, failedRequests }, null, 2));
    assert.equal(diagnostic.storyIdentity?.section, 'history', 'published story package should identify the history section');
    assert.equal(diagnostic.storyIdentity?.slug, 'ibn-sina', 'published story package slug must match the public audio folder');
    assert.equal(diagnostic.manifestStatus, 200, 'public Arabic manifest must be readable from the visitor page');
    assert.equal(diagnostic.playerExists, true, 'the public audio player should be mounted');
    assert.equal(diagnostic.playerHidden, false, 'published Arabic audio must be visible on the public Ibn Sina story page');
    assert.match(diagnostic.scriptSrc || '', /20261114-public-audio-mp3-fix-1/, 'live visitor page must load the fixed player cache version');
    assert.deepEqual(diagnostic.manifest.invalidSegments, [], 'all 17 published segments must pass the public manifest contract');
    assert.deepEqual(pageErrors, [], 'public story page must not throw JavaScript errors');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error.stack || error); process.exitCode = 1; });
