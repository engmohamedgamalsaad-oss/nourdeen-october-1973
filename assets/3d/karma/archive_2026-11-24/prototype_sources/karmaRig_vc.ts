// @ts-ignore vendored three.js r160 (local copy, no remote code)
import * as THREE from './vendor/three.module.min.js';
import { pos, col, idx, si, sw, NV, NF } from './meshData';

export type Joints = {
    root: any; body: any; torso: any; head: any;
    lThigh: any; lShin: any; rThigh: any; rShin: any;
    lArm: any; lFore: any; rArm: any; rFore: any;
    pigL: any; pigR: any; mouth: any;
};

const bytes = (b64: string) => { const s = atob(b64); const u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return u; };
const lin = (c: number) => { const x = c / 255; return x <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); };

// Karma: a real 3D mesh generated from her approved image (TRELLIS.2), decimated and
// vertex-colored, then skinned to a simple 7-bone skeleton driven by the game code.
export function buildKarma() {
    const K = 1.1;
    const P = new Float32Array(bytes(pos).buffer).map((v: number) => v * K), C = bytes(col), I = new Uint32Array(bytes(idx).buffer);
    const SI = bytes(si), SW = bytes(sw);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(P, 3));
    const cf = new Float32Array(NV * 3); for (let i = 0; i < cf.length; i++) cf[i] = Math.min(1, Math.pow(C[i] / 255, 1.35) * 1.12);
    geo.setAttribute('color', new THREE.BufferAttribute(cf, 3));
    geo.setAttribute('skinIndex', new THREE.BufferAttribute(new Uint16Array(SI), 4));
    const w = new Float32Array(NV * 4); for (let i = 0; i < w.length; i++) w[i] = SW[i] / 255;
    geo.setAttribute('skinWeight', new THREE.BufferAttribute(w, 4));
    geo.setIndex(new THREE.BufferAttribute(I, 1));
    geo.computeVertexNormals();

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
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0, side: THREE.DoubleSide });
    const mesh = new THREE.SkinnedMesh(geo, mat);
    mesh.frustumCulled = false;
    body.add(mesh);
    body.updateMatrixWorld(true);
    mesh.bind(new THREE.Skeleton(bones));

    const dummy = () => new THREE.Object3D();
    const joints: Joints = {
        root, body, torso: spine, head,
        lThigh: lTh, lShin: lSh, rThigh: rTh, rShin: rSh,
        lArm, lFore: lFo, rArm, rFore: rFo,
        pigL: dummy(), pigR: dummy(), mouth: dummy(),
    };
    return { THREE, root, joints };
}
