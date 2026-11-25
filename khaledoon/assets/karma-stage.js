// khaledoon/assets/karma-stage.js
// Karma 3D stage for the story-card pages. ES module. Loaded only when the page opts in (see karma-stage-loader.js).
// Draws the real skinned Karma GLB (Three.js, orthographic, CSS-pixel world) on a transparent fixed canvas above the page,
// next to the story cards, driven by KarmaMotion. If anything fails the canvas is removed and the page is untouched.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { createRig } from '../../assets/3d/karma/claude_track_2026-11-25/js/KarmaRig.js';
import { KarmaMotion } from '../../assets/3d/karma/rig_integration_2026-11-25/js/KarmaMotion.js';

const DEFAULTS = { cardSelector: '.gate, .story-index-card, .story-card, [data-story-card]', obstacleSelector: '.kh-sp', keepOutSelector: '.tag, h1, h2, h3, .lead, .eyebrow, .head p, .heading p, .hero p, .hero img, .kh-sp, footer, header', glbUrl: null, auto: true, reserveGutter: true, coverGuard: true, charHeight: null, onState: null };

export async function startKarmaStage(opts = {}) {
  const o = { ...DEFAULTS, ...opts };
  if (!o.glbUrl) throw new Error('karma-stage: glbUrl is required');
  const mobile = matchMedia('(max-width: 700px)').matches || matchMedia('(pointer: coarse)').matches;
  const canvas = document.createElement('canvas');
  canvas.id = 'karma-stage'; canvas.setAttribute('aria-hidden', 'true');
  canvas.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;pointer-events:none;z-index:40;';
  document.body.appendChild(canvas);
  const fail = (e) => { try { canvas.remove(); } catch (_) {} console.warn('karma-stage disabled:', e && e.message || e); };
  try {
    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: !mobile, powerPreference: 'low-power' });
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, mobile ? 1.5 : 2));
    let vw = innerWidth, vh = innerHeight; renderer.setSize(vw, vh, false);
    const scene = new THREE.Scene();
    const cam = new THREE.OrthographicCamera(-vw / 2, vw / 2, vh / 2, -vh / 2, -2000, 2000); cam.position.z = 500;
    scene.add(new THREE.HemisphereLight(0xffffff, 0x8a7a70, 1.6)); const dl = new THREE.DirectionalLight(0xffffff, 1.6); dl.position.set(-0.4, 0.8, 1); scene.add(dl);
    const gltf = await new GLTFLoader().loadAsync(o.glbUrl);
    const rig = createRig(gltf.scene);
    const mobH = () => (o.reserveGutter ? Math.min(110, vh * 0.15) : Math.min(150, vh * 0.2));
    const charH = o.charHeight || (mobile ? mobH() : Math.min(230, vh * 0.28));
    const cards = () => [...document.querySelectorAll(o.cardSelector + (o.obstacleSelector ? ', ' + o.obstacleSelector : ''))].filter((e) => e.offsetParent !== null);
    const idOf = (el) => (el.dataset.karmaId ||= 'c' + Math.random().toString(36).slice(2, 8));
    const rectOf = (el) => { const r = el.getBoundingClientRect(); return { id: idOf(el), obstacleOnly: !!(o.obstacleSelector && el.matches(o.obstacleSelector) && !el.matches(o.cardSelector)), left: r.left, top: r.top, width: r.width, height: r.height }; };
    const getCardRects = () => cards().map(rectOf).filter((r) => r.top < vh && r.top + r.height > 0);
    // keep-out = every visible text-like block outside the cards: headings, paragraphs, links, buttons, tags, list items, plus the configured selector
    const TEXTSEL = 'h1, h2, h3, h4, p, a, button, li, label, .tag, .eyebrow, .lead';
    const getKeepOutRects = () => { const seen = new Set(); const out = [];
      for (const e of document.querySelectorAll(o.keepOutSelector + ', ' + TEXTSEL)) { if (seen.has(e)) continue; seen.add(e); if (e.closest(o.cardSelector) || e.closest('#karma-stage')) continue;
        const r = e.getBoundingClientRect(); if (r.width > 0 && r.height > 0 && r.top < vh && r.bottom > 0 && getComputedStyle(e).visibility !== 'hidden') out.push({ left: r.left, top: r.top, width: r.width, height: r.height }); }
      return out; };
    const c = new KarmaMotion({ rig, getCardRects, getKeepOutRects, viewport: { width: vw, height: vh }, characterHeightPx: charH, modelHeight: 1 });
    // Responsive layout: when the cards leave no free side (phones), reserve real in-flow space (right padding on the cards' container)
    // sized to the character, so she stands in a gutter instead of over content. No overlay, no hiding.
    let gutterEl = null, gutterOrig = '';
    const reserve = () => { if (!o.reserveGutter) return; const first = [...document.querySelectorAll(o.cardSelector)].find((e) => e.offsetParent !== null); if (!first) return;
      const host = first.parentElement; if (!host) return; if (!gutterEl) { gutterEl = host; gutterOrig = host.style.paddingRight; }
      const need = Math.ceil(c.halfW * 2 + 8), r = first.getBoundingClientRect(); const free = Math.max(vw - (r.right + parseFloat(getComputedStyle(host).paddingRight || 0)), 0) ;
      const room = vw - r.right >= need || r.left >= need; const wide = vw - r.width >= need * 2 + 32;
      if (wide && room) { host.style.paddingRight = gutterOrig; return; }
      host.style.paddingRight = need + 'px'; host.dataset.karmaGutter = String(need); };
    scene.add(c.object3D);
    c.pos.set(vw + c.halfW * 2, vh); // starts off-screen on the right

    // choose the card to visit: the most visible one nearest the viewport centre
    const elig = (r) => !r.obstacleOnly && sideFor(r) && (r.top + r.height / 2) >= charH + 10 && (r.top + r.height / 2) <= vh - 10;
    const pick = (avoidId) => {
      let R = getCardRects().filter((r) => r.id !== avoidId && elig(r)); if (!R.length) R = getCardRects().filter(elig); /* single-card page: revisit the same card */ if (!R.length) return null;
      R.sort((a, b) => Math.abs(a.top + a.height / 2 - vh / 2) - Math.abs(b.top + b.height / 2 - vh / 2)); return R[0]; };
    // side with the most free room next to the card; if neither side has room for her body, stand on top
    const sideFor = (r) => { const room = { right: vw - (r.left + r.width), left: r.left }; const need = c.halfW * 2 + 8;
      if (room.right >= need && room.right >= room.left) return 'right'; if (room.left >= need) return 'left'; return null; };
    // never cover content: the model is hidden for any frame where its box would overlap a card, photo or text block
    const boxOf = () => ({ l: c.pos.x - c.halfW, r: c.pos.x + c.halfW, t: c.pos.y - charH, b: c.pos.y });
    let hiddenFrames = 0, shownFrames = 0, hiddenSince = 0;
    let lastHit = null; const guard = () => { const m = boxOf(); let hit = false; lastHit = null;
      const tol = c.stateName === 'lean' ? 36 : 12; // lean-on-card contact: a few px of arm/shoulder may touch the card edge without hiding her
      const am = Math.max(8, 0.08 * charH); const keeps = getKeepOutRects().map((q) => ({ left: q.left - am, top: q.top, width: q.width + 2 * am, height: q.height })); /* arm swing adds up to ~0.08 charH each side (measured 3-7 px) */ for (const [kind, r] of [...getCardRects().map((q) => ['card', { ...q, left: q.left + tol, width: q.width - 2 * tol }]), ...keeps.map((q) => ['keepout', q])]) { if (m.l < r.left + r.width && m.r > r.left && m.t < r.top + r.height && m.b > r.top) { hit = true; lastHit = { kind, l: Math.round(r.left), t: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height), box: [Math.round(m.l), Math.round(m.t), Math.round(m.r), Math.round(m.b)] }; break; } }
      c.object3D.visible = o.coverGuard ? !hit : true; const tNow = simT * 1000; if (!hit) hiddenSince = 0; else if (!hiddenSince) hiddenSince = tNow; else if (!busy && tNow - hiddenSince > 1200 && !stopped) { hiddenSince = 0; setTimeout(() => visit(false, true), 0); } if (hit) hiddenFrames++; else shownFrames++; state.hiddenFrames = hiddenFrames; state.shownFrames = shownFrames; };
    const timers = []; const sleep = (sec) => new Promise((res) => timers.push({ t: sec, res }));
    const SAFE = 10; // px: keep her feet this far inside the viewport bottom
    let simT = 0; const tick = (d) => { simT += d; for (let i = timers.length - 1; i >= 0; i--) { timers[i].t -= d; if (timers[i].t <= 0) timers.splice(i, 1)[0].res(); } c.update(d); if (c.pos.x < vw && c.pos.y > vh - SAFE) c.pos.y = vh - SAFE; };
    // rest spot in the right gutter: lowest y (from the bottom up) where her box touches no keep-out text and no card
    const restPoint = () => { const x = vw - c.halfW - 4, keeps = [...getKeepOutRects(), ...getCardRects()];
      for (let y = vh - SAFE; y >= charH + 10; y -= 12) { if (!keeps.some((r) => x - c.halfW < r.left + r.width && x + c.halfW > r.left && y - charH < r.top + r.height && y > r.top)) return { x, y }; }
      return { x, y: vh - SAFE }; };
    const parkOff = () => { c.pos.x = vw + c.halfW * 2; /* no eligible card: wait off-screen right, re-enter on the next scroll or resize */ };
    let stopped = false, busy = false, current = null, epoch = 0; const state = { visits: 0, lastError: null };
    const say = (s) => { if (o.onState) o.onState(s, state); };
    async function visit(first, force) {
      let sy0 = scrollY;
      if (stopped) return; if (busy && !force) return; if (force) { epoch++; Promise.resolve(c.stand()).catch(() => {}); } const my = ++epoch; busy = true; const dead = () => stopped || my !== epoch;
      try {
        reserve(); let r = pick(current); for (let w = 0; !r && w < 20 && !stopped; w++) { await sleep(0.75); reserve(); r = pick(current); if (!r && w === 2 && (c.pos.x >= vw || !c.object3D.visible) && o.restSpot !== false) { say('walking'); const rp = restPoint(); state.restWalk = await c.walkToPoint(rp.x, rp.y); if (dead()) return; await c.stand(); say('idle'); if (!state.restWalk || !state.restWalk.completed) parkOff(); } /* no card in view yet (scroll 0 on a phone): enter and wait in the right gutter instead of staying off-screen */ } if (dead()) return; if (!r) { if (c.pos.x < vw && o.restSpot !== false) { say('walking'); const rp = restPoint(); state.restWalk = await c.walkToPoint(rp.x, rp.y); if (dead()) return; await c.stand(); say('idle'); if (!state.restWalk || !state.restWalk.completed) parkOff(); /* no text-free route to the gutter: leave the screen instead of standing in text */ } else parkOff(); busy = false; return; } /* no card in view: wait in the right gutter, no teleport off-screen */ current = r.id; sy0 = scrollY; const side = sideFor(r);
        say('walking');
        if (first) await c.runTo(r.id, { side }); else await c.walkTo(r.id, { side });
        if (dead()) return;
        { reserve(); const rr = getCardRects().find((q) => q.id === r.id); if (!rr || !elig(rr)) { state.abandoned = (state.abandoned || 0) + 1; await c.stand(); if (dead()) return; parkOff(); say('idle'); setTimeout(() => { if (!busy) visit(false); }, 600); return; } } // layout moved the card out of reach while she walked: do not gesture at an unreachable card
        say('interacting');
        await c.lookAt(r.id, 1.2); if (dead()) return; await c.pointAt(r.id, 1.8); if (dead()) return; await c.wave(1.6); if (dead()) return;
        await c.leanOn(r.id, { side }); if (dead()) return; await sleep(2.5); if (dead()) return;
        await c.stand(); if (dead()) return; say('idle'); state.visits++;
      } catch (e) { state.lastError = String(e); } finally { if (my === epoch) { busy = false; if (Math.abs(scrollY - sy0) > 40 && !stopped) setTimeout(() => { if (!busy) visit(false); }, 800); /* page scrolled while she was busy: re-seat */ } }
    }
    reserve(); if (o.auto) setTimeout(() => { reserve(); visit(true); }, 0); // collection pages render their story cards after load; visit() waits up to 15 s for them
    let scrollT = null; if (o.auto) addEventListener('scroll', () => { clearTimeout(scrollT); scrollT = setTimeout(() => { if (!busy) setTimeout(() => visit(false), 600); }, 900); }, { passive: true });
    let rsT = null; addEventListener('resize', () => { clearTimeout(rsT); rsT = setTimeout(() => {
      vw = innerWidth; vh = innerHeight; renderer.setSize(vw, vh, false);
      cam.left = -vw / 2; cam.right = vw / 2; cam.top = vh / 2; cam.bottom = -vh / 2; cam.updateProjectionMatrix();
      c.setViewport(vw, vh); if (o.auto && !busy) setTimeout(() => visit(false), 400); c.setCharacterHeight(o.charHeight || (matchMedia('(max-width: 700px)').matches ? mobH() : Math.min(230, vh * 0.28))); reserve(); c.pos.x = vw - c.halfW - 4; /* re-enter in the right-hand gutter after a resize instead of walking across the card column */ c.pos.y = Math.min(Math.max(c.pos.y, charH + 4), vh - SAFE); }, 120); });
    let last = performance.now(), acc = 0; const step = mobile ? 1 / 30 : 0;
    function frame(now) {
      if (stopped) return; requestAnimationFrame(frame);
      if (document.hidden) { last = now; return; }
      const dt = Math.min((now - last) / 1000, 0.1); last = now; acc += dt;
      if (step && acc < step) return; const d = step ? acc : dt; acc = 0;
      tick(d); guard(); renderer.render(scene, cam);
    }
    requestAnimationFrame(frame);
    /** test hook: advance the simulation deterministically (60 fps steps) without waiting real time; promises settle between steps */
    const fastForward = async (sec) => { for (let i = 0; i < Math.round(sec * 60); i++) { tick(1 / 60); guard(); await Promise.resolve(); } renderer.render(scene, cam); };
    const debug = () => { const r = pick(current); return { busy, epoch, hiddenForMs: hiddenSince ? Math.round(simT * 1000 - hiddenSince) : 0, pick: r ? r.id : null, side: r ? sideFor(r) : null, cards: getCardRects().length, action: c.actionName, vis: c.object3D.visible, visits: state.visits, abandoned: state.abandoned || 0, lastError: state.lastError, hit: lastHit, pos: [Math.round(c.pos.x), Math.round(c.pos.y)], tgt: (() => { try { const t = r && c._resolve({ cardId: r.id, side: sideFor(r), along: 0.5 }); return t ? [Math.round(t.x), Math.round(t.y)] : null; } catch (e) { return String(e); } })(), rects: getCardRects().map((q) => [Math.round(q.left), Math.round(q.top), Math.round(q.width), Math.round(q.height), q.obstacleOnly ? 'obst' : '', sideFor(q) || 'noside']), need: Math.round(c.halfW * 2 + 8), card: r ? [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)] : null, halfW: Math.round(c.halfW), vw, vh, sy: Math.round(scrollY) }; };
    const bounds = () => { const bb = new THREE.Box3().setFromObject(c.object3D, true); if (bb.isEmpty()) return null; return { l: bb.min.x + vw / 2, r: bb.max.x + vw / 2, t: vh / 2 - bb.max.y, b: vh / 2 - bb.min.y }; };
    const api = { bounds, debug, reserve, controller: c, rig, canvas, state, fastForward, visit: () => visit(false), stop() { stopped = true; canvas.remove(); renderer.dispose(); } };
    window.__karmaStage = api; return api;
  } catch (e) { fail(e); return null; }
}
