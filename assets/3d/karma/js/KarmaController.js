// assets/3d/karma/js/KarmaController.js
// State-machine controller that moves the Karma rig between real card rectangles.
// World units = CSS pixels of the canvas (orthographic camera: left=-w/2, right=w/2, top=h/2, bottom=-h/2).
// Rig convention: faces +Z, Karma's left = +X, origin at the soles. Authored rest rotations are preserved; pose values are local deltas.
// STATUS: recovered from the first Claude's session log. UNTESTED - never executed against a real GLB.
import * as THREE from 'three';

const D2R = Math.PI / 180;
const E = new THREE.Euler();
const Q = new THREE.Quaternion();
const DELTA = new THREE.Quaternion();

export class KarmaController {
  /**
   * @param {object} o
   * @param {{scene:THREE.Object3D,bones:Object<string,THREE.Object3D>}} o.rig  from KarmaRig.js
   * @param {() => Array<{id:string,left:number,top:number,width:number,height:number}>} o.getCardRects  CSS px relative to the canvas, called every frame
   * @param {{width:number,height:number}} o.viewport  canvas size in CSS px
   * @param {number} [o.characterHeightPx=170]
   * @param {number} [o.modelHeight=1]  model height in metres (body only ~1.0)
   */
  constructor({ rig, getCardRects, viewport, characterHeightPx = 170, modelHeight = 1 }) {
    this.rig = rig; this.getCardRects = getCardRects;
    // Cache authored local rest rotations. Animation targets are local deltas,
    // not absolute rotations; this keeps non-identity exported rigs intact.
    this.restQuaternions = Object.fromEntries(
      Object.entries(rig.bones).map(([name, bone]) => [name, bone.quaternion.clone()])
    );
    this.holder = new THREE.Group(); this.holder.name = 'KarmaHolder'; this.holder.add(rig.scene);
    this.modelHeight = modelHeight; this.charH = characterHeightPx;
    this.vw = viewport.width; this.vh = viewport.height;
    this.rects = new Map();
    this.state = { name: 'idle' }; this.t = 0; this.time = 0; this.queue = [];
    this.gait = 0; this.facing = 0; this.pose = {}; this.jumpDY = 0; this.anchor = null;
    this._applyScale();
    this.pos = new THREE.Vector2(this.vw / 2, this.vh); // CSS px (y down) of the feet, starts at the bottom centre
    this._syncHolder(true);
  }

  // ---------- public API ----------
  get object3D() { return this.holder; }
  get stateName() { return this.state.name; }

  setViewport(width, height) {
    this.vw = width; this.vh = height; this._applyScale();
    this.pos.x = THREE.MathUtils.clamp(this.pos.x, this.halfW, Math.max(this.halfW, this.vw - this.halfW));
    this.pos.y = Math.min(this.pos.y, this.vh);
    this._refreshRects(); if (this.anchor) this._reanchor(true);
  }
  setCharacterHeight(px) { this.charH = px; this._applyScale(); }

  /** Walk to a card. side: 'top' (stand on it, `along` 0..1), 'left' or 'right' (stand beside it). Preempts walking/leaning. */
  walkTo(cardId, { side = 'top', along = 0.5 } = {}) { return this._nav({ name: 'walk', cardId, side, along }); }
  /** Walk next to a card and lean on it until another command arrives. side = which side of the card to stand on. */
  leanOn(cardId, { side = 'left' } = {}) { return this._nav({ name: 'walk', cardId, side, along: 0.5, thenLean: true }); }
  /** Cancel everything and return to the neutral idle pose where she stands. */
  stand() { return this._nav({ name: 'idle' }); }
  jump() { return this._queue({ name: 'jump' }); }
  wave(seconds = 2.2) { return this._queue({ name: 'wave', dur: seconds }); }
  tilt(dir = 'left', seconds = 1.4) { return this._queue({ name: 'tilt', dir: dir === 'left' ? 1 : -1, dur: seconds }); }

  // ---------- internals: commands ----------
  _mk(cmd) { return new Promise((resolve) => { cmd.resolve = resolve; cmd._p = true; }); }
  _finish(cmd, completed, reason) { if (cmd && cmd.resolve) { cmd.resolve({ completed, reason }); cmd.resolve = null; } }
  _nav(cmd) {
    const p = this._mk(cmd);
    for (const q of this.queue) this._finish(q, false, 'preempted'); this.queue = [];
    this._finish(this.state, false, 'preempted');
    this._enter(cmd); return p;
  }
  _queue(cmd) {
    const p = this._mk(cmd);
    if (this.state.name === 'idle' || this.state.name === 'lean') { const prev = this.state; this._enter(cmd, prev.name === 'lean' ? prev : null); }
    else this.queue.push(cmd);
    return p;
  }
  _enter(cmd, resumeLean = null) {
    this.state = cmd; this.t = 0; cmd.resumeLean = resumeLean;
    if (cmd.name === 'walk') this.anchor = { cardId: cmd.cardId, side: cmd.side, along: cmd.along, lean: !!cmd.thenLean };
    if (cmd.name === 'idle') this.anchor = null;
  }
  _next() {
    const prev = this.state; const resume = prev.resumeLean;
    const n = this.queue.shift();
    if (n) { this._enter(n, resume); return; }
    if (resume) { this.state = resume; this.t = 0; } else this._enter({ name: 'idle' });
  }

  // ---------- internals: geometry ----------
  _applyScale() { this.scale = this.charH / this.modelHeight; this.halfW = 0.3 * this.charH; this.holder.scale.setScalar(this.scale); }
  _refreshRects() { this.rects.clear(); for (const r of this.getCardRects() || []) this.rects.set(r.id, r); }
  /** returns feet target in CSS px (y down) or null if the card no longer exists */
  _resolve(a) {
    const r = this.rects.get(a.cardId); if (!r) return null;
    const m = 6; let x, y;
    if (a.side === 'top') { x = r.left + THREE.MathUtils.clamp(a.along, 0.05, 0.95) * r.width; y = r.top; }
    else {
      const gap = a.lean ? 0.1 * this.charH : this.halfW + m;
      x = a.side === 'left' ? r.left - gap : r.left + r.width + gap; y = r.top + r.height;
    }
    x = THREE.MathUtils.clamp(x, this.halfW, Math.max(this.halfW, this.vw - this.halfW));
    return { x, y: Math.min(y, this.vh + 2) };
  }
  _reanchor() { /* picked up on the next update */ }
  _syncHolder(snap = false) {
    this.holder.position.set(this.pos.x - this.vw / 2, this.vh / 2 - (this.pos.y) + this.jumpDY, 0);
    this.holder.rotation.y = this.facing;
  }

  // ---------- frame update ----------
  update(dt) {
    dt = Math.min(Math.max(dt, 0), 0.05); this.time += dt; this.t += dt;
    this._refreshRects();
    const T = {}; // target pose, bone -> [x,y,z] radians
    const s = this.state; let faceTo = 0; this.jumpDY = 0;
    const idlePose = () => this._poseIdle(T);
    if (s.name === 'idle') { idlePose(); faceTo = 0; }
    else if (s.name === 'walk') faceTo = this._updWalk(dt, T, s);
    else if (s.name === 'lean') faceTo = this._updLean(dt, T, s);
    else if (s.name === 'jump') this._updJump(dt, T, s);
    else if (s.name === 'wave') this._updWave(dt, T, s);
    else if (s.name === 'tilt') this._updTilt(dt, T, s);
    // facing + pose blending
    this.facing += (faceTo - this.facing) * (1 - Math.exp(-9 * dt));
    this._blend(T, dt);
    // stand() is a cancellable navigation command. Resolve it after the
    // neutral pose has had time to blend in instead of leaving its Promise pending.
    if (s.name === 'idle' && s.resolve && this.t >= 0.25) this._finish(s, true);
    this._syncHolder();
  }

  _poseIdle(T) {
    const b = Math.sin(this.time * 1.9);
    T.Chest = [0.012 * b, 0, 0]; T.Head = [-0.01 * b, 0.05 * Math.sin(this.time * 0.7), 0];
    T.UpperArm_L = [0, 0, 0.03 * b]; T.UpperArm_R = [0, 0, -0.03 * b];
  }

  _updWalk(dt, T, s) {
    const tgt = this._resolve(this.anchor || s);
    if (!tgt) { this._finish(s, false, 'card-missing'); this._enter({ name: 'idle' }); this._poseIdle(T); return 0; }
    const dx = tgt.x - this.pos.x, dy = tgt.y - this.pos.y, dist = Math.hypot(dx, dy);
    const speed = 1.05 * this.charH; // px per second
    const step = speed * dt;
    if (dist <= Math.max(step, 1.5)) {
      this.pos.set(tgt.x, tgt.y);
      this._finish(s, true);
      if (s.thenLean) { this.state = { name: 'lean', side: s.side, cardId: s.cardId, resume: null }; this.t = 0; }
      else this._next();
      this._poseIdle(T); return 0;
    }
    this.pos.x += (dx / dist) * step; this.pos.y += (dy / dist) * step;
    this.gait += dt * 2 * Math.PI * 1.8; const g = this.gait, A = 0.55;
    const swing = Math.sin(g);
    T.UpperLeg_L = [-A * swing, 0, 0]; T.UpperLeg_R = [A * swing, 0, 0];
    T.LowerLeg_L = [Math.max(0, Math.sin(g - 0.9)) * 0.7, 0, 0]; T.LowerLeg_R = [Math.max(0, Math.sin(g + Math.PI - 0.9)) * 0.7, 0, 0];
    T.Foot_L = [-(T.UpperLeg_L[0] + T.LowerLeg_L[0]) * 0.8, 0, 0]; T.Foot_R = [-(T.UpperLeg_R[0] + T.LowerLeg_R[0]) * 0.8, 0, 0];
    T.UpperArm_L = [0.5 * swing, 0, 0.05]; T.UpperArm_R = [-0.5 * swing, 0, -0.05];
    T.Forearm_L = [-0.2 - 0.15 * swing, 0, 0]; T.Forearm_R = [-0.2 + 0.15 * swing, 0, 0];
    T.Hips = [0, 0.12 * swing, 0]; T.Chest = [0.03, -0.18 * swing, 0]; T.Head = [0, 0.1 * swing, 0];
    this.jumpDY = Math.abs(Math.cos(g)) * 0.018 * this.charH;
    return Math.sign(dx || 1) * (Math.abs(dx) > 4 ? 0.95 : 0);
  }

  _updLean(dt, T, s) {
    const tgt = this._resolve({ cardId: s.cardId, side: s.side, along: .5, lean: true });
    if (!tgt) { this._enter({ name: 'idle' }); this._poseIdle(T); return 0; }
    const dx = tgt.x - this.pos.x, dy = tgt.y - this.pos.y;
    if (Math.hypot(dx, dy) > 0.45 * this.charH) { // card moved far: walk to the new place, then lean again
      this._enter({ name: 'walk', cardId: s.cardId, side: s.side, along: .5, thenLean: true, resolve: null }); this._poseIdle(T); return 0;
    }
    const k = 1 - Math.exp(-6 * dt); this.pos.x += dx * k; this.pos.y += dy * k; // follow small drifts smoothly
    const sg = s.side === 'left' ? 1 : -1; // card is on +X when we stand on its left side
    const b = Math.sin(this.time * 1.6) * 0.01;
    T.Hips = [0, 0, -sg * 0.05]; T.Spine = [0, 0, -sg * (0.13 + b)]; T.Chest = [0, 0, -sg * 0.1]; T.Neck = [0, 0, sg * 0.07];
    T.Head = [0, sg * 0.15, sg * 0.05];
    const near = sg > 0 ? 'L' : 'R', far = sg > 0 ? 'R' : 'L';
    T['UpperArm_' + near] = [-0.2, 0, sg * 0.55]; T['Forearm_' + near] = [-0.5, 0, sg * 0.5];
    T['UpperArm_' + far] = [0.05, 0, -sg * 0.1];
    T.UpperLeg_L = [0, 0, -sg * 0.04]; T.UpperLeg_R = [0, 0, -sg * 0.04];
    return sg * 0.35; // turn slightly toward the card
  }

  _updJump(dt, T, s) {
    const cr = 0.2, air = 0.55, lnd = 0.22, H = 0.3 * this.charH;
    let crouch = 0, arms = 0;
    if (this.t < cr) { crouch = this.t / cr; this.jumpDY = -0.07 * this.charH * crouch; }
    else if (this.t < cr + air) { const u = (this.t - cr) / air; this.jumpDY = H * 4 * u * (1 - u); arms = Math.sin(Math.min(u * 1.5, 1) * Math.PI / 2); crouch = Math.max(0, 0.35 - u); }
    else if (this.t < cr + air + lnd) { const u = (this.t - cr - air) / lnd; crouch = 1 - u; this.jumpDY = -0.07 * this.charH * crouch; arms = 0.2 * (1 - u); }
    else { this._finish(s, true); this._next(); this._poseIdle(T); return; }
    const kn = crouch * 1.0;
    T.UpperLeg_L = [-0.8 * kn, 0, 0]; T.UpperLeg_R = [-0.8 * kn, 0, 0]; T.LowerLeg_L = [1.3 * kn, 0, 0]; T.LowerLeg_R = [1.3 * kn, 0, 0];
    T.Foot_L = [-0.5 * kn, 0, 0]; T.Foot_R = [-0.5 * kn, 0, 0]; T.Chest = [0.15 * crouch, 0, 0];
    T.UpperArm_L = [0, 0, 1.6 * arms]; T.UpperArm_R = [0, 0, -1.6 * arms];
  }

  _updWave(dt, T, s) {
    if (this.t >= s.dur) { this._finish(s, true); this._next(); this._poseIdle(T); return; }
    const e = Math.min(1, Math.min(this.t, s.dur - this.t) / 0.3); // ease in/out
    const w = Math.sin(this.t * 11);
    this._poseIdle(T);
    T.UpperArm_R = [0, 0, -1.95 * e]; T.Forearm_R = [0, 0, -(0.45 + 0.4 * w) * e];
    T.Hand_R = [0, 0, -0.15 * w * e]; T.Head = [0, 0, 0.1 * e]; T.Chest = [0, 0, 0.04 * e];
  }

  _updTilt(dt, T, s) {
    if (this.t >= s.dur) { this._finish(s, true); this._next(); this._poseIdle(T); return; }
    const e = Math.sin(Math.min(this.t / s.dur, 1) * Math.PI); // 0 -> 1 -> 0
    T.Spine = [0, 0, -s.dir * 0.18 * e]; T.Chest = [0, 0, -s.dir * 0.12 * e]; T.Neck = [0, 0, s.dir * 0.1 * e]; T.Head = [0, 0, s.dir * 0.12 * e];
    T.Hips = [0, 0, s.dir * 0.05 * e];
  }

  _blend(T, dt) {
    const k = 1 - Math.exp(-16 * dt);
    for (const name in this.rig.bones) {
      const bone = this.rig.bones[name];
      const rest = this.restQuaternions[name] || bone.quaternion;
      const t = T[name];
      if (t) {
        E.set(t[0], t[1], t[2], 'XYZ');
        DELTA.setFromEuler(E);
        Q.copy(rest).multiply(DELTA);
      } else {
        Q.copy(rest);
      }
      bone.quaternion.slerp(Q, k);
    }
  }
}
