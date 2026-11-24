import fs from 'fs';
globalThis.self=globalThis; globalThis.createImageBitmap=async()=>({width:1,height:1,close(){}});
const THREE=await import('three');
const {GLTFLoader}=await import('three/examples/jsm/loaders/GLTFLoader.js');
const {createRig}=await import('./KarmaRig.js'); const {KarmaController}=await import('./KarmaController.js');
const f=process.argv[2]; const b=fs.readFileSync(f); const ab=b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength);
const gltf=await new Promise((r,j)=>new GLTFLoader().parse(ab,'',r,j));
const R={file:f,bytes:b.length};
const sk=[];gltf.scene.traverse(o=>{if(o.isSkinnedMesh)sk.push(o)});
R.skinnedMeshes=sk.length; R.joints=sk[0].skeleton.bones.length; R.inverses=sk[0].skeleton.boneInverses.length;
let tris=0,maxdev=0,bad=0;
for(const m of sk){const g=m.geometry;tris+=g.index.count/3;const w=g.attributes.skinWeight,j=g.attributes.skinIndex;
 for(let i=0;i<w.count;i++){const s=w.getX(i)+w.getY(i)+w.getZ(i)+w.getW(i);maxdev=Math.max(maxdev,Math.abs(s-1));if(j.getX(i)>=R.joints)bad++;}}
R.triangles=tris;R.maxWeightSumDeviation=maxdev;R.badJointIndex=bad;
const rig=createRig(gltf.scene);R.createRig='OK';R.bones=Object.keys(rig.bones).length;R.mounts={head:!!rig.headMount,hair:!!rig.hairMount,placeholder:!!rig.headPlaceholder};
// skinned bbox helper
const bbox=()=>{const bb=new THREE.Box3(),v=new THREE.Vector3();for(const m of sk){m.updateMatrixWorld(true);m.skeleton.update();const p=m.geometry.attributes.position;for(let i=0;i<p.count;i+=40){m.getVertexPosition?m.getVertexPosition(i,v):v.fromBufferAttribute(p,i);v.applyMatrix4(m.matrixWorld);bb.expandByPoint(v);}}return bb};
const rest=bbox();R.restBox={min:rest.min.toArray().map(x=>+x.toFixed(3)),max:rest.max.toArray().map(x=>+x.toFixed(3))};
// controller test
const rects=[{id:'a',left:100,top:300,width:150,height:200},{id:'b',left:400,top:260,width:150,height:240}];
const c=new KarmaController({rig,getCardRects:()=>rects,viewport:{width:800,height:600},characterHeightPx:170,modelHeight:1});
const log=[];const step=(n,dt=1/60)=>{for(let i=0;i<n;i++)c.update(dt)};
const hand=()=>rig.bones.Hand_R.getWorldPosition(new THREE.Vector3()).y;
const out={};
let done=false;c.walkTo('b',{side:'top'}).then(r=>{done=r.completed});step(60*8);out.walkReached=done;out.pos=[c.pos.x,c.pos.y].map(x=>+x.toFixed(1));
const y0=c.holder.position.y;let ymax=y0;c.jump();for(let i=0;i<60;i++){c.update(1/60);ymax=Math.max(ymax,c.holder.position.y)}out.jumpRisePx=+(ymax-y0).toFixed(1);
step(30);const h0=hand();c.wave(2);step(40);out.waveHandRaisePx=+((hand()-h0)*c.scale).toFixed(1);step(120);
c.leanOn('a',{side:'right'});step(60*8);out.state=c.stateName;out.leanSpineZ=+rig.bones.Spine.rotation.z.toFixed(3);
const mv=bbox();out.leanBox={min:mv.min.toArray().map(x=>+x.toFixed(1)),max:mv.max.toArray().map(x=>+x.toFixed(1))};
R.controller=out;
fs.writeFileSync(process.argv[3]||'RESULT_skin_anim.json',JSON.stringify(R,null,1));console.log(JSON.stringify(R));
