// @ts-ignore vendored three.js r160 (local copy, no remote code)
import * as THREE from './vendor/three.module.min.js';
import { pos, uv, tex, idx, si, sw, NV, NF, LO, SC } from './meshData';

export type Joints = {
    root: any; body: any; torso: any; head: any;
    lThigh: any; lShin: any; rThigh: any; rShin: any;
    lArm: any; lFore: any; rArm: any; rFore: any;
    pigL: any; pigR: any; mouth: any; eyes: any[];
};

const bytes = (b64: string) => { const s = atob(b64); const u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return u; };
const lin = (c: number) => { const x = c / 255; return x <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); };

// Karma: a real 3D mesh generated from her approved image (TRELLIS.2), decimated and
// vertex-colored, then skinned to a simple 7-bone skeleton driven by the game code.
export function buildKarma() {
    const K = 1.1;
    const q = new Uint16Array(bytes(pos).buffer), U = new Uint16Array(bytes(uv).buffer), I = new Uint32Array(bytes(idx).buffer);
    const SI = bytes(si), SW = bytes(sw);
    const P = new Float32Array(NV * 3); for (let i = 0; i < NV * 3; i++) P[i] = (LO[i % 3] + q[i] * SC[i % 3]) * K;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(P, 3));
    const uf = new Float32Array(NV * 2); for (let i = 0; i < uf.length; i++) uf[i] = U[i] / 65535;
    geo.setAttribute('uv', new THREE.BufferAttribute(uf, 2));
    geo.setAttribute('skinIndex', new THREE.BufferAttribute(new Uint16Array(SI), 4));
    const w = new Float32Array(NV * 4); for (let i = 0; i < w.length; i++) w[i] = SW[i] / 255;
    geo.setAttribute('skinWeight', new THREE.BufferAttribute(w, 4));
    geo.setIndex(new THREE.BufferAttribute(I, 1));
    geo.computeVertexNormals();
    const img = new Image(); const map = new THREE.Texture(img); map.flipY = false; map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = 4;
    img.onload = () => { map.needsUpdate = true; }; img.src = 'data:image/jpeg;base64,' + tex;

    const root = new THREE.Group();
    const body = new THREE.Group(); root.add(body);
    const bone = (parent: any, x: number, y: number, z = 0) => { const b = new THREE.Bone(); b.position.set(x * K, y * K, z * K); parent.add(b); return b; };
    // order must match the weights: hips, spine, head, lLeg, rLeg, lArm, rArm
    const hips = bone(body, 0, 0.42);
    const spine = bone(hips, 0, 0);
    const head = bone(spine, 0, 0.27);
    const lTh = bone(hips, -0.07, 0), lSh = bone(lTh, 0, -0.19);
    const rTh = bone(hips, 0.07, 0), rSh = bone(rTh, 0, -0.19);
    const lArm = bone(spine, -0.12, 0.14), lFo = bone(lArm, -0.11, -0.16);
    const rArm = bone(spine, 0.12, 0.14), rFo = bone(rArm, 0.11, -0.16);
    const bones = [hips, spine, head, lTh, lSh, rTh, rSh, lArm, lFo, rArm, rFo];
    const mat = new THREE.MeshStandardMaterial({ map, roughness: 0.9, metalness: 0, side: THREE.DoubleSide });
    const mesh = new THREE.SkinnedMesh(geo, mat);
    mesh.frustumCulled = false;
    body.add(mesh);
    body.updateMatrixWorld(true);
    mesh.bind(new THREE.Skeleton(bones));

    // real 3D eyeballs (white globe + iris cap + pupil + catch-light) seated in the generated face's eye sockets;
    // the source texture paints the eyes as blank hollows, so these sit over them, parented to the head bone.
    const eyes: any[] = [];
    const HY = 0.69 * K;
    for (const ex of [-0.054, 0.029]) {
        const g = new THREE.Group();
        g.position.set(ex, 0.8925 - HY, 0.108);
        const R = 0.0225;
        const white = new THREE.Mesh(new THREE.SphereGeometry(R, 24, 16), new THREE.MeshStandardMaterial({ color: 0xf6f1ea, roughness: 0.35 }));
        white.scale.set(1.05, 0.82, 0.9);
        const cap = (r: number, th: number, color: number, rough: number) => {
            const gg = new THREE.SphereGeometry(r, 24, 8, 0, Math.PI * 2, 0, th); gg.rotateX(Math.PI / 2);
            const m = new THREE.Mesh(gg, new THREE.MeshStandardMaterial({ color, roughness: rough }));
            m.scale.set(1.05, 0.82, 0.9); return m;
        };
        const iris = cap(R * 1.012, 0.62, 0x4a2a14, 0.3);
        const pupil = cap(R * 1.022, 0.27, 0x070403, 0.2);
        const glint = new THREE.Mesh(new THREE.SphereGeometry(0.0042, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffffff }));
        glint.position.set(0.0075, 0.0085, R * 0.9 * 0.97);
        g.add(white, iris, pupil, glint);
        head.add(g); eyes.push(g);
    }
    const dummy = () => new THREE.Object3D();
    const joints: Joints = {
        root, body, torso: spine, head,
        lThigh: lTh, lShin: lSh, rThigh: rTh, rShin: rSh,
        lArm, lFore: lFo, rArm, rFore: rFo,
        pigL: dummy(), pigR: dummy(), mouth: dummy(), eyes,
    };
    return { THREE, root, joints };
}
