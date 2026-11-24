# Builds a real skinned Karma GLB (19 KarmaRig bones + mounts). Baseline: TRELLIS body + MediaPipe face patch.
import re,base64,json,struct,sys,numpy as np
SRC=sys.argv[1] if len(sys.argv)>1 else '/downloads/karma3d_face/src'
OUT=sys.argv[2] if len(sys.argv)>2 else 'karma_skinned_baseline.glb'
def rd(f):
    s=open(f).read(); return s,(lambda n:re.search(r"export const %s = '([^']*)'"%n,s).group(1))
s,g=rd(SRC+'/meshData.ts')
LO=np.array(eval(re.search(r"LO = (\[[^\]]*\])",s).group(1)));SC=np.array(eval(re.search(r"SC = (\[[^\]]*\])",s).group(1)))
q=np.frombuffer(base64.b64decode(g('pos')),np.uint16).reshape(-1,3);P=(LO+q*SC).astype(np.float32)
UV=(np.frombuffer(base64.b64decode(g('uv')),np.uint16).reshape(-1,2)/65535).astype(np.float32)
F=np.frombuffer(base64.b64decode(g('idx')),np.uint32).reshape(-1,3)
JPG=base64.b64decode(g('tex'))
s2,g2=rd(SRC+'/patchData.ts')
PP=np.frombuffer(base64.b64decode(g2('patchPos')),np.float32).reshape(-1,3)
PU=np.frombuffer(base64.b64decode(g2('patchUV')),np.float32).reshape(-1,2)
PF=np.frombuffer(base64.b64decode(g2('patchIdx')),np.uint32).reshape(-1,3) if True else None
PNG=base64.b64decode(g2('patchTex'))
# skeleton: name, parent, world position (Karma's left = +X)
W={'Hips':(0,.42,0),'Spine':(0,.46,0),'Chest':(0,.52,0),'Neck':(0,.60,0),'Head':(0,.69,0),
'Shoulder_L':(.06,.56,0),'UpperArm_L':(.13,.53,0),'Forearm_L':(.215,.40,.02),'Hand_L':(.285,.335,.03),
'UpperLeg_L':(.075,.42,0),'LowerLeg_L':(.075,.24,0),'Foot_L':(.08,.09,0)}
for k in list(W):
    if k.endswith('_L'): W[k[:-1]+'R']=(-W[k][0],W[k][1],W[k][2])
PAR={'Hips':None,'Spine':'Hips','Chest':'Spine','Neck':'Chest','Head':'Neck'}
for sd in 'LR':
    PAR.update({'Shoulder_'+sd:'Chest','UpperArm_'+sd:'Shoulder_'+sd,'Forearm_'+sd:'UpperArm_'+sd,'Hand_'+sd:'Forearm_'+sd,
    'UpperLeg_'+sd:'Hips','LowerLeg_'+sd:'UpperLeg_'+sd,'Foot_'+sd:'LowerLeg_'+sd})
BONES=['Hips','Spine','Chest','Neck','Head','Shoulder_L','UpperArm_L','Forearm_L','Hand_L','Shoulder_R','UpperArm_R','Forearm_R','Hand_R','UpperLeg_L','LowerLeg_L','Foot_L','UpperLeg_R','LowerLeg_R','Foot_R']
A=lambda n:np.array(W[n],np.float32)
SEG={'Hips':(A('Hips'),A('Spine')),'Spine':(A('Spine'),A('Chest')),'Chest':(A('Chest'),A('Neck')),'Neck':(A('Neck'),A('Head')),'Head':(A('Head'),A('Head')+[0,.3,0])}
for sd in 'LR':
    SEG.update({'Shoulder_'+sd:(A('Chest')*[0,1,0]+A('Chest')*0+[0,.04,0],A('UpperArm_'+sd)),'UpperArm_'+sd:(A('UpperArm_'+sd),A('Forearm_'+sd)),
    'Forearm_'+sd:(A('Forearm_'+sd),A('Hand_'+sd)),'Hand_'+sd:(A('Hand_'+sd),A('Hand_'+sd)+[.03*(1 if sd=='L' else -1),-.04,0]),
    'UpperLeg_'+sd:(A('UpperLeg_'+sd),A('LowerLeg_'+sd)),'LowerLeg_'+sd:(A('LowerLeg_'+sd),A('Foot_'+sd)),'Foot_'+sd:(A('Foot_'+sd),A('Foot_'+sd)+[0,-.07,.08])})
def segd(p,a,b):
    ab=b-a;t=np.clip(((p-a)@ab)/max(ab@ab,1e-9),0,1);return np.linalg.norm(p-(a+t[:,None]*ab),axis=1)
def weights(Pv):
    n=len(Pv);D=np.full((n,19),1e3,np.float32)
    for i,b in enumerate(BONES):
        a,bb=SEG[b];d=segd(Pv,a,bb)
        if b.endswith('_L'): d=np.where(Pv[:,0]<-0.01,1e3,d)
        if b.endswith('_R'): d=np.where(Pv[:,0]>0.01,1e3,d)
        D[:,i]=d
    # arms only for vertices outside torso, legs only below hips
    out=np.abs(Pv[:,0])>0.125
    for i,b in enumerate(BONES):
        if b.startswith(('UpperArm','Forearm','Hand')): D[~out&(Pv[:,1]>.45)|((np.abs(Pv[:,0])<0.12)&(Pv[:,1]>0.45)),i]*=1e2 if False else 1
    Wt=1.0/(D+0.01)**4
    # head: everything above neck blends to Head
    hb=BONES.index('Head');t=np.clip((Pv[:,1]-0.62)/(0.69-0.62),0,1);t=t*t*(3-2*t)
    # v2: neck column keeps the original ramp; hair/outside-neck vertices (|x|>0.065) follow the head from y 0.60 up, fading in over a longer ramp
    side=np.clip((np.abs(Pv[:,0])-0.055)/0.03,0,1)
    t2=np.clip((Pv[:,1]-0.56)/(0.74-0.56),0,1);t2=t2*t2*(3-2*t2)
    t=np.where(Pv[:,1]>0.60,t*(1-side)+np.maximum(t,t2)*side,t)
    Wt/=Wt.sum(1,keepdims=True)
    Wt*= (1-t)[:,None];Wt[:,hb]+=t
    idx=np.argsort(-Wt,1)[:,:4];w=np.take_along_axis(Wt,idx,1);w/=w.sum(1,keepdims=True)
    return idx.astype(np.uint16),w.astype(np.float32)
def normals(Pv,Fv):
    n=np.zeros_like(Pv);a=Pv[Fv[:,1]]-Pv[Fv[:,0]];b=Pv[Fv[:,2]]-Pv[Fv[:,0]];c=np.cross(a,b)
    for k in range(3): np.add.at(n,Fv[:,k],c)
    return (n/np.maximum(np.linalg.norm(n,axis=1,keepdims=True),1e-9)).astype(np.float32)
bin_=bytearray();views=[];acc=[]
def add(arr,target=None,**kw):
    while len(bin_)%4:bin_.append(0)
    off=len(bin_);bin_.extend(arr.tobytes());views.append({'buffer':0,'byteOffset':off,'byteLength':arr.nbytes,**({'target':target} if target else {})})
    ct={np.dtype('float32'):5126,np.dtype('uint16'):5123,np.dtype('uint32'):5125}[arr.dtype]
    comp=1 if arr.ndim==1 else arr.shape[1];typ={1:'SCALAR',2:'VEC2',3:'VEC3',4:'VEC4',16:'MAT4'}[comp]
    a={'bufferView':len(views)-1,'componentType':ct,'count':len(arr),'type':typ,**kw};acc.append(a);return len(acc)-1
def prim(Pv,Uv,Fv,J,Wv,mat):
    N=normals(Pv,Fv)
    return {'attributes':{'POSITION':add(Pv,34962,min=Pv.min(0).tolist(),max=Pv.max(0).tolist()),'NORMAL':add(N,34962),'TEXCOORD_0':add(Uv.astype(np.float32),34962),
      'JOINTS_0':add(J,34962),'WEIGHTS_0':add(Wv,34962)},'indices':add(Fv.astype(np.uint32).ravel(),34963),'material':mat}
J1,W1=weights(P)
hb=BONES.index('Head');nP=len(PP)
J2=np.zeros((nP,4),np.uint16);J2[:,0]=hb;W2=np.zeros((nP,4),np.float32);W2[:,0]=1
prims=[prim(P,UV,F,J1,W1,0),prim(PP.astype(np.float32),PU,PF,J2,W2,1)]
nodes=[];
def node(name,pos=None,**kw):
    d={'name':name,**kw}
    if pos is not None:d['translation']=[float(x) for x in pos]
    nodes.append(d);return len(nodes)-1
root=node('Karma_Root')
ni={}
for b in BONES:
    par=PAR[b];rel=np.array(W[b])-(np.array(W[par]) if par else 0)
    ni[b]=node(b,rel);
for b in BONES:
    par=PAR[b]
    if par: nodes[ni[par]].setdefault('children',[]).append(ni[b])
nodes[root]['children']=[ni['Hips']]
hm=node('HeadMount',(0,0,0));hr=node('HairMount',(0,0,0));ph=node('HEAD_PLACEHOLDER_replace_with_karma_head',(0,0,0))
nodes[ni['Head']]['children']=[hm,hr];nodes[hm]['children']=[ph]
ibm=np.zeros((19,4,4),np.float32)
for i,b in enumerate(BONES):
    m=np.eye(4,dtype=np.float32);m[:3,3]=-np.array(W[b]);ibm[i]=m.T   # column-major
ia=add(ibm.reshape(19,16))
skin={'joints':[ni[b] for b in BONES],'inverseBindMatrices':ia,'skeleton':ni['Hips']}
mesh_n=node('Karma_Body',mesh=0,skin=0);nodes[root].setdefault('children',[]).append(mesh_n)
def img(b,mt):
    while len(bin_)%4:bin_.append(0)
    o=len(bin_);bin_.extend(b);views.append({'buffer':0,'byteOffset':o,'byteLength':len(b)});return {'bufferView':len(views)-1,'mimeType':mt}
images=[img(JPG,'image/jpeg'),img(PNG,'image/png')]
gl={'asset':{'version':'2.0','generator':'karma_stage3/build_glb_v2.py (neck/hair weight ramp test)'},'scene':0,'scenes':[{'nodes':[root]}],'nodes':nodes,
'meshes':[{'name':'Karma_Body','primitives':prims}],'skins':[skin],
'materials':[{'name':'Body_TRELLIS_texture','pbrMetallicRoughness':{'baseColorTexture':{'index':0},'metallicFactor':0,'roughnessFactor':0.9},'doubleSided':True},
 {'name':'Face_patch_photo','pbrMetallicRoughness':{'baseColorTexture':{'index':1},'metallicFactor':0,'roughnessFactor':0.85},'alphaMode':'BLEND','doubleSided':True}],
'textures':[{'source':0},{'source':1}],'images':images,'accessors':acc,'bufferViews':views,'buffers':[{'byteLength':len(bin_)}]}
j=json.dumps(gl,separators=(',',':')).encode();j+=b' '*((4-len(j)%4)%4)
while len(bin_)%4:bin_.append(0)
out=struct.pack('<III',0x46546C67,2,12+8+len(j)+8+len(bin_))+struct.pack('<II',len(j),0x4E4F534A)+j+struct.pack('<II',len(bin_),0x004E4942)+bytes(bin_)
open(OUT,'wb').write(out);print(OUT,len(out),'bytes tris',len(F)+len(PF))
