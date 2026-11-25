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
  _updWalk(dt, T, s) {
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
    const t = super._resolve(a);
    if (t && a && a.lean && t.side && t.side !== 'top') t.x += (t.side === 'right' ? 1 : -1) * (this.leanReach ?? 0.24) * this.charH;
    return t;
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
