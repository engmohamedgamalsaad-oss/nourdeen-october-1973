// assets/3d/karma/claude_track_2026-11-25/js/KarmaController.js
// Gap fixes on top of the PR #710 controller (KarmaController.v710.js, verbatim). Nothing in the canonical js/ folder or in PR #710 is edited.
//   GAP 1  walkTo(card,{side:'top'}) keeps following that card after arrival (`perch`), re-walks if it jumps far, drops to the ground if it is removed.
//   GAP 2  side placement near screen edges: if the requested side overlaps the card after viewport clamping, use the other side; if both overlap, stand on top.
//   GAP 3  keep-out rectangles for text: setKeepOutRects(rects) and/or constructor option getKeepOutRects() (called every frame). Standing position slides horizontally out of them.
// Public API of #710 is unchanged. With no edge case and no keep-out rects the behaviour is identical to #710 (tested).
import { KarmaController as Base } from './KarmaController.v710.js';

export class KarmaController extends Base {
  constructor(o) {
    super(o);
    this._keepFn = o.getKeepOutRects || null; this._keepStatic = []; this._keep = [];
    this.perch = null; this._falling = false;
  }
  /** rects: Array<{left,top,width,height}> in canvas CSS px (same space as card rects). Pass [] to clear. */
  setKeepOutRects(rects) { this._keepStatic = Array.isArray(rects) ? rects.map((r) => ({ ...r })) : []; }
  stand() { this.perch = null; this._falling = false; return super.stand(); }
  _enter(cmd, resumeLean = null) { if (cmd.name === 'walk') { this.perch = null; this._falling = false; } super._enter(cmd, resumeLean); }
  _finish(cmd, completed, reason) {
    if (cmd && cmd.resolve && cmd.name === 'walk' && completed && !cmd.thenLean && cmd.side === 'top') this.perch = { cardId: cmd.cardId, along: cmd.along };
    super._finish(cmd, completed, reason);
  }
  _refreshRects() { super._refreshRects(); const dyn = this._keepFn ? (this._keepFn() || []) : []; this._keep = [...this._keepStatic, ...dyn]; }

  update(dt) {
    const s = this.state.name; const d = Math.min(Math.max(dt, 0), 0.05);
    if (this.perch && s !== 'walk' && s !== 'lean') this._followPerch(d);
    else if (this._falling && s === 'idle') {
      this.pos.y += (this.vh - this.pos.y) * (1 - Math.exp(-8 * d));
      if (this.vh - this.pos.y < 0.5) { this.pos.y = this.vh; this._falling = false; }
    }
    else if (this._keep.length && (s === 'idle' || s === 'jump' || s === 'wave' || s === 'tilt')) this._dodgeKeepOut(d);
    super.update(dt);
  }
  // free-standing (no perch): text that moves into her pushes her sideways, never into a card or out of the viewport
  _dodgeKeepOut(d) {
    this._refreshRects();
    const t = this._applyKeepOut({ x: this.pos.x, y: this.pos.y, side: 'free' }, null, false);
    const dx = t.x - this.pos.x;
    if (Math.abs(dx) > 0.01) this.pos.x = Math.abs(dx) < 0.5 ? t.x : this.pos.x + dx * (1 - Math.exp(-10 * d));
  }
  _followPerch(d) {
    this._refreshRects();
    const tgt = this._resolve({ cardId: this.perch.cardId, side: 'top', along: this.perch.along });
    if (!tgt) { this.perch = null; this._falling = true; return; }
    const dx = tgt.x - this.pos.x, dy = tgt.y - this.pos.y;
    if (Math.hypot(dx, dy) > 0.45 * this.charH) { const { cardId, along } = this.perch; this.walkTo(cardId, { side: 'top', along }); return; }
    const k = 1 - Math.exp(-8 * d); this.pos.x += dx * k; this.pos.y += dy * k;
  }

  _overlapsCard(t, r, lean) {
    if (lean) return t.x > r.left && t.x < r.left + r.width;                      // leaning: her centre must stay off the card
    return t.x + this.halfW > r.left + 0.5 && t.x - this.halfW < r.left + r.width - 0.5; // standing: body box must stay off the card
  }
  _resolve(a) {
    const r = this.rects.get(a.cardId); if (!r) return null;
    let out;
    if (a.side === 'top') out = { ...super._resolve(a), side: 'top' };
    else {
      const other = a.side === 'left' ? 'right' : 'left';
      for (const sd of [a.side, other]) { const t = super._resolve({ ...a, side: sd }); if (!this._overlapsCard(t, r, a.lean)) { out = { ...t, side: sd }; break; } }
      if (!out) out = { ...super._resolve({ ...a, side: 'top', along: 0.5 }), side: 'top' }; // both sides blocked: stand on top
    }
    return this._applyKeepOut(out, r, a.lean);
  }
  _applyKeepOut(t, r, lean) {
    if (!this._keep.length) return t;
    const hw = this.halfW, top = t.y - this.charH, lo = hw, hi = Math.max(hw, this.vw - hw);
    const blocked = [];
    for (const b of this._keep) if (b.top < t.y && b.top + b.height > top) blocked.push([b.left - hw - 0.5, b.left + b.width + hw + 0.5]);
    // standing beside a card: the card itself is also off-limits, otherwise sliding away from text could push her into the card
    if (t.side === 'free') { for (const k of this.rects.values()) if (k.top < t.y && k.top + k.height > top) blocked.push([k.left - hw + 0.5, k.left + k.width + hw - 0.5]); }
    else if (t.side !== 'top') blocked.push(lean ? [r.left, r.left + r.width] : [r.left - hw + 0.5, r.left + r.width + hw - 0.5]);
    const inside = (x) => blocked.some(([l, h]) => x > l + 0.01 && x < h - 0.01);
    if (!inside(t.x)) return t;
    let min = lo, max = hi;
    if (t.side === 'top') { min = Math.max(lo, r.left + 0.05 * r.width); max = Math.min(hi, r.left + 0.95 * r.width); }
    const cands = blocked.flatMap(([l, h]) => [l, h]).filter((x) => x >= min && x <= max && !inside(x));
    if (!cands.length) return t; // cannot be satisfied (text spans the whole usable width): stay put
    cands.sort((p, q) => Math.abs(p - t.x) - Math.abs(q - t.x));
    return { ...t, x: cands[0] };
  }
  _updLean(dt, T, s) {
    if (s.reqSide === undefined) s.reqSide = s.side;
    const t = this._resolve({ cardId: s.cardId, side: s.reqSide, along: 0.5, lean: true });
    if (t && t.side !== 'top') s.side = t.side;
    return super._updLean(dt, T, s);
  }
}
