// TEST HARNESS (not canonical). Loads a Karma GLB, runs all 6 controller actions with promise resolution awaited, then a per-joint deformation test.
import fs from 'fs';
globalThis.self=globalThis; globalThis.createImageBitmap=async()=>({width:1,height:1,close(){}});
const THREE=await import('three');
const {GLTFLoader}=await import('three/examples/jsm/loaders/GLTFLoader.js');
const {createRig}=await import('./KarmaRig.js'); const {KarmaController}=await import('./KarmaController.js');
const f=process.argv[2]; const b=fs.readFileSync(f); const ab=b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength);
const gltf=await new Promise((r,j)=>new GLTFLoader().parse(ab,'',r,j));
const rig=createRig(gltf.scene);
const sk=[];gltf.scene.traverse(o=>{if(o.isSkinnedMesh)sk.push(o)});
const tick=()=>new Promise(r=>setImmediate(r));
const pos=(m)=>{m.updateMatrixWorld(true);m.skeleton.update();const p=m.geometry.attributes.position,n=p.count,out=new Float32Array(n*3),v=new THREE.Vector3();for(let i=0;i<n;i++){m.getVertexPosition(i,v);v.applyMatrix4(m.matrixWorld);out[i*3]=v.x;out[i*3+1]=v.y;out[i*3+2]=v.z}return out};
const R={file:f,results:{}};
// --- controller
const rects=[{id:'a',left:100,top:300,width:150,height:200},{id:'b',left:400,top:260,width:150,height:240}];
const c=new KarmaController({rig,getCardRects:()=>rects,viewport:{width:800,height:600},characterHeightPx:170,modelHeight:1});
const step=async(s,dt=1/60)=>{for(let i=0;i<Math.round(s/dt);i++)c.update(dt);await tick()};
const bp=(n)=>rig.bones[n].getWorldPosition(new THREE.Vector3());
let res;
c.walkTo('b',{side:'top'}).then(r=>res=r);await step(6);
R.results.walkTo={resolved:res,pos:[c.pos.x,c.pos.y].map(x=>+x.toFixed(1)),target:[475,260],state:c.stateName};
let y0=c.holder.position.y,ym=y0,r2;c.jump().then(r=>r2=r);for(let i=0;i<90;i++){c.update(1/60);ym=Math.max(ym,c.holder.position.y)}await tick();
R.results.jump={resolved:r2,risePx:+(ym-y0).toFixed(1)};
await step(0.5);let h0=bp('Hand_R').y,hm=h0,r3;c.wave(2).then(r=>r3=r);for(let i=0;i<150;i++){c.update(1/60);hm=Math.max(hm,bp('Hand_R').y)}await tick();
R.results.wave={resolved:r3,handRiseModelUnits:+(hm-h0).toFixed(3),handRisePx:+((hm-h0)*c.scale).toFixed(1)};
let hd=bp('Head').x,r4,hz=0;c.tilt('left',1.4).then(r=>r4=r);for(let i=0;i<90;i++){c.update(1/60);hz=Math.max(hz,Math.abs(rig.bones.Head.rotation.z)+Math.abs(rig.bones.Neck.rotation.z))}await tick();
R.results.tilt={resolved:r4,maxNeckHeadRotZ:+hz.toFixed(3)};
let r5;c.leanOn('a',{side:'right'}).then(r=>r5=r);await step(8);
R.results.leanOn={resolved:r5,state:c.stateName,pos:[c.pos.x,c.pos.y].map(x=>+x.toFixed(1)),spineRotZ:+rig.bones.Spine.rotation.z.toFixed(3)};
let r6;c.stand().then(r=>r6=r);await step(2);
R.results.stand={resolved:r6,state:c.stateName,spineRotZ:+rig.bones.Spine.rotation.z.toFixed(3)};
// --- deformation test on a fresh pose (reset controller effects)
for(const k in rig.bones){rig.bones[k].rotation.set(0,0,0)}
gltf.scene.updateMatrixWorld(true);
const base=sk.map(pos);R.scale=c.scale;
const tests={Shoulder_L:['UpperArm_L',[0,0,1.2]],Shoulder_R:['UpperArm_R',[0,0,-1.2]],Elbow_L:['Forearm_L',[-1.6,0,0]],Elbow_R:['Forearm_R',[-1.6,0,0]],Hip_L:['UpperLeg_L',[-1.0,0,0]],Hip_R:['UpperLeg_R',[-1.0,0,0]],Knee_L:['LowerLeg_L',[1.2,0,0]],Knee_R:['LowerLeg_R',[1.2,0,0]],Neck:['Neck',[0.5,0.6,0.4]],Head:['Head',[0.4,0.6,0.3]],Spine:['Spine',[0.3,0,0.4]]};
R.deform={};
for(const [nm,[bn,e]] of Object.entries(tests)){
  const bone=rig.bones[bn]; if(!bone){R.deform[nm]={error:'missing bone '+bn};continue}
  bone.rotation.set(...e);gltf.scene.updateMatrixWorld(true);
  let moved=0,maxd=0,nan=0,maxStretch=0,ne=0,n2=0,n3=0;
  sk.forEach((m,si)=>{const q=pos(m),b0=base[si],idx=m.geometry.index.array;
    for(let i=0;i<q.length;i++){if(!isFinite(q[i]))nan++}
    for(let i=0;i<q.length/3;i++){const d=Math.hypot(q[i*3]-b0[i*3],q[i*3+1]-b0[i*3+1],q[i*3+2]-b0[i*3+2]);if(d>1e-3)moved++;maxd=Math.max(maxd,d/c.scale)}
    for(let t=0;t<idx.length;t+=3*7){for(let k=0;k<3;k++){const a=idx[t+k],bb=idx[t+(k+1)%3];const L0=Math.hypot(b0[a*3]-b0[bb*3],b0[a*3+1]-b0[bb*3+1],b0[a*3+2]-b0[bb*3+2]);const L1=Math.hypot(q[a*3]-q[bb*3],q[a*3+1]-q[bb*3+1],q[a*3+2]-q[bb*3+2]);if(L0>1e-4){const r=L1/L0;maxStretch=Math.max(maxStretch,r);ne++;if(r>2)n2++;if(r>4)n3++}}}});
  R.deform[nm]={bone:bn,euler:e,movedVerts:moved,maxDisp:+maxd.toFixed(3),nan,maxEdgeStretch:+maxStretch.toFixed(2),edgesSampled:ne,pctOver2x:+(100*n2/ne).toFixed(3),pctOver4x:+(100*n3/ne).toFixed(3)};
  bone.rotation.set(0,0,0);
}
fs.writeFileSync(process.argv[3]||'RESULT_harness_v2.json',JSON.stringify(R,null,1));console.log(JSON.stringify(R));
