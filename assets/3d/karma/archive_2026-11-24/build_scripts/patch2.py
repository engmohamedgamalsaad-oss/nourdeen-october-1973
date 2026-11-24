import sys,json;sys.path.insert(0,'/tmp/w')
from load import *
from scipy import ndimage as ndi
EX=-0.0125;sx=900
yp=np.array([70,109,206,325,345,380.]);Yv=np.array([1.0433,1.0,0.8925,0.7603,0.66,0.62])
x0,x1,y0,y1=500,724,70,380
NX,NY=56,80
px=np.linspace(x0,x1,NX);py=np.linspace(y0,y1,NY)
PX,PY=np.meshgrid(px,py)
X=(PX-612)/sx+EX
Y=np.interp(-PY,-np.array([345,282,254,206,109,0.]),np.array([0.66,0.749,0.817,0.8925,1.0,1.2])) if False else np.interp(PY,yp,Yv)
# mesh front depth on a fine grid
sel=(P[:,2]>0.0)&(P[:,1]>0.6)&(P[:,1]<1.15)&(np.abs(P[:,0])<0.2)
gx=np.linspace(-0.2,0.2,200);gy=np.linspace(0.6,1.15,220)
Z=np.full((220,200),np.nan)
ix=np.clip(((P[sel,0]+0.2)/0.4*199).astype(int),0,199);iy=np.clip(((P[sel,1]-0.6)/0.55*219).astype(int),0,219)
for a,b,z in zip(ix,iy,P[sel,2]):
    if np.isnan(Z[b,a]) or z>Z[b,a]: Z[b,a]=z
m=~np.isnan(Z);d,(ii,jj)=ndi.distance_transform_edt(~m,return_indices=True);Z=Z[ii,jj]
Zs=ndi.gaussian_filter(Z,6)
from scipy.interpolate import RegularGridInterpolator as R
f=R((gy,gx),Zs,bounds_error=False,fill_value=None)
z=f(np.stack([Y.ravel(),X.ravel()],1)).reshape(Y.shape)+0.016
L=np.load('/tmp/w/lm_apose.npy')
from scipy.interpolate import griddata
from scipy.spatial import ConvexHull,Delaunay
zl=griddata(L[:,:2],-L[:,2],(PX,PY),method='linear')
inh=~np.isnan(zl)
zl=np.where(inh,zl,0)
zm=zl/900.0*1.0
din=ndi.distance_transform_edt(inh)
# calibrate offset on border ring
ring=inh&(din<=2.5)
c=np.mean((z-zm)[ring])
zf=zm+c
w=np.clip(din/10.0,0,1)*inh
z=z*(1-w)+zf*w
z=ndi.gaussian_filter(z,0.8)
# texture
ph=Image.open('/downloads/karma_apose.png').convert('RGB').crop((x0,y0,x1,y1))
w,h=ph.size
yy,xx=np.mgrid[0:h,0:w];cx,cy,rx,ry=612-x0,225-y0,112,150
r=np.sqrt(((xx-cx)/rx)**2+((yy-cy)/ry)**2)
al=np.clip((1-r)/0.2,0,1)
im=ph.convert('RGBA');a=np.array(im);a[...,3]=(al*255).astype(np.uint8)
Image.fromarray(a).save('/tmp/w/patch_tex.png')
import base64,io
b=io.BytesIO();Image.fromarray(a).save(b,'PNG',optimize=True)
pos=np.stack([X,Y,z],-1).astype(np.float32)
uv=np.stack([(PX-x0)/(x1-x0),(PY-y0)/(y1-y0)],-1).astype(np.float32)
js="export const patchN = [%d,%d];\nexport const patchPos = '%s';\nexport const patchUV = '%s';\nexport const patchTex = '%s';\n"%(NX,NY,base64.b64encode(pos.tobytes()).decode(),base64.b64encode(uv.tobytes()).decode(),base64.b64encode(b.getvalue()).decode())
open('/downloads/karma3d_face/src/patchData.ts','w').write(js);print(len(js),z.min(),z.max())
