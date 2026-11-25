"""Build the attempt F GLB from the committed sources only (no private reference photo, no landmark file).
Run order: python3 sdf_head_C.py (with DECIMATE=0.5) -> head_raw_F_'+EX+'.ply + parts.pkl, then python3 export_noprivate.py.
Colours are flat: skin tone, brown hair-cap placeholder, pink lips, dark mouth interior. No projected photo."""
import numpy as np, json, trimesh, pickle, os
from polyutil import poly_sdf
EX=os.environ.get('EXPR','smile'); CON=json.load(open('con_F_%s.json'%EX))
m=trimesh.load('head_raw_F_'+EX+'.ply')
for _ in range(2):
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
    pe=poly_sdf(V[:,0],V[:,1],CON[key]); w=ss(pe-.012,.01)*zf
    mix(col,[238,234,228],w)
    cyk=np.array(CON[key])[:,1].mean();rr=np.sqrt(((V[:,0]-sg*.5)/.22)**2+((V[:,1]-cyk)/.27)**2)
    mix(col,[70,40,30],ss(rr-1,.12)*w); mix(col,[14,10,10],ss(rr-.45,.08)*w)
po=poly_sdf(V[:,0],V[:,1],CON['lipOuter']); pi_=poly_sdf(V[:,0],V[:,1],CON['lipInner'])
zl=(V[:,2]>-.2).astype(np.float32)
mix(col,[214,120,124],ss(po,.012)*ss(-pi_,.012)*zl)
mix(col,[96,34,40],ss(pi_,.008)*(V[:,2]<0))
m.visual.vertex_colors=np.concatenate([np.clip(col,0,255),np.full((len(V),1),255)],1).astype(np.uint8)
sc=trimesh.Scene(); sc.add_geometry(m,geom_name='head',node_name='head')
for nm,g in pickle.load(open('parts_F_%s.pkl'%EX,'rb')): sc.add_geometry(g,geom_name=nm,node_name=nm)
sc.export('karma_face_stage1_F_%s_EXPERIMENT.glb'%EX)
print('GLB',os.path.getsize('karma_face_stage1_F_%s_EXPERIMENT.glb'%EX),'head tris',len(m.faces),'total',sum(len(g.faces) for g in sc.geometry.values()))
