import trimesh, numpy as np, base64, fast_simplification as fs
from scipy.spatial import cKDTree
s=trimesh.load('karma2.glb'); g=list(s.geometry.values())[0]
v=np.asarray(g.vertices); f=np.asarray(g.faces)
col=np.asarray(g.visual.to_color().vertex_colors)[:,:3]
nv,nf=fs.simplify(v.astype(np.float32),f.astype(np.int32),target_reduction=0.78)
d,i=cKDTree(v).query(nv,k=4); nc=col[i].mean(axis=1).astype(np.uint8)
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
P=(nv+np.array([0,0.5,0])).astype(np.float32)
out={'pos':P.astype('<f4').tobytes(),'col':nc.tobytes(),'idx':nf.astype('<u4').tobytes(),'si':idx.astype('u1').tobytes(),'sw':(w4*255).round().astype('u1').tobytes()}
ts='// generated from the TRELLIS.2 A-pose mesh of Karma (decimated, vertex-colored)\n'
for k,b in out.items(): ts+=f"export const {k} = '{base64.b64encode(b).decode()}';\n"
ts+=f'export const NV = {len(nv)}, NF = {len(nf)};\n'
open('karma3d/src/meshData.ts','w').write(ts); print(nv.shape,len(ts)/1e6,'MB', 'arm verts',int((armm>0.5).sum()))

# diagnostics: pose right arm up (rotate about shoulder by 1.7rad in xy plane) and measure edge stretch
import math
sh=np.array([0.12,0.06]); 
def rot(p,c,a):
    d=p-c; ca,sa=math.cos(a),math.sin(a); return c+np.stack([d[:,0]*ca-d[:,1]*sa,d[:,0]*sa+d[:,1]*ca],1)
Wfull=np.zeros((len(nv),11)); np.put_along_axis(Wfull,idx,w4,1)
wu=Wfull[:,9]; wf=Wfull[:,10]
p=np.stack([x,y],1); a=-1.7
pu=rot(p,sh,a)
np_=p*(1-wu-wf)[:,None]+pu*(wu+wf)[:,None]
e=nf[:, [0,1]]; 
L0=np.linalg.norm(p[nf[:,0]]-p[nf[:,1]],axis=1); L1=np.linalg.norm(np_[nf[:,0]]-np_[nf[:,1]],axis=1)
r=L1/(L0+1e-6); bad=np.where((r>4)&(L1>0.03))[0]; print('stretched edges',len(bad))
vs=np.unique(nf[bad][:,:2]); print('verts',len(vs)); print(np.round(p[vs][:10],3)); print(np.round(wu[vs][:10]+wf[vs][:10],2))
print('--detail')
for j in vs:
    print(np.round(x[j],3),np.round(y[j],3),np.round(z[j],3),'dd',np.round(dd[j],3),'hair',bool(hair[j]),'arm',np.round(armm[j],2),'wu',np.round(wu[j],2),'wf',np.round(wf[j],2),'col',nc[j])
