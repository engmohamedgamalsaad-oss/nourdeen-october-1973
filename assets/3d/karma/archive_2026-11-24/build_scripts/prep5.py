import trimesh, numpy as np, base64, fast_simplification as fs
from scipy.spatial import cKDTree
s=trimesh.load('karma2.glb'); g=list(s.geometry.values())[0]
v=np.asarray(g.vertices); f=np.asarray(g.faces)
col=np.asarray(g.visual.to_color().vertex_colors)[:,:3]
nv=v.astype(np.float32); nf=f.astype(np.int32); nc=col; UV=np.asarray(g.visual.uv)
x,y,z=nv[:,0],nv[:,1],nv[:,2]
ss=lambda a,b,t:(lambda u:u*u*(3-2*u))(np.clip((t-a)/(b-a),0,1))
hair=(nc[:,0]<110)&(nc[:,1]<95)&(nc[:,2]<95)
Y=y+0.5
W=np.zeros((len(nv),11)); side=np.sign(x); ax=np.abs(x)
# arm: distance to segment shoulder->wrist (model coords, y in -.5..)
S=np.array([0.12,0.06]); E=np.array([0.23,-0.10]); Wr=np.array([0.31,-0.26])
def segd(p,a,b):
    ab=b-a; t=np.clip(((p-a)@ab)/(ab@ab),0,1); q=a+t[:,None]*ab; return np.linalg.norm(p-q,axis=1),t
P2=np.stack([ax,y],1)
dd,t=segd(P2,S,Wr)
armm=(1-ss(0.09,0.14,dd))*ss(0.125,0.155,ax)*(1-ss(0.02,0.07,y))*(~(hair&(y>-0.02)))*(y<0.10)*(np.abs(z)<0.22)
# upper vs fore by projection along S->E->Wr
tE=ss(0.38,0.62,t)   # 0 fore .. 1 upper? t small=upper
upper=1-tE; fore=tE
head=ss(0.14,0.21,y)
hairw=hair*(1-armm)*ss(-0.08,0.12,y)  # hair follows head, more toward top
headw=np.maximum(head,hairw)*(1-armm)
leg=(1-ss(-0.07,0.0,y))*(1-armm)*(1-headw)
lw=ss(-0.03,0.03,x); kn=ss(0.17,0.29,Y)
W[:,2]=headw
W[:,7]=armm*(side<0)*upper; W[:,8]=armm*(side<0)*fore
W[:,9]=armm*(side>=0)*upper; W[:,10]=armm*(side>=0)*fore
W[:,3]=leg*(1-lw)*kn; W[:,4]=leg*(1-lw)*(1-kn)
W[:,5]=leg*lw*kn; W[:,6]=leg*lw*(1-kn)
rest=np.clip(1-W.sum(1),0,1); sp=ss(-0.12,-0.03,y)
W[:,1]=rest*sp; W[:,0]=rest*(1-sp)
W/=W.sum(1,keepdims=True)
idx=np.argsort(-W,axis=1)[:,:4]; w4=np.take_along_axis(W,idx,1); w4/=w4.sum(1,keepdims=True)

import io
P=(nv+np.array([0,0.5,0])).astype(np.float32)
# quantize position to int16 over bbox
lo=P.min(0); hi=P.max(0); sc=(hi-lo)/65535
Q=np.round((P-lo)/sc).astype('<u2')
uvq=np.round(UV*65535).clip(0,65535).astype('<u2'); uvq[:,1]=np.round((1-UV[:,1])*65535).clip(0,65535)
tex=g.visual.material.baseColorTexture.convert('RGB')
b=io.BytesIO(); tex.save(b,'JPEG',quality=88); 
out={'pos':Q.tobytes(),'uv':uvq.tobytes(),'idx':nf.astype('<u4').tobytes(),'si':idx.astype('u1').tobytes(),'sw':(w4*255).round().astype('u1').tobytes(),'tex':b.getvalue()}
ts='// generated from the original TRELLIS.2 A-pose mesh (full resolution, original UV texture, int16 positions)\n'
for k,bb in out.items(): ts+=f"export const {k} = '{base64.b64encode(bb).decode()}';\n"
ts+=f'export const NV = {len(nv)}, NF = {len(nf)};\nexport const LO = [{lo[0]},{lo[1]},{lo[2]}], SC = [{sc[0]},{sc[1]},{sc[2]}];\n'
open('karma3d/src/meshData_full.ts','w').write(ts); print(len(nv),len(ts)/1e6,'MB',len(out['tex']))
