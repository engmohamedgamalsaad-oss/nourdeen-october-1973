"""Karma stage1 face: authored SDF head. Units = inter-pupil distance (IPD)=1. x right, y up, z forward.
Proportions from MediaPipe landmarks measured on the 3 private reference images (metrics.json).
Features (nose, lids, lips, ears) are separate geometric primitives, not displacement."""
import numpy as np, json, sys
from skimage import measure
import trimesh

H=0.02  # grid step
X=np.arange(-1.7,1.7+H,H,dtype=np.float32); Y=np.arange(-2.35,2.0+H,H,dtype=np.float32); Z=np.arange(-2.2,1.0+H,H,dtype=np.float32)
gx,gy,gz=np.meshgrid(X,Y,Z,indexing='ij')
def ell(c,r,R=None):
    p=[gx-c[0],gy-c[1],gz-c[2]]
    if R is not None:
        p=[R[i,0]*p[0]+R[i,1]*p[1]+R[i,2]*p[2] for i in range(3)]
    k0=np.sqrt((p[0]/r[0])**2+(p[1]/r[1])**2+(p[2]/r[2])**2)
    k1=np.sqrt((p[0]/r[0]**2)**2+(p[1]/r[1]**2)**2+(p[2]/r[2]**2)**2)
    return (k0*(k0-1)/np.maximum(k1,1e-6)).astype(np.float32)
def sph(c,r): return (np.sqrt((gx-c[0])**2+(gy-c[1])**2+(gz-c[2])**2)-r).astype(np.float32)
def cap(a,b,ra,rb=None):
    a=np.array(a,np.float32);b=np.array(b,np.float32);rb=ra if rb is None else rb
    ba=b-a;pa=[gx-a[0],gy-a[1],gz-a[2]]
    h=np.clip((pa[0]*ba[0]+pa[1]*ba[1]+pa[2]*ba[2])/ba.dot(ba),0,1)
    d=np.sqrt((pa[0]-ba[0]*h)**2+(pa[1]-ba[1]*h)**2+(pa[2]-ba[2]*h)**2)
    return (d-(ra+(rb-ra)*h)).astype(np.float32)
def smin(a,b,k):
    h=np.clip(0.5+0.5*(b-a)/k,0,1); return (b*(1-h)+a*h-k*h*(1-h)).astype(np.float32)
def smax(a,b,k): return -smin(-a,-b,k)
def rotY(deg):
    t=np.radians(deg);c,s=np.cos(t),np.sin(t);return np.array([[c,0,s],[0,1,0],[-s,0,c]],np.float32)
def polyline(pts,ra,k=0.02):
    d=None
    for i in range(len(pts)-1):
        r0=ra(i/(len(pts)-1)); r1=ra((i+1)/(len(pts)-1))
        c=cap(pts[i],pts[i+1],r0,r1); d=c if d is None else smin(d,c,k)
    return d

# ---- base head
d=smin(ell((0,.35,-1.0),(1.12,1.18,1.0)), ell((0,-.79,-.85),(1.02,.75,.85)),.3)
for s in(-1,1): d=smin(d,sph((s*.7,-.68,-.5),.32),.2)           # full child cheeks
d=smin(d,cap((0,-1.3,-.9),(0,-2.1,-.9),.55),.25)                   # neck stub (stage3 rebuilds neck)
# chin: soft rounded
# ---- nose: bridge, tip, alae
d=smin(d,cap((0,-.05,-.08),(0,-.5,.10),.08,.13),.1)
d=smin(d,sph((0,-.58,.15),.165),.09)
for s in(-1,1):
    d=smin(d,sph((s*.2,-.54,.0),.135),.08)
for s in(-1,1):   # nostrils: subtract, slightly splayed
    d=smax(d,-ell((s*.1,-.67,.2),(.055,.035,.08)),.025)
# ---- brow ridge
for s in(-1,1): d=smin(d,cap((s*.22,.40,-.07),(s*.78,.33,-.14),.045),.08)
# ---- eyes + lids (eyeball under lids, opening between lid edges)
EX=.5
for s in(-1,1):
    c=(s*EX,0.0,-.17)
    # socket: gentle carve so lids sit in a recess
    eye=sph(c,.18)
    dx=(gx-s*EX)
    up=smax(ell((s*EX,.05,-.17),(.27,.16,.2)), -(gy-(.085-.9*dx**2)),.02)       # upper lid shell above edge curve
    lo=smax(ell((s*EX,-.035,-.17),(.25,.085,.17)),  (gy-(-.07+.8*dx**2)),.02)      # lower lid shell below edge curve
    d=smin(d,smin(eye,smin(up,lo,.02),.01),.06)
# ---- lips
mx=np.linspace(-.495,.495,25)
ym=lambda x:-1.0+.48*x**2
up_pts=[(x,ym(x)+.05*np.cos(x*3.0)*(1-abs(x)),-.045+.06*(1-abs(x)*1.3)) for x in mx]
lo_pts=[(x,ym(x)-.04*(1-abs(x)*1.4),-.05+.065*(1-abs(x)*1.3)) for x in mx]
d=smin(d,polyline(up_pts,lambda t:.06*np.sin(np.pi*t)**.8+.012,.03),.03)
d=smin(d,polyline(lo_pts,lambda t:.058*np.sin(np.pi*t)**.8+.012,.03),.03)
groove=polyline([(x,ym(x),.06) for x in mx],lambda t:.02,.01)
d=smax(d,-groove,.012)
d=smin(d,ell((0,-.93,-.42),(.5,.3,.46)),.15)
d=smin(d,ell((0,-1.38,-.62),(.3,.2,.26)),.12)  # chin  # soft mouth-area fullness
d=smax(d,-ell((0,-.985,.02),(.37,.055,.10)),.03)   # open-smile mouth cavity (teeth shown by texture)
# philtrum dent

# ---- ears (ellipsoid shell + conch cavity), flared outward
for s in(-1,1):
    R=rotY(s*(-22))
    ear=ell((s*1.2,-.25,-.78),(.11,.36,.21),R)
    cav=ell((s*1.13,-.27,-.66),(.07,.22,.14),R)
    lobe=sph((s*1.19,-.56,-.75),.085)
    d=smin(d,smin(ear,lobe,.05),.08); d=smax(d,-cav,.03)

# ---- mesh
V,F,N,_=measure.marching_cubes(d,0.0,spacing=(H,H,H),allow_degenerate=False)
V+=np.array([X[0],Y[0],Z[0]],np.float32)
m=trimesh.Trimesh(V,F,process=True)
trimesh.smoothing.filter_taubin(m,iterations=8)
m.update_faces(m.nondegenerate_faces());m.remove_unreferenced_vertices()
m.export('head_raw.ply'); print('verts',len(m.vertices),'tris',len(m.faces),'bounds',m.bounds.round(2).tolist())
