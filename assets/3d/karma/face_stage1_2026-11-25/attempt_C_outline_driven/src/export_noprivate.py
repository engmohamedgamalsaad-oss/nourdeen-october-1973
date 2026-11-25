"""Build the attempt C GLB from the committed sources only (no private reference photo, no landmark file).
Run order: python3 sdf_head_C.py (with DECIMATE=0.5) -> head_raw.ply + parts.pkl, then python3 export_noprivate.py.
Colours are flat: skin tone, brown hair-cap placeholder, pink lips, dark mouth interior. No projected photo."""
import numpy as np, json, trimesh, pickle, os
from polyutil import poly_sdf
CON=json.load(open('contours.json'))
m=trimesh.load('head_raw.ply'); V=np.array(m.vertices)
col=np.tile(np.array([232,176,150],np.float32),(len(V),1))
hm=np.maximum(np.clip((-V[:,2]-0.9)/0.5,0,1),np.clip((V[:,1]-1.0)/0.3,0,1))[:,None]
col=col*(1-hm)+np.array([62,38,30],np.float32)*hm
po=poly_sdf(V[:,0],V[:,1],CON['lipOuter']); pi_=poly_sdf(V[:,0],V[:,1],CON['lipInner'])
col[(po<0)&(pi_>0)&(V[:,2]>-.2)]=[214,120,124]; col[(pi_<0)&(V[:,2]<0)]=[96,34,40]
m.visual.vertex_colors=np.concatenate([np.clip(col,0,255),np.full((len(V),1),255)],1).astype(np.uint8)
sc=trimesh.Scene(); sc.add_geometry(m,geom_name='head',node_name='head')
for nm,g in pickle.load(open('parts.pkl','rb')): sc.add_geometry(g,geom_name=nm,node_name=nm)
sc.export('karma_face_stage1_C_flatcolour.glb')
print('GLB',os.path.getsize('karma_face_stage1_C_flatcolour.glb'),'head tris',len(m.faces),'total',sum(len(g.faces) for g in sc.geometry.values()))
