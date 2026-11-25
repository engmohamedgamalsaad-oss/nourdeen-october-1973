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
json.dump(CON,open('con_F_%s.json'%EXPR,'w'))
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
def plane(poly): return poly_sdf(gx,gy,poly)[:, :, :1] if False else poly_sdf(X[:,None],Y[None,:],poly)[:,:,None]
# ---- eyes: openings follow the averaged reference eye outlines; eyeball is a separate mesh
dpre=d.copy()
for key in('eyeL','eyeR'):
    f2=plane(CON[key])
    cutter=np.maximum(f2,-(gz+.27)).astype(np.float32)
    d=smax(d,-cutter,.008)
# eye fill: an eyeball ellipsoid clipped to the pre-cut skin envelope (+0.02), so the opening is filled by a real curved eye surface, no hollow
for sg in(-1,1):
    d=np.minimum(d,np.maximum(ell((sg*.5,0,-.43),(.30,.22,.28)),dpre-.02)).astype(np.float32)
# ---- real lids: rounded lid margins along the aperture, plus an upper-lid crease groove, at the true skin height
_mask=(dpre<0); _zi=Z.size-1-np.argmax(_mask[:,:,::-1],axis=2); ZS=Z[_zi]   # front skin z for every (x,y)
def zsurf(x,y): return float(ZS[int(round((x-X[0])/H)),int(round((y-Y[0])/H))])
def dense(P,n=4):
    P=np.array(P+[P[0]]);out=[]
    for i in range(len(P)-1):
        for t in np.linspace(0,1,n,endpoint=False): out.append(P[i]*(1-t)+P[i+1]*t)
    out.append(P[0]);return np.array(out)
for key in('eyeL','eyeR'):
    P=dense(CON[key]); cy=np.array(CON[key])[:,1].mean()
    pts=[(x,y,zsurf(x,y)-.01) for x,y in P]
    d=smin(d,polyline(pts,lambda t:.021,.01),.025)                     # lid margin rim
    up=[(x,y+.05+.03*max(0,y-cy)/.1,zsurf(x,y+.05)-.0) for x,y in P if y>cy+.015]
    d=smax(d,-polyline(up,lambda t:.008,.01),.04)                      # upper lid crease
# ---- lips from the reference outer lip outline, soft rounded slab blended into the mouth area
def slab(p2,zc,t,r):
    wx=p2+r; wy=np.abs(gz-zc)-(t-r)
    return (np.minimum(np.maximum(wx,wy),0)+np.sqrt(np.maximum(wx,0)**2+np.maximum(wy,0)**2)-r).astype(np.float32)
po=plane(CON['lipOuter']); pi_=plane(CON['lipInner'])
d=smin(d,slab(po,-.07,.08,.05),.05)
# mouth opening (open smile) cut from the inner lip outline, deep pocket behind the lips
d=smax(d,-np.maximum(pi_,-(gz+.36)).astype(np.float32),.012)
d=smax(d,-cap((0,-.76,.02),(0,-.86,-.02),.018),.02)          # philtrum
# ---- ears with helix rim, antihelix ridge, concha, tragus, lobe
def ear_world(R,C,loc): return np.array(C)+R.T@np.array(loc,np.float32)
for s in(-1,1):
    R=rotY(s*(-22)); C=(s*1.2,-.22,-.8)
    d=smin(d,ell(C,(.045,.38,.24),R),.04)
    th=np.radians(np.linspace(-150,200,26))
    pts=[ear_world(R,C,(s*.02,.37*np.sin(t),.23*np.cos(t))) for t in th]
    d=smin(d,polyline(pts,lambda t:.04,.015),.03)                   # helix rim
    d=smin(d,cap(ear_world(R,C,(s*.03,.22,-.06)),ear_world(R,C,(s*.03,-.12,.02)),.028),.03)   # antihelix ridge
    d=smax(d,-ell(ear_world(R,C,(0,0,0))+0,(.05,.15,.09),R) if False else -ell(tuple(ear_world(R,C,(s*.05,-.05,.07))),(.05,.15,.09),R),.03)  # concha
    d=smin(d,sph(tuple(ear_world(R,C,(s*.03,-.1,.19))),.05),.03)    # tragus
    d=smin(d,ell(tuple(ear_world(R,C,(0,-.4,.0))),(.06,.1,.09),R),.05)   # lobe
V,F,N,_=measure.marching_cubes(d,0.0,spacing=(H,H,H),allow_degenerate=False)
V+=np.array([X[0],Y[0],Z[0]],np.float32)
m=trimesh.Trimesh(V,F,process=True)
trimesh.smoothing.filter_taubin(m,iterations=10)
m.update_faces(m.nondegenerate_faces());m.remove_unreferenced_vertices()
import os
if os.environ.get('DECIMATE'):
    import fast_simplification as fs
    v2,f2_=fs.simplify(np.asarray(m.vertices,np.float32),np.asarray(m.faces,np.int32),target_reduction=float(os.environ['DECIMATE']),agg=5)
    m=trimesh.Trimesh(v2,f2_,process=True)
m.export('head_raw_F_%s.ply'%EXPR)
# ---- eyeballs (separate meshes: sclera + iris + pupil) and teeth (separate meshes)
parts=[]
def colored(mesh,c): mesh.visual.vertex_colors=np.tile(np.array(list(c)+[255],np.uint8),(len(mesh.vertices),1)); return mesh
# teeth: rounded ellipsoids behind the lips, upper row under the upper-lip inner edge, lower row small
Pin=np.array(CON['lipInner']); 
def edge_y(x,upper):
    pts=Pin[:11] if upper else np.vstack([Pin[10:],Pin[:1]])
    o=np.argsort(pts[:,0]); return np.interp(x,pts[o,0],pts[o,1])
for upper,xs,w,h in(([] if EXPR=='neutral' else [(True,np.linspace(-.315,.315,7),.125,.115),(False,np.linspace(-.2,.2,5),.105,.06)])):
    for x in xs:
        y=edge_y(x,upper)+(-.05 if upper else .035)
        t=trimesh.creation.icosphere(3,1.0); t.apply_scale([w/2,h/2,.05]); t.apply_translation([x,y,-.13])
        parts.append((('teethU' if upper else 'teethL')+f'_{x:.2f}',colored(t,(246,244,236))))
import pickle; pickle.dump(parts,open('parts_F_%s.pkl'%EXPR,'wb'))
print('head verts',len(m.vertices),'tris',len(m.faces),'parts',len(parts),'bounds',m.bounds.round(2).tolist())
