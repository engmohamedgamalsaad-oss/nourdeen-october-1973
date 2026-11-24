import { buildKarma } from './karmaRig';

type Rect = { l: number; t: number; r: number; b: number; id: number };
export type Controls = { left: boolean; right: boolean; jump: boolean; auto: boolean };

const SC = 95;            // px per model unit
const HW = 16, BH = 104;  // collision half width, body height (px)
const GRAV = 2300, JUMP = 1000, SPEED = 210;

const CLOSE = Number(new URLSearchParams(location.search).get('close') || 0);
export function startKarma(stage: HTMLElement, canvas: HTMLCanvasElement, controls: Controls, onState: (s: string) => void) {
    const { THREE, root, joints: J } = buildKarma();
    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    const scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight(0xffffff, 0xb9a48c, 1.55));
    const sun = new THREE.DirectionalLight(0xffffff, 1.5); sun.position.set(-300, 500, 700); scene.add(sun);
    const holder = new THREE.Group(); holder.add(root); holder.scale.setScalar(SC); scene.add(holder);
    const shadow = new THREE.Mesh(new THREE.CircleGeometry(1, 24), new THREE.MeshBasicMaterial({ color: 0x1b2a3a, transparent: true, opacity: 0.25, depthWrite: false }));
    scene.add(shadow);
    const camera = new THREE.PerspectiveCamera(30, 1, 10, 6000);
    let W = 1, H = 1;
    const resize = () => {
        W = stage.clientWidth; H = stage.clientHeight;
        renderer.setSize(W, H, false);
        camera.aspect = W / H; camera.fov = 30;
        const dist = (H / 2) / Math.tan((15 * Math.PI) / 180);
        camera.position.set(W / 2, -H / 2, dist); camera.lookAt(W / 2, -H / 2, 0);
        camera.updateProjectionMatrix();
    };
    resize();
    const ro = new ResizeObserver(resize); ro.observe(stage);

    const st = { x: 0, y: 0, vx: 0, vy: 0, ground: false, wall: 0, on: -1, face: 0, dirLast: 1, ph: 0, squash: 0, init: false };
    const pig = { L: [0, 0], R: [0, 0], f: [0, 0] };
    const pose: Record<string, number> = {};
    const ai = { phase: 'go', target: -1, t: 0, lean: 0, total: 0 };
    let solids: Rect[] = [];
    let floorY = 0;
    let state = 'idle';
    let last = performance.now(), raf = 0, stopped = false;
    let prevJump = false;

    const measure = () => {
        const sr = stage.getBoundingClientRect();
        solids = [];
        stage.querySelectorAll<HTMLElement>('[data-solid]').forEach((el, i) => {
            const r = el.getBoundingClientRect();
            if (r.width < 8) return;
            solids.push({ l: r.left - sr.left, r: r.right - sr.left, t: r.top - sr.top, b: r.bottom - sr.top, id: i });
        });
        const f = stage.querySelector<HTMLElement>('[data-floor]');
        floorY = f ? f.getBoundingClientRect().top - sr.top : H - 30;
        solids.push({ l: -50, r: W + 50, t: floorY, b: H + 200, id: 999 });
        solids.push({ l: -60, r: 0, t: -500, b: H + 200, id: 998 });
        solids.push({ l: W, r: W + 60, t: -500, b: H + 200, id: 997 });
    };
    const ov = (a: Rect, x: number, y: number) => x + HW > a.l && x - HW < a.r && y > a.t && y - BH < a.b;
    const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
    const lerpAng = (a: number, b: number, k: number) => a + (b - a) * k;

    const autoInput = (dt: number) => {
        const cards = solids.filter((s) => s.id < 900);
        let dir = 0, jump = false;
        if (!cards.length) return { dir, jump };
        if (ai.target < 0 || ai.target >= cards.length) { ai.target = Math.floor(Math.random() * cards.length); ai.phase = 'go'; ai.total = 0; }
        const c = cards[ai.target];
        ai.total += dt;
        if (ai.phase === 'go') {
            const dx = (c.l + c.r) / 2 - st.x;
            const atTop = st.ground && st.on === c.id;
            if (atTop && Math.abs(dx) < 10) { ai.phase = 'wave'; ai.t = 2.6; }
            else {
                dir = Math.abs(dx) < 6 ? 0 : Math.sign(dx);
                if (st.ground && st.wall !== 0 && st.wall === dir) {
                    ai.lean += dt;
                    dir = st.wall;
                    if (ai.lean > 0.55) { jump = true; ai.lean = 0; }
                } else ai.lean = 0;
                if (ai.total > 14) { ai.target = -1; }
            }
        } else if (ai.phase === 'wave') {
            ai.t -= dt;
            if (ai.t <= 0) {
                let n = Math.floor(Math.random() * cards.length);
                if (n === ai.target) n = (n + 1) % cards.length;
                ai.target = n; ai.phase = 'go'; ai.total = 0;
            }
        }
        return { dir, jump };
    };

    const step = (dt: number) => {
        if (!st.init) { st.x = Math.min(60, W / 2); st.y = floorY; st.init = true; }
        let dir = 0, jump = false;
        if (controls.auto) { const a = autoInput(dt); dir = a.dir; jump = a.jump; }
        else { dir = (controls.right ? 1 : 0) - (controls.left ? 1 : 0); jump = controls.jump && !prevJump; ai.phase = 'go'; }
        prevJump = controls.jump;
        const waving = controls.auto && ai.phase === 'wave';
        const target = dir * SPEED;
        st.vx = lerp(st.vx, target, 1 - Math.exp(-dt * (st.ground ? 16 : 12)));
        if (Math.abs(st.vx) < 1 && dir === 0) st.vx = 0;
        if (jump && st.ground) { st.vy = -JUMP; st.ground = false; }
        st.vy = Math.min(st.vy + GRAV * dt, 1600);

        st.wall = 0;
        st.x += st.vx * dt;
        for (const s of solids) if (ov(s, st.x, st.y - 0.5)) {
            if (st.vx > 0 || (st.x < (s.l + s.r) / 2 && st.vx === 0)) { st.x = s.l - HW; st.wall = 1; }
            else { st.x = s.r + HW; st.wall = -1; }
            st.vx = 0;
        }
        const was = st.ground; st.ground = false; st.on = -1;
        st.y += st.vy * dt;
        for (const s of solids) if (ov(s, st.x, st.y)) {
            if (st.vy >= 0) { st.y = s.t; if (!was && st.vy > 500) st.squash = Math.min(0.25, st.vy / 5000); st.vy = 0; st.ground = true; st.on = s.id; }
            else { st.y = s.b + BH; st.vy = 0; }
        }
        if (st.y - BH < 0) { st.y = BH; st.vy = Math.max(0, st.vy); }
        // standing probe so she keeps contact when idle on a ledge
        if (!st.ground && st.vy >= 0) for (const s of solids) if (st.x + HW > s.l && st.x - HW < s.r && Math.abs(st.y - s.t) < 0.8) { st.ground = true; st.on = s.id; }

        // pose selection
        const t = performance.now() / 1000;
        const speed = Math.abs(st.vx);
        const leaning = st.ground && st.wall !== 0 && (dir === st.wall) && speed < 5;
        if (dir !== 0) st.dirLast = dir;
        let p: Record<string, number>;
        const base: Record<string, number> = {
            faceY: 0.4 * st.dirLast, tiltZ: 0, bob: 0, torsoX: 0, headY: Math.sin(t * 0.7) * 0.25, headX: 0,
            lTh: 0, rTh: 0, lSh: 0, rSh: 0, lAx: 0, rAx: 0, lAz: -0.12, rAz: 0.12, lFx: -0.15, rFx: -0.15, lFz: 0, rFz: 0, smile: 1,
        };
        // arms: lArm sits at -x of the model (model's left when facing +z is +x... keep symmetric naming by sign)
        if (waving) {
            state = 'wave'; p = { ...base, faceY: 0.1, headY: Math.sin(t * 2) * 0.15, rAz: 0.4, rFz: 0, rFx: 0, lAz: -0.18, torsoX: 0 };
        } else if (!st.ground) {
            const up = st.vy < 0; state = up ? 'jump' : 'fall';
            p = { ...base, faceY: 0.7 * st.dirLast, bob: 0.02, lAz: up ? -2.3 : -1.3, rAz: up ? 2.3 : 1.3, lFx: -0.2, rFx: -0.2, lTh: up ? -0.55 : 0.3, rTh: up ? 0.25 : -0.3, lSh: up ? 0.9 : 0.5, rSh: up ? 0.3 : 0.7, torsoX: up ? -0.08 : 0.08, headX: up ? -0.15 : 0.1 };
        } else if (leaning) {
            state = 'lean'; const d = st.wall;
            p = { ...base, faceY: 1.3 * d, tiltZ: -0.17 * d, headY: 0, lAx: -1.45, rAx: -1.45, lAz: 0, rAz: 0, lFx: -0.12, rFx: -0.12, lTh: 0.2, rTh: -0.4, lSh: 0.1, rSh: 0.45 };
        } else if (speed > 20) {
            state = 'walk'; st.ph += speed * dt * 0.045;
            const s = Math.sin(st.ph), c = Math.cos(st.ph);
            p = { ...base, faceY: 1.1 * st.dirLast, headY: 0, bob: Math.abs(s) * 0.03, lTh: s * 0.75, rTh: -s * 0.75, lSh: Math.max(0, c) * 0.9, rSh: Math.max(0, -c) * 0.9, lAx: -s * 0.6, rAx: s * 0.6, lFx: -0.4, rFx: -0.4, torsoX: 0.05 };
        } else {
            state = 'idle';
            const b = Math.sin(t * 2.2) * 0.025;
            p = { ...base, lAz: -0.14 - b, rAz: 0.14 + b, bob: Math.sin(t * 2.2) * 0.006 };
        }
        const k = 1 - Math.exp(-dt * 16);
        for (const key in p) pose[key] = pose[key] === undefined ? p[key] : lerp(pose[key], p[key], k);
        st.face = lerpAng(st.face, pose.faceY, 1 - Math.exp(-dt * 10));
        st.squash = lerp(st.squash, 0, 1 - Math.exp(-dt * 12));

        root.rotation.y = st.face;
        root.rotation.z = pose.tiltZ;
        J.body.position.y = pose.bob;
        J.torso.rotation.x = pose.torsoX;
        { const bt = (performance.now() % 3400) / 3400; const k = bt > 0.96 ? 0.12 : 1; J.eyes.forEach((g: any) => { g.scale.y = lerp(g.scale.y, k, 0.6); }); }
        J.head.rotation.y = pose.headY; J.head.rotation.x = pose.headX;
        J.lThigh.rotation.x = pose.lTh; J.rThigh.rotation.x = pose.rTh;
        J.lShin.rotation.x = pose.lSh * 0.8; J.rShin.rotation.x = pose.rSh * 0.8;
        const cl = (v: number, m: number) => Math.max(-m, Math.min(m, v));
        J.lArm.rotation.x = cl(pose.lAx * 0.5, 0.45); J.rArm.rotation.x = cl(pose.rAx * 0.5, 0.45);
        J.lArm.rotation.z = cl(pose.lAz * 0.4, 0.35); J.rArm.rotation.z = state === 'wave' ? 1.7 : cl(pose.rAz * 0.4, 0.35);
        J.lFore.rotation.x = pose.lFx * 0.8; J.rFore.rotation.x = pose.rFx * 0.8;
        J.lFore.rotation.z = pose.lFz * 0.6; J.rFore.rotation.z = state === 'wave' ? Math.sin(t * 9) * 0.45 : pose.rFz * 0.6;
        holder.scale.set(SC * (1 + st.squash * 0.6), SC * (1 - st.squash), SC * (1 + st.squash * 0.6));

        // pigtail springs (secondary motion): trail behind motion
        const fwd = st.vx * Math.sin(st.face) * 0.5 + (st.vx * 0.5);
        const tx = Math.max(-0.7, Math.min(0.7, (st.vx * Math.sin(st.face)) / 380)) + Math.max(-0.5, Math.min(0.5, -st.vy / 1800));
        const tz = Math.max(-0.5, Math.min(0.6, Math.abs(st.vy) / 1500));
        const spr = (a: number[], tgt: number) => { a[1] += ((tgt - a[0]) * 120 - a[1] * 9) * dt; a[0] += a[1] * dt; };
        spr(pig.L, tx); spr(pig.R, tx); spr(pig.f, tz);
        J.pigL.rotation.x = pig.L[0]; J.pigR.rotation.x = pig.R[0];
        J.pigL.rotation.z = -pig.f[0] * 0.8 + Math.sin(t * 1.3) * 0.02; J.pigR.rotation.z = pig.f[0] * 0.8 - Math.sin(t * 1.3) * 0.02;
        void fwd;

        holder.position.set(st.x, -st.y, 30);
        // blob shadow on the ledge below
        let sy = floorY;
        for (const s of solids) if (s.id < 990 && st.x + HW > s.l && st.x - HW < s.r && s.t >= st.y - 1 && s.t < sy) sy = s.t;
        for (const s of solids) if (s.id === 999 && s.t < sy) sy = s.t;
        const hgt = Math.max(0, sy - st.y) * -1 + (st.y - sy) * 0; // st.y<=sy so distance below
        const dist = Math.max(0, sy - st.y);
        void hgt;
        shadow.position.set(st.x, -sy + 1, 20);
        const sc = Math.max(0.3, 1 - dist / 380);
        shadow.scale.set(30 * sc, 5 * sc, 1);
        (shadow.material as any).opacity = 0.28 * sc;
    };

    let acc = 0;
    const frame = (now: number) => {
        if (stopped) return;
        const dt = Math.min(0.033, (now - last) / 1000); last = now;
        measure();
        step(dt);
        if (CLOSE > 0) { const hy = -st.y + SC * 1.1 * 0.93; camera.fov = 30 / CLOSE; camera.position.set(st.x, hy, (H / 2) / Math.tan((15 * Math.PI) / 180) ); camera.lookAt(st.x, hy, 0); camera.updateProjectionMatrix(); }
        renderer.render(scene, camera);
        acc += dt; if (acc > 0.25) { acc = 0; onState(state); }
        raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return {
        reset: () => { st.init = false; st.vx = 0; st.vy = 0; ai.target = -1; },
        stop: () => { stopped = true; cancelAnimationFrame(raf); ro.disconnect(); renderer.dispose(); },
    };
}
