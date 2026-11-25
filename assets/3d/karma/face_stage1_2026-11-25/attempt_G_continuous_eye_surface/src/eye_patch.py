"""Karma stage1 face, attempt C (reference-outline-driven eyes and mouth). Authored SDF head, units = inter-pupil distance (IPD)=1, x right, y up, z forward.
Eye openings are cut into one continuous skin surface (lids are the cut margins), eyeballs sit behind. No separate lid shells."""
import numpy as np, sys
from skimage import measure
import trimesh, json
from polyutil import poly_sdf
CON=json.load(open('contours.json'))
import os
EXPR=os.environ.get('EXPR','smile')
for _k in('eyeL','eyeR'):   # reference eyes are rounder/taller than the landmark lid outline: open the aperture by 1.4 in height
    _P=np.array(CON[_k]);_cy=_P[:,1].mean();_P[:,1]=_cy+.01+(_P[:,1]-_cy)*1.4;CON[_k]=_P.tolist()
if EXPR=='neutral':
    # neutral mouth: corners a little lower, inner opening closed to a thin slit (no teeth)
    lo=np.array(CON['lipOuter']);li=np.array(CON['lipInner'])
    # true neutral: straight closed mouth, corners slightly down, shallower and narrower lower lip (the reference outlines are a smile U-shape)
    lo[:,0]*=.86; li[:,0]*=.86
    low=np.arange(len(lo))>=11
    lo[low,1]=-.88+(lo[low,1]+.88)*.5
    lo[~low,1]=-.84+(lo[~low,1]+.83)*.3
    # inner opening: flat thin slit
    up=np.arange(len(li))<=10
    li[:,1]=-.885+np.where(up,.008,-.008)*np.sign(1)
    li[(~up),1]=-.885-.008; li[up,1]=-.885+.008
    for P in(lo,li): P[:,1]-=.055*(np.abs(P[:,0])/.45)**2
    CON['lipOuter']=lo.tolist();CON['lipInner']=li.tolist()
H=0.008
X=np.arange(0.0,1.1+H,H,dtype=np.float32); Y=np.arange(-.5,.6+H,H,dtype=np.float32); Z=np.arange(-1.0,.3+H,H,dtype=np.float32)
gx=X[:,None,None]; gy=Y[None,:,None]; gz=Z[None,None,:]
def ell(c,r,R=None):
    p=[gx-c[0],gy-c[1],gz-c[2]]
    if R is not None: p=[R[i,0]*p[0]+R[i,1]*p[1]+R[i,2]*p[2] for i in range(3)]
    k0=np.sqrt((p[0]/r[0])**2+(p[1]/r[1])**2+(p[2]/r[2])**2)
    k1=np.sqrt((p[0]/r[0]**2)**2+(p[1]/r[1]**2)**2+(p[2]/r[2]**2)**2)
    return (k0*(k0-1)/np.maximum(k1,1e-6)).astype(np.float32)
def sph(c,r): return (np.sqrt((gx-c[0])**2+(gy-c[1])**2+(gz-c[2])**2)-r).astype(np.float32)
def cap(a,b,ra,rb=None):
    a=np.array(a,np.float32);b=np.array(b,np.float32);rb=ra if rb is None else rb
    ba=b-a;pa=[gx-a[0],gy-a[1],gz-a[2]]
    h=np.clip((pa[0]*ba[0]+pa[1]*ba[1]+pa[2]*ba[2])/ba.dot(ba),0,1)
    return (np.sqrt((pa[0]-ba[0]*h)**2+(pa[1]-ba[1]*h)**2+(pa[2]-ba[2]*h)**2)-(ra+(rb-ra)*h)).astype(np.float32)
def smin(a,b,k):
    h=np.clip(0.5+0.5*(b-a)/k,0,1); return (b*(1-h)+a*h-k*h*(1-h)).astype(np.float32)
def smax(a,b,k): return -smin(-a,-b,k)
def rotY(deg):
    t=np.radians(deg);c,s=np.cos(t),np.sin(t);return np.array([[c,0,s],[0,1,0],[-s,0,c]],np.float32)
def polyline(pts,ra,k=0.02):
    d=None
    for i in range(len(pts)-1):
        c=cap(pts[i],pts[i+1],ra(i/(len(pts)-1)),ra((i+1)/(len(pts)-1))); d=c if d is None else smin(d,c,k)
    return d

# ---- cranium, lower face, neck stub (cheek fullness comes from the lower-face ellipsoid, no separate cheek balls)
d=smin(ell((0,.35,-1.0),(1.12,1.18,1.0)), ell((0,-.79,-.85),(1.04,.75,.86)),.3)
d=smin(d,cap((0,-1.3,-.9),(0,-2.1,-.9),.55),.25)
d=smin(d,ell((0,-1.36,-.5),(.3,.2,.26)),.12)                 # chin
d=smin(d,ell((0,-.9,-.42),(.52,.3,.46)),.18)                  # mouth-area fullness
d=smin(d,ell((0,-1.2,-.4),(.42,.32,.4)),.15)                   # lower-lip/chin support so the lower lip is not a flap
# ---- nose: low child bridge, soft tip, small alae blended in
d=smin(d,cap((0,-.08,-.12),(0,-.5,-.02),.045,.078),.12)
d=smin(d,sph((0,-.57,.04),.105),.10)
for s in(-1,1):
    d=smin(d,sph((s*.17,-.56,-.07),.075),.10)
    d=smax(d,-ell((s*.085,-.63,.13),(.045,.03,.07),rotY(s*25)),.02)   # nostrils
# ---- brow ridge (soft)
for s in(-1,1):
    d=smin(d,cap((s*.25,.21,-.2),(s*.52,.27,-.2),.038),.12)
    d=smin(d,cap((s*.52,.27,-.2),(s*.85,.19,-.3),.038),.12)

# ---- cheek lift (apples) so the smile lifts the face
for s in(-1,1): d=smin(d,ell((s*.66,-.5 if EXPR=='smile' else -.56,-.45),(.2,.13,.18) if EXPR=='smile' else (.19,.12,.17)),.25)

def plane(poly): return poly_sdf(X[:,None],Y[None,:],poly)[:,:,None]
EYEMODE=os.environ.get('EYEMODE','old')
key='eyeR'; P=np.array(CON[key]); cy=P[:,1].mean(); cx=P[:,0].mean()
np.save('patch_dhead.npy',d)
A=plane(CON[key])
if EYEMODE=='old':
    cutter=np.maximum(A,-(gz+.27)).astype(np.float32)
    dpre=d.copy(); d=smax(d,-cutter,.008)
    d=np.minimum(d,np.maximum(ell((cx,0,-.43),(.30,.22,.28)),dpre-.02)).astype(np.float32)
elif EYEMODE=='blend':
    dpre=d.copy(); Ac=A.astype(np.float32)
    sm=lambda t:t*t*(3-2*np.clip(t,0,1))
    inside=np.clip(-Ac/.12,0,1); w=np.clip(0.5-Ac/.012,0,1)         # w: 1 in aperture, soft 0.012 ramp at margin
    dfill=dpre+.02-.05*sm(inside)                                      # eyeball surface: parallel to the skin, recessed .02 at the margin, convex .03 proud at centre
    lid=-.018*np.exp(-(np.maximum(Ac,0)/.04)**2)                        # lid thickening ring leading into the margin
    crease=.010*np.exp(-((Ac-.06)/.016)**2)*(gy>cy+.0)                  # soft upper-lid crease
    d=(dpre+lid+crease)*(1-w)+dfill*w
    d=d.astype(np.float32)
else:
    c=(cx,cy,-.40); T=.03
    E_in=ell(c,(.34,.25,.30)); E_lid=ell(c,(.34+T,.25+T,.30+T))
    d1=smin(d,E_lid,.05)                       # lid skin = offset shell of the eyeball, blended into the face
    cut=np.maximum(A,-(gz-c[2])).astype(np.float32)   # aperture prism, only in front of the eyeball centre plane
    d2=smax(d1,-cut,.012)                      # rounded lid margin where the lid shell meets the aperture
    d=np.minimum(d2,E_in).astype(np.float32)   # eyeball itself fills the aperture (continuous solid)
np.save('patch_d_%s.npy'%EYEMODE,d)
V,F,N,_=measure.marching_cubes(d,0.0,spacing=(H,H,H),allow_degenerate=False)
V+=np.array([X[0],Y[0],Z[0]],np.float32)
m=trimesh.Trimesh(V,F,process=True); trimesh.smoothing.filter_taubin(m,iterations=5)
Vv=np.array(m.vertices)
from polyutil import poly_sdf as ps
pe=ps(Vv[:,0],Vv[:,1],CON[key]); col=np.tile(np.array([232,176,150],np.float32),(len(Vv),1))
w=np.clip(0.5-(pe-.012)/.02,0,1)[:,None]*(Vv[:,2]>-.3)[:,None]; col=col*(1-w)+np.array([238,234,228],np.float32)*w
rr=np.sqrt(((Vv[:,0]-cx)/.22)**2+((Vv[:,1]-cy)/.27)**2)
w2=np.clip(0.5-(rr-1)/.24,0,1)[:,None]*w; col=col*(1-w2)+np.array([70,40,30],np.float32)*w2
w3=np.clip(0.5-(rr-.45)/.16,0,1)[:,None]*w; col=col*(1-w3)+np.array([14,10,10],np.float32)*w3
m.visual.vertex_colors=np.concatenate([col,np.full((len(Vv),1),255)],1).astype(np.uint8)
m.export('eye_%s.glb'%EYEMODE); print(EYEMODE,len(m.faces))
# cross-section through the eye centre (x=cx): y (up) vs z (front->right)
from PIL import Image
ix=int(round((cx-X[0])/H)); sl=d[ix]   # [y,z]
im=np.zeros(sl.shape+(3,),np.uint8); im[sl<0]=(200,170,150); im[np.abs(sl)<H*.6]=(0,0,0)
Image.fromarray(im[::-1].transpose(1,0,2)[:, :, :] if False else im[::-1]).resize((sl.shape[1]*4,sl.shape[0]*4),Image.NEAREST).save('section_%s.png'%EYEMODE)
