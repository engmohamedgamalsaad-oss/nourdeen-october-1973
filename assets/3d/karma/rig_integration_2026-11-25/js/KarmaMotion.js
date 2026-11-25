// assets/3d/karma/rig_integration_2026-11-25/js/KarmaMotion.js
// Karma motion controller v2 (Instinct). Extends the gap-fix controller (claude_track_2026-11-25) which extends the PR #710 controller.
// Adds: run, look, point, turn, lean(dir) as named API; a command-conflict policy; breathing idle is inherited.
// Motion names: idle, walk, run, jump, wave, look, point, lean, turn, leanOn.  All motion is procedural bone rotation on the real skinned mesh.
// Conflict policy (tested in tests/motion.test.mjs):
//   * navigation commands (walkTo, runTo, leanOn, stand/idle) cancel everything queued and the running action ('preempted').
//   * actions (jump, wave, look, point, turn, lean) run one at a time; a new action waits in a queue of at most 3 (else resolves {completed:false, reason:'queue-full'}).
//   * look replaces a running/queued look (a newer gaze target wins). Two actions that use the same arm are never blended: they are serial.
//   * a card removed mid-action: look/point resolve with reason 'card-missing' and return to idle.
import * as THREE from 'three';
import { KarmaController as Base } from '../../claude_track_2026-11-25/js/KarmaController.js';

const clamp = THREE.MathUtils.clamp;
export const MOTIONS = ['idle', 'walk', 'run', 'jump', 'wave', 'look', 'point', 'lean', 'turn', 'leanOn'];
const MAX_QUEUE = 3;

export class KarmaMotion extends Base {
  constructor(o) { super(o); this._yawExtra = 0; this._yawTarget = 0; this._lastDt = 1 / 60; this.lookTarget = null; }

  // ---------- public API ----------
  idle() { return this.stand(); }
  runTo(cardId, { side = 'left', along = 0.5 } = {}) { return this._nav({ name: 'walk', run: true, cardId, side, along }); }
  _enter(cmd, ...r) { const o = super._enter(cmd, ...r); if (cmd && cmd.name === 'walk' && cmd.point && this.anchor) this.anchor.point = cmd.point; return o; }
  /** Walk to a free point (feet at x,y, canvas CSS px), detouring around cards; used for the resting spot when no card is in view (phone entry at scroll 0). */
  walkToPoint(x, y, { run = false } = {}) { return this._nav({ name: 'walk', run, cardId: undefined, side: 'free', along: 0.5, point: { x, y } }); }
  /** target: a card id, or {x,y} in canvas CSS px. Holds the gaze `seconds`, then returns. */
  lookAt(target, seconds = 1.8) { return this._act({ name: 'wave', kind: 'look', target, dur: seconds }); }
  /** Turn the body toward a card and extend the arm on that side toward it. */
  pointAt(cardId, seconds = 2.0) { return this._act({ name: 'wave', kind: 'point', cardId, dur: seconds }); }
  /** dir: 'left' | 'right' (screen sides) | 'front'. Rotates the whole body, holds, returns. */
  turn(dir = 'left', seconds = 1.2) { return this._act({ name: 'wave', kind: 'turn', dir, dur: seconds }); }
  /** body lean sideways without a card (alias of tilt with the same queue rules). */
  lean(dir = 'left', seconds = 1.4) { return this._act({ name: 'tilt', dir: dir === 'left' ? 1 : -1, dur: seconds }); }
  jump() { return this._act({ name: 'jump' }); }
  wave(seconds = 2.2) { return this._act({ name: 'wave', kind: 'wave', dur: seconds }); }
  tilt(dir = 'left', seconds = 1.4) { return this.lean(dir, seconds); }
  cancelActions() { for (const q of this.queue) this._finish(q, false, 'cancelled'); this.queue = []; }

  // ---------- conflict policy ----------
  _act(cmd) {
    if (cmd.kind === 'look') {
      const running = this.state.name === 'wave' && this.state.kind === 'look';
      if (running) { const p = this._mk(cmd); this._finish(this.state, false, 'replaced'); this._enter(cmd, this.state.resumeLean || null); return p; }
      const i = this.queue.findIndex((q) => q.kind === 'look');
      if (i >= 0) { this._finish(this.queue[i], false, 'replaced'); this.queue.splice(i, 1); }
    }
    if (this.queue.length >= MAX_QUEUE && !(this.state.name === 'idle' || this.state.name === 'lean')) {
      return Promise.resolve({ completed: false, reason: 'queue-full' });
    }
    return this._queue(cmd);
  }

  // ---------- run: the walk with a faster clock and a run pose ----------
  // ---------- walk path: go around cards instead of through them (README known gap 1) ----------
  /** True if the standing box (halfW wide, charH tall, feet at the point) at any sample on a->b overlaps a card. Samples near `tgt` ignore the target card
   *  (the stand/lean/perch endpoint is deliberately next to or on it). */
  _pathBlocked(a, b, tgt, cardId) {
    const hw = this.halfW * (this.pathBodyScale ?? 0.9), n = Math.max(2, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 6));
    const inside = (r, x, y) => x + hw > r.left + 0.5 && x - hw < r.left + r.width - 0.5 && y > r.top + 0.5 && y - this.charH < r.top + r.height - 0.5;
    const all = [...this.rects, ...(this._keep || []).map((k, ki) => ['@keep' + ki, k])];
    const esc = new Set(); for (const [id, r] of all) if (inside(r, a.x, a.y)) esc.add(id);   // a card that landed on her: she may walk out of it
    for (let i = 0; i <= n; i++) {
      const x = a.x + (b.x - a.x) * (i / n), y = a.y + (b.y - a.y) * (i / n), nearTgt = Math.hypot(x - tgt.x, y - tgt.y) < 0.8 * this.charH;
      for (const [id, r] of all) {
        if (nearTgt && id === cardId) continue;
        if (esc.has(id)) { if (inside(r, x, y)) continue; esc.delete(id); } // leaving the card she is already inside: exempt only until she is out of it
        if (x + hw > r.left + 0.5 && x - hw < r.left + r.width - 0.5 && y > r.top + 0.5 && y - this.charH < r.top + r.height - 0.5) return true;
      }
    }
    return false;
  }
  /** Next waypoint of a detour, or null when the straight line is clear (or no clear route exists: then she walks straight as before).
   *  The route is the shortest path over a visibility graph whose nodes are the start, the target and points just outside each card's corners. */
  _detourWp(s) {
    const a = this.anchor || s, tgt = this._resolve(a); if (!tgt) return null;
    const sig = [...this.rects].map(([i, r]) => i + ':' + Math.round(r.left) + ',' + Math.round(r.top) + ',' + Math.round(r.width) + ',' + Math.round(r.height)).join('|') + '@' + Math.round(this.vw);
    if (this._routeSig !== sig) { this._routeSig = sig; this._route = null; s._detours = 0; s._noRoute = false; } // layout moved or resized: plan again
    if (this._route && this._routeFor === s) {
      while (this._route.length && Math.hypot(this._route[0].x - this.pos.x, this._route[0].y - this.pos.y) <= 1.5) this._route.shift();
      if (this._route.length) return this._route[0];
      this._route = null;
    }
    if (!this._pathBlocked(this.pos, tgt, tgt, a.cardId)) return null;
    if ((s._detours = (s._detours || 0) + 1) > 4) { s._noRoute = true; return null; }
    const hw = this.halfW, m = 6, lo = hw, hi = Math.max(hw, this.vw - hw), clampX = (x) => Math.min(Math.max(x, lo), hi);
    const nodes = [{ x: this.pos.x, y: this.pos.y }, { x: tgt.x, y: tgt.y }];
    for (const r of [...this.rects.values(), ...(this._keep || [])]) {
      const xs = [clampX(r.left - hw * 0.9 - m), clampX(r.left + r.width + hw * 0.9 + m)];
      const ys = [r.top - m, Math.min(this.vh, r.top + r.height + this.charH + m)];
      for (const x of xs) for (const y of ys) nodes.push({ x, y });
    }
    const n = nodes.length, dist = new Array(n).fill(Infinity), prev = new Array(n).fill(-1), done = new Array(n).fill(false); dist[0] = 0;
    const d = (i, j) => Math.hypot(nodes[i].x - nodes[j].x, nodes[i].y - nodes[j].y);
    for (let it = 0; it < n; it++) {
      let u = -1; for (let i = 0; i < n; i++) if (!done[i] && (u < 0 || dist[i] < dist[u])) u = i;
      if (u < 0 || dist[u] === Infinity || u === 1) break; done[u] = true;
      for (let v = 1; v < n; v++) if (!done[v] && dist[u] + d(u, v) < dist[v] && !this._pathBlocked(nodes[u], nodes[v], tgt, a.cardId)) { dist[v] = dist[u] + d(u, v); prev[v] = u; }
    }
    if (dist[1] === Infinity) { s._noRoute = true; return null; } // no clear route: hold, never cross text
    const route = []; for (let v = 1; v > 0; v = prev[v]) route.unshift(nodes[v]);
    route.pop();                      // the last node is the real target: super handles the arrival
    if (!route.length) return null;
    this._route = route; this._routeFor = s; return route[0];
  }
  _updWalk(dt, T, s) {
    const wp = this._detourWp(s);
    if (s._noRoute && this.state === s) { this._yawTarget = 0; this._finish(s, false, 'no-route'); this._next(); this._poseIdle(T); return 0; }
    const pre = this.pos.clone(), k = s.run ? 2.3 : 1;
    const f = this._updWalkPose(dt, T, s);
    if (wp && this.state === s) {
      const dx = wp.x - pre.x, dy = wp.y - pre.y, dist = Math.hypot(dx, dy) || 1, step = Math.min(1.05 * this.charH * dt * k, dist);
      this.pos.set(pre.x + (dx / dist) * step, pre.y + (dy / dist) * step);
      return Math.sign(dx || 1) * (Math.abs(dx) > 4 ? 0.95 : 0);
    }
    return f;
  }
  _updWalkPose(dt, T, s) {
    if (!s.run) return super._updWalk(dt, T, s);
    const f = super._updWalk(dt * 2.3, T, s);
    const g = this.gait, sw = Math.sin(g);
    if (T.UpperLeg_L) {
      for (const k of ['UpperLeg_L', 'UpperLeg_R']) T[k] = [T[k][0] * 1.25, 0, 0];
      T.LowerLeg_L = [Math.max(0, Math.sin(g - 0.6)) * 1.5, 0, 0]; T.LowerLeg_R = [Math.max(0, Math.sin(g + Math.PI - 0.6)) * 1.5, 0, 0];
      T.UpperArm_L = [0.9 * sw, 0, 0.12]; T.UpperArm_R = [-0.9 * sw, 0, -0.12];
      T.Forearm_L = [-1.0 - 0.3 * sw, 0, 0]; T.Forearm_R = [-1.0 + 0.3 * sw, 0, 0];
      T.Chest = [0.2, -0.22 * sw, 0]; T.Spine = [0.08, 0, 0]; T.Head = [-0.12, 0.08 * sw, 0];
      this.jumpDY = Math.abs(Math.cos(g)) * 0.04 * this.charH;
    }
    return f;
  }

  // ---------- look / point / turn ride on the 'wave' state (kind field) ----------
  _updWave(dt, T, s) {
    const kind = s.kind || 'wave';
    if (kind === 'wave') { this._yawTarget = 0; return super._updWave(dt, T, s); }
    if (this.t >= s.dur) { this._yawTarget = 0; this._finish(s, true); this._next(); this._poseIdle(T); return; }
    const e = Math.min(1, Math.min(this.t, s.dur - this.t) / 0.35); // ease in/out
    this._poseIdle(T);
    if (kind === 'turn') { this._yawTarget = (s.dir === 'right' ? 1.15 : s.dir === 'left' ? -1.15 : 0) * e; T.Head = [0, (s.dir === 'right' ? 0.15 : s.dir === 'left' ? -0.15 : 0) * e, 0]; return; }
    // look / point need a target point in canvas px
    let tx, ty;
    if (typeof (s.target ?? s.cardId) === 'string') {
      const r = this.rects.get(s.target ?? s.cardId);
      if (!r) { this._yawTarget = 0; this._finish(s, false, 'card-missing'); this._next(); return; }
      tx = r.left + r.width / 2; ty = r.top + r.height / 2;
    } else { tx = s.target.x; ty = s.target.y; }
    const dx = tx - this.pos.x, headY = this.pos.y - 0.88 * this.charH;
    const yaw = clamp(dx / (this.charH * 2.2), -1, 1) * 0.85;           // + = toward screen right (+X)
    const pitch = clamp((ty - headY) / (this.charH * 2), -1, 1) * 0.5;   // + = nod down, - = look up
    if (kind === 'look') {
      T.Neck = [pitch * 0.35 * e, yaw * 0.35 * e, 0]; T.Head = [pitch * 0.6 * e, yaw * 0.6 * e, 0]; T.Chest = [0, yaw * 0.12 * e, 0];
    } else { // point
      const sg = dx >= 0 ? 1 : -1; const near = sg > 0 ? 'L' : 'R';
      this._yawTarget = sg * 0.55 * e;
      const lift = clamp(-(ty - (this.pos.y - 0.7 * this.charH)) / (this.charH * 1.2), -0.5, 0.8); // card above shoulder: raise more
      T['UpperArm_' + near] = [0, 0, sg * (1.25 + 0.45 * lift) * e]; T['Forearm_' + near] = [0, 0, sg * 0.1 * e]; T['Hand_' + near] = [0, 0, sg * 0.05 * e];
      T.Head = [pitch * 0.5 * e, sg * 0.25 * e, 0]; T.Neck = [0, sg * 0.1 * e, 0]; T.Chest = [0, sg * 0.1 * e, 0];
    }
  }
  _updTilt(dt, T, s) { this._yawTarget = 0; return super._updTilt(dt, T, s); }

  // body yaw offset for turn/point, smoothed; applied on top of the controller's own facing
  update(dt) {
    this._lastDt = Math.min(Math.max(dt, 0), 0.05);
    const n = this.state.name, k = this.state.kind;
    if (!(n === 'wave' && (k === 'turn' || k === 'point'))) this._yawTarget = 0;
    super.update(dt);
  }
  /** Lean contact: the stock lean stands 0.1*charH from the card edge, which put the near hand about 0.25*charH INSIDE the card face
   *  (measured by tests/contact_probe.py). Stand `leanReach` further out so the hand tip rests on the card edge instead of covering the card. */
  _resolve(a) {
    if (a && a.point) { const hw = this.halfW; return { x: Math.min(Math.max(a.point.x, hw), Math.max(hw, this.vw - hw)), y: Math.min(a.point.y, this.vh), side: 'free' }; }
    let t = super._resolve(a);
    if (t) {
      let u = this._clearSpot(t, a, true);
      if (!u && a && (a.side === 'left' || a.side === 'right')) {            // requested side is filled by a neighbour: try the opposite side of the same card
        const alt = super._resolve({ ...a, side: a.side === 'left' ? 'right' : 'left' });
        if (alt) u = this._clearSpot(alt, { ...a, side: alt.side }, true);
      }
      t = u || this._clearSpot(t, a, false);
    }
    if (t && a && a.lean && t.side && t.side !== 'top') t.x += (t.side === 'right' ? 1 : -1) * (this.leanReach ?? 0.24) * this.charH;
    return t;
  }
  /** Standing spot must not put her body inside ANOTHER card (the base only checks the target card). Move to the nearest clear x;
   *  when none exists return null so the walk is refused ('no-clear-placement' reason) instead of ending inside text. */
  _clearSpot(t, a, strict) {
    const hw = this.halfW, r0 = this.rects.get(a.cardId);
    const bad = (x) => {
      for (const [id, r] of this.rects) {
        if (id === a.cardId) continue;
        if (x + hw > r.left + 0.5 && x - hw < r.left + r.width - 0.5 && t.y > r.top + 0.5 && t.y - this.charH < r.top + r.height - 0.5) return true;
      }
      if (r0 && t.side !== 'top' && this._overlapsCard({ ...t, x }, r0, a.lean)) return true;
      return false;
    };
    if (!bad(t.x)) return t;
    return strict ? null : this._slide(t, a, bad);
  }
  _slide(t, a, bad) {
    const hw = this.halfW;
    if (t.side === 'top') return null;
    const lo = hw, hi = Math.max(hw, this.vw - hw), c = [];
    for (const r of this.rects.values()) c.push(r.left - hw - 1, r.left + r.width + hw + 1);
    c.sort((p, q) => Math.abs(p - t.x) - Math.abs(q - t.x));
    for (const x of c) if (x >= lo && x <= hi && !bad(x)) return { ...t, x };
    return null;
  }
  /** Precise refusal: the card exists but there is no clear place to stand (neighbour cards / text fill every candidate). */
  _finish(cmd, completed, reason) {
    if (!completed && reason === 'card-missing' && cmd && cmd.cardId !== undefined && this.rects.has(cmd.cardId)) reason = 'no-clear-placement';
    return super._finish(cmd, completed, reason);
  }
  /** Lean relocation is never a slide across text: when the lean spot flips side or the straight move to it is blocked, re-walk (the walk detours or holds). */
  _updLean(dt, T, s) {
    const req = s.reqSide === undefined ? s.side : s.reqSide;
    const t = this._resolve({ cardId: s.cardId, side: req, along: 0.5, lean: true });
    if (t && t.side !== 'top' && Math.hypot(t.x - this.pos.x, t.y - this.pos.y) > 2 && (t.side !== s.side || this._pathBlocked(this.pos, t, t, s.cardId))) {
      this._enter({ name: 'walk', cardId: s.cardId, side: req, along: 0.5, thenLean: true, resolve: null }); this._poseIdle(T); return 0;
    }
    return super._updLean(dt, T, s);
  }
  /** Honest name of what she is doing now (stateName is the base controller's internal state: look/point/turn ride on 'wave', run on 'walk'). */
  get actionName() {
    const s = this.state; if (!s) return 'idle'; const n = s.name || this.stateName;
    if (n === 'walk') return s.run ? 'run' : 'walk';
    if (n === 'wave') return s.kind || 'wave';
    if (n === 'tilt') return 'lean';
    if (n === 'lean') return 'lean_on_card';
    return n;
  }
  _syncHolder(snap = false) {
    // The base constructor calls _syncHolder before this subclass's fields exist: without these guards holder.rotation.y was NaN
    // until the first update() (found by the shared rig suite, tests 3 and 5 to 13).
    const ye = this._yawExtra || 0, yt = this._yawTarget || 0;
    this._yawExtra = ye + (yt - ye) * (1 - Math.exp(-9 * (this._lastDt || 1 / 60)));
    super._syncHolder(snap);
    this.holder.rotation.y = this.facing + this._yawExtra;
  }
}
export { KarmaMotion as KarmaController };
