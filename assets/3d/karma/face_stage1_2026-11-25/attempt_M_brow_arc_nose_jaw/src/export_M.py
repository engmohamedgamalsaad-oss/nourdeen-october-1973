"""Build the attempt J GLB from the committed sources only (no private reference photo, no landmark file).
Run order: python3 sdf_head_C.py (with DECIMATE=0.5) -> head_raw_M_'+EX+'.ply + parts.pkl, then python3 export_noprivate.py.
Colours are flat: skin tone, brown hair-cap placeholder, pink lips, dark mouth interior. No projected photo."""
import numpy as np, json, trimesh, pickle, os
from polyutil import poly_sdf
EX=os.environ.get('EXPR','smile'); CON=json.load(open('con_M_%s.json'%EX))
m=trimesh.load('head_raw_M_'+EX+'.ply')
for _ in range(1):
    c=m.vertices[m.faces].mean(1); sel=np.where((c[:,2]>-.5)&(((np.abs(c[:,0])>.2)&(np.abs(c[:,0])<.85)&(np.abs(c[:,1]+.0)<.3))|((np.abs(c[:,0])<.6)&(c[:,1]<-.7)&(c[:,1]>-1.3))))[0]
    v2,f2=trimesh.remesh.subdivide(m.vertices,m.faces,face_index=sel); m=trimesh.Trimesh(v2,f2,process=False)
V=np.array(m.vertices)
col=np.tile(np.array([232,176,150],np.float32),(len(V),1))
hm=np.zeros((len(V),1),np.float32)  # flat skin everywhere, no hair stage yet
col=col*(1-hm)+np.array([62,38,30],np.float32)*hm
def ss(x,w): return np.clip(0.5-x/(2*w),0,1)**2*(3-2*np.clip(0.5-x/(2*w),0,1)) if False else (lambda t:t*t*(3-2*t))(np.clip(0.5-x/(2*w),0,1))
def mix(col,c,w): col[:]=col*(1-w[:,None])+np.array(c,np.float32)*w[:,None]
zf=(V[:,2]>-.3).astype(np.float32)
for key,sg in(('eyeL',-1),('eyeR',1)):
    P_=np.array(CON[key]); cx=float(P_[:,0].mean())
    pe=poly_sdf(V[:,0],V[:,1],CON[key]); cyk=float(P_[:,1].mean())
    t=np.radians(-14*sg);cc,s_=np.cos(t),np.sin(t);Rm=np.array([[cc,0,s_],[0,1,0],[-s_,0,cc]])
    q=(V-np.array([cx,cyk,-.37]))@Rm.T
    en=np.sqrt((q[:,0]/.35)**2+(q[:,1]/.17)**2+(q[:,2]/.21)**2)
    q2=V-np.array([cx,0.0,-.37]); dn=np.sqrt((q2[:,0]/.125)**2+(q2[:,1]/.125)**2+(q2[:,2]/.225)**2)
    onball=np.maximum(ss(en-1.22,.06),ss(dn-1.3,.08))   # sclera colour only where the surface is the eyeball, not the flat backing
    w=ss(pe-.012,.01)*zf*onball
    mix(col,[238,234,228],w)
    rr=np.sqrt((V[:,0]-cx)**2+V[:,1]**2)/.117
    mix(col,[70,40,30],ss(rr-1,.05)*w); mix(col,[14,10,10],ss(rr-.40,.06)*w)
BR=np.array([(.26,.177),(.495,.222),(.698,.251),(.851,.217),(.945,.135)])
for sg in(-1,1):
    dm=np.full(len(V),9.0,np.float32); wd=np.zeros(len(V),np.float32)
    for i in range(4):
        p,q=BR[i]*[sg,1],BR[i+1]*[sg,1]; u=q-p; L2=u@u
        t=np.clip(((V[:,:2]-p)@u)/L2,0,1); pr=p+t[:,None]*u; dd=np.linalg.norm(V[:,:2]-pr,axis=1)
        wmax=.012+.016*np.sin(np.pi*np.clip((i+t)/4,0,1))
        mm=dd-wmax; dm=np.minimum(dm,mm)
    mix(col,[84,56,44],ss(dm,.008)*zf)
po=poly_sdf(V[:,0],V[:,1],CON['lipOuter']); pi_=poly_sdf(V[:,0],V[:,1],CON['lipInner'])
zl=(V[:,2]>-.2).astype(np.float32)
mix(col,[214,120,124],ss(po,.012)*ss(-pi_,.012)*zl)
mix(col,[96,34,40],ss(pi_,.008)*(V[:,2]<0))
m.visual.vertex_colors=np.concatenate([np.clip(col,0,255),np.full((len(V),1),255)],1).astype(np.uint8)
sc=trimesh.Scene(); sc.add_geometry(m,geom_name='head',node_name='head')
for nm,g in pickle.load(open('parts_M_%s.pkl'%EX,'rb')): sc.add_geometry(g,geom_name=nm,node_name=nm)
sc.export('karma_face_stage1_M_%s_EXPERIMENT.glb'%EX)
print('GLB',os.path.getsize('karma_face_stage1_M_%s_EXPERIMENT.glb'%EX),'head tris',len(m.faces),'total',sum(len(g.faces) for g in sc.geometry.values()))
