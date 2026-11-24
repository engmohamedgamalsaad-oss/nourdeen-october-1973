import sys,re,base64,io,numpy as np,cv2,mediapipe as mp
sys.path.insert(0,'/tmp/w')
from load import *
from scipy import ndimage as ndi
EX=-0.0125;sx=900.0
yp=np.array([345,282,254,206,109,0.]);Yv=np.array([0.66,0.749,0.817,0.8925,1.0,1.2])
Yu=lambda py:0.8925+(206-py)/sx
# 1. vertical deform of head mesh to true photo proportions
Y=P[:,1].copy()
py_old=np.interp(Y,Yv,yp)
tgt=Yu(py_old)
w=np.clip((Y-0.45)/(0.66-0.45),0,1)
P2=P.copy();P2[:,1]=Y+w*(tgt-Y)
# requantize
q2=np.clip(np.round((P2-LO)/SC),0,65535).astype(np.uint16)
s=open('/downloads/karma3d_close/src/meshData.ts').read()
s=re.sub(r"(export const pos = ')[^']*(')",lambda m:m.group(1)+base64.b64encode(q2.tobytes()).decode()+m.group(2),s)
P2=LO+q2*SC
# 2. face oval polygon from landmarks
L=np.load('/tmp/w/lm_apose.npy')[:468,:2]
edges=list(mp.solutions.face_mesh.FACEMESH_FACE_OVAL)
nxt={};
for a,b in edges: nxt.setdefault(a,[]).append(b);nxt.setdefault(b,[]).append(a)
order=[edges[0][0]];prev=None
while True:
    c=order[-1];n=[x for x in nxt[c] if x!=prev]
    if not n or n[0]==order[0]:break
    prev=c;order.append(n[0])
poly=L[order].astype(np.int32)
H,W=1024,1024
m=np.zeros((H,W),np.uint8);cv2.fillPoly(m,[poly],255)
dist=cv2.distanceTransform(m,cv2.DIST_L2,5)
# 3. cut hole (inset 6px)
c=P2[F].mean(1)
pxc=612+sx*(c[:,0]-EX);pyc=206-(c[:,1]-0.8925)*sx
ix=np.clip(pxc.round().astype(int),0,W-1);iy=np.clip(pyc.round().astype(int),0,H-1)
cut=(dist[iy,ix]>6)&(c[:,2]>0.02)
print('cut',cut.sum())
Fn=F[~cut].astype(np.uint32)
s=re.sub(r"(export const idx = ')[^']*(')",lambda m:m.group(1)+base64.b64encode(Fn.tobytes()).decode()+m.group(2),s)
open('/downloads/karma3d_face/src/meshData.ts','w').write(s)
# 4. face mesh
Vc=np.array([[float(x) for x in l.split()[1:4]] for l in open('/tmp/r/canon.obj') if l.startswith('v ')])
T=np.load('/tmp/r/T.npy')
Cn=Vc.copy();Cn[:,1]*=-1
A=Cn[:,:2]-Cn[:,:2].mean(0);B=L-L.mean(0)
U_,S_,Vt=np.linalg.svd(A.T@B);sc=S_.sum()/(A**2).sum()
zc=(Cn[:,2]-Cn[:,2].mean())*sc/sx
X=(L[:,0]-612)/sx+EX;Yw=Yu(L[:,1])
# mesh front depth (deformed) smoothed
sel=(P2[:,2]>0.0)&(P2[:,1]>0.6)&(P2[:,1]<1.2)&(np.abs(P2[:,0])<0.25)
gx=np.linspace(-0.25,0.25,250);gy=np.linspace(0.6,1.2,300)
Z=np.full((300,250),np.nan)
ixx=np.clip(((P2[sel,0]+0.25)/0.5*249).astype(int),0,249);iyy=np.clip(((P2[sel,1]-0.6)/0.6*299).astype(int),0,299)
for a,b,z in zip(ixx,iyy,P2[sel,2]):
    if np.isnan(Z[b,a]) or z>Z[b,a]: Z[b,a]=z
mm=~np.isnan(Z);_,(i1,j1)=ndi.distance_transform_edt(~mm,return_indices=True);Z=Z[i1,j1];Zs=ndi.gaussian_filter(Z,6)
from scipy.interpolate import RegularGridInterpolator as R
f=R((gy,gx),Zs,bounds_error=False,fill_value=None)
zm=f(np.stack([Yw,X],1))
d=dist[np.clip(L[:,1].round().astype(int),0,H-1),np.clip(L[:,0].round().astype(int),0,W-1)]
ring=d<12
off=np.mean((zm-zc)[ring]);print('off',off)
wb=np.clip(d/16.0,0,1)
zf=(zc+off)*wb+zm*(1-wb)+0.003
pos=np.stack([X,Yw,zf],1).astype(np.float32)
# orientation: want normal +z
a=pos[T[:,1]]-pos[T[:,0]];b=pos[T[:,2]]-pos[T[:,0]]
nz=a[:,0]*b[:,1]-a[:,1]*b[:,0]
print('nz>0',(nz>0).mean())
if (nz>0).mean()<0.5: T=T[:,[0,2,1]]
# 5. texture crop + alpha
x0,y0=int(L[:,0].min())-8,int(L[:,1].min())-8;x1,y1=int(L[:,0].max())+8,int(L[:,1].max())+8
ph=cv2.cvtColor(cv2.imread('/downloads/karma_apose.png'),cv2.COLOR_BGR2RGB)
crop=ph[y0:y1,x0:x1]
al=np.clip((dist[y0:y1,x0:x1]-0)/7.0,0,1)
rgba=np.dstack([crop,(al*255).astype(np.uint8)])
ok,pngb=cv2.imencode('.png',cv2.cvtColor(rgba,cv2.COLOR_RGBA2BGRA))
cv2.imwrite('/tmp/w/face_tex.png',cv2.cvtColor(rgba,cv2.COLOR_RGBA2BGRA))
uv=np.stack([(L[:,0]-x0)/(x1-x0),(L[:,1]-y0)/(y1-y0)],1).astype(np.float32)
js="export const patchPos = '%s';\nexport const patchUV = '%s';\nexport const patchIdx = '%s';\nexport const patchTex = '%s';\n"%(base64.b64encode(pos.tobytes()).decode(),base64.b64encode(uv.tobytes()).decode(),base64.b64encode(T.astype(np.uint32).tobytes()).decode(),base64.b64encode(pngb.tobytes()).decode())
open('/downloads/karma3d_face/src/patchData.ts','w').write(js)
print('done',pos[:,2].min(),pos[:,2].max())
