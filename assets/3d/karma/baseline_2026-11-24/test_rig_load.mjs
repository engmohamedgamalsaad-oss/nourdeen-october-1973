import fs from 'fs';
globalThis.self = globalThis;
const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js');
const THREE = await import('three');
const buf = fs.readFileSync(process.argv[2]); const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset+buf.byteLength);
const gltf = await new Promise((res,rej)=>new GLTFLoader().parse(ab,'',res,rej));
let skinned=0,tris=0,bones=0; const names=[];
gltf.scene.traverse(o=>{names.push(o.name); if(o.isSkinnedMesh)skinned++; if(o.isBone)bones++; if(o.isMesh&&o.geometry){const g=o.geometry;tris+=(g.index?g.index.count:g.attributes.position.count)/3;}});
console.log(JSON.stringify({loadedInThree:true,meshes_tris:tris,skinnedMeshes:skinned,boneObjects:bones,animations:gltf.animations.length,nodes:names.length}));
const BONES=['Hips','Spine','Chest','Neck','Head','Shoulder_L','UpperArm_L','Forearm_L','Hand_L','Shoulder_R','UpperArm_R','Forearm_R','Hand_R','UpperLeg_L','LowerLeg_L','Foot_L','UpperLeg_R','LowerLeg_R','Foot_R'];
console.log('missing bones:',BONES.filter(b=>!gltf.scene.getObjectByName(b)));
// replicate KarmaRig.createRig checks
try{ const {createRig}=await import('./KarmaRig.node-test-adapter.js'); createRig(gltf.scene); console.log('createRig OK'); }catch(e){ console.log('createRig threw:',e.message); }
