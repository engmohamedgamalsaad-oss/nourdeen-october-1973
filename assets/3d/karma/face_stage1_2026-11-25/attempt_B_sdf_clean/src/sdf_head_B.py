"""Karma stage1 face, attempt B. Authored SDF head, units = inter-pupil distance (IPD)=1, x right, y up, z forward.
Eye openings are cut into one continuous skin surface (lids are the cut margins), eyeballs sit behind. No separate lid shells."""
import numpy as np, sys
from skimage import measure
import trimesh
H=0.014
X=np.arange(-1.45,1.45+H,H,dtype=np.float32); Y=np.arange(-2.3,1.75+H,H,dtype=np.float32); Z=np.arange(-2.0,0.5+H,H,dtype=np.float32)
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
d=smin(d,ell((0,-1.38,-.6),(.3,.2,.24)),.12)                 # chin
d=smin(d,ell((0,-.9,-.42),(.52,.3,.46)),.18)                  # mouth-area fullness
# ---- nose: low child bridge, soft tip, small alae blended in
d=smin(d,cap((0,-.08,-.09),(0,-.5,.0),.06,.10),.12)
d=smin(d,sph((0,-.57,.05),.12),.10)
for s in(-1,1):
    d=smin(d,sph((s*.18,-.56,-.07),.085),.10)
    d=smax(d,-ell((s*.085,-.63,.13),(.045,.03,.07),rotY(s*25)),.02)   # nostrils
# ---- brow ridge (soft)
for s in(-1,1): d=smin(d,cap((s*.22,.38,-.1),(s*.78,.31,-.17),.04),.10)
# ---- eyes: almond openings cut through the skin; eyeball sits behind, lids are the cut margins
EX=.5
for s in(-1,1):
    dx=gx-s*EX
    half=.078*np.clip(1-(dx/.235)**2,0,1)**.7                     # lens half-height by x
    cy=.012+ .02*(1-np.abs(dx)/.235)*0 + (-.03*np.where(s*dx>0,s*dx/.235,0)*0)  # centre line (flat)
    f2=np.maximum(np.abs(gy-cy)-half, np.abs(dx)-.235)            # 2D almond (<0 inside)
    cutter=np.maximum(f2,-(gz+.27)).astype(np.float32)            # extruded forward of z=-0.27 (cuts ~0.1 into the skin)
    d=smax(d,-cutter,.03)
    eye=np.maximum(sph((s*EX,0,-.37),.21),f2-.015)               # eyeball clipped to the opening column
    d=smin(d,eye,.015)                           # eyeball (sclera/iris painted by texture, geometry is a sphere)
# ---- lips: soft ridges blended into the mouth area, mouth cavity between
mx=np.linspace(-.46,.46,25)
ym=lambda x:-1.0+.48*x**2
up_pts=[(x,ym(x)+.05*(1-abs(x)),-.02+.05*(1-abs(x)*1.2)) for x in mx]
lo_pts=[(x,ym(x)-.05*(1-abs(x)*1.2),-.03+.055*(1-abs(x)*1.2)) for x in mx]
d=smin(d,polyline(up_pts,lambda t:.06*np.sin(np.pi*t)**.5+.008,.03),.04)
d=smin(d,polyline(lo_pts,lambda t:.066*np.sin(np.pi*t)**.5+.008,.03),.05)
d=smax(d,-ell((0,-.985,.0),(.36,.03,.12)),.012)               # open-smile mouth cavity
d=smax(d,-polyline([(x,ym(x),.1) for x in mx],lambda t:.012,.01),.01)   # lip line carried to the corners
d=smax(d,-cap((0,-.76,.02),(0,-.86,-.02),.018),.02)          # philtrum
# ---- ears: shell + lobe + concha cavity, flared
for s in(-1,1):
    R=rotY(s*(-22))
    ear=ell((s*1.22,-.22,-.8),(.12,.43,.26),R)
    cav=ell((s*1.14,-.24,-.66),(.075,.28,.17),R)
    lobe=sph((s*1.2,-.6,-.78),.1)
    d=smin(d,smin(ear,lobe,.05),.08); d=smax(d,-cav,.03)
V,F,N,_=measure.marching_cubes(d,0.0,spacing=(H,H,H),allow_degenerate=False)
V+=np.array([X[0],Y[0],Z[0]],np.float32)
m=trimesh.Trimesh(V,F,process=True)
trimesh.smoothing.filter_taubin(m,iterations=10)
m.update_faces(m.nondegenerate_faces());m.remove_unreferenced_vertices()
import os
if os.environ.get('DECIMATE'):
    import fast_simplification as fs
    v2,f2=fs.simplify(np.asarray(m.vertices,np.float32),np.asarray(m.faces,np.int32),target_reduction=float(os.environ['DECIMATE']),agg=5)
    m=trimesh.Trimesh(v2,f2,process=True)
m.export('head_raw.ply'); print('verts',len(m.vertices),'tris',len(m.faces),'bounds',m.bounds.round(2).tolist())
