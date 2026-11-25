import numpy as np, json, trimesh, pickle, sys, os
from PIL import Image
from scipy.ndimage import map_coordinates
from polyutil import poly_sdf
CON=json.load(open('contours.json'))
m=trimesh.load('head_raw.ply'); V=np.array(m.vertices); N=np.array(m.vertex_normals)
ref='stand'; L=np.load('/tmp/f/lm_stand.npy'); P=lambda i:L[i][:2]
v=P(473)-P(468); a=np.arctan2(v[1],v[0]); ipd=np.linalg.norm(v); mid=(P(468)+P(473))/2; c,s=np.cos(a),np.sin(a)
img=np.array(Image.open('/tmp/f/crop_stand.png').convert('RGB')).astype(np.float32)
px=mid[0]+ipd*(c*V[:,0]+s*V[:,1]); py=mid[1]+ipd*(s*V[:,0]-c*V[:,1])
col=np.stack([map_coordinates(img[...,k],[py,px],order=1,mode='nearest') for k in range(3)],1)
skin=np.array([232,176,150],np.float32)
wf=np.clip((N[:,2]-0.05)/0.5,0,1)[:,None]; col=col*wf+skin*(1-wf)
hair=np.array([62,38,30],np.float32)
hm=np.maximum(np.clip((-V[:,2]-0.9)/0.5,0,1),np.clip((V[:,1]-1.0)/0.3,0,1))[:,None]; col=col*(1-hm)+hair*hm
# geometry-driven mouth colours (not photo): lips pink, mouth interior dark red
po=poly_sdf(V[:,0],V[:,1],CON['lipOuter']); pi_=poly_sdf(V[:,0],V[:,1],CON['lipInner'])
lip=(po<0.0)&(pi_>0.0)&(V[:,2]>-.2); cav=(pi_<0.0)&(V[:,2]<0.0)
col[lip]=np.array([214,120,124]); col[cav]=np.array([96,34,40])
# eye openings: skin-colour lids from the photo; nothing painted on the opening floor
m.visual.vertex_colors=np.concatenate([np.clip(col,0,255),np.full((len(V),1),255)],1).astype(np.uint8)
sc=trimesh.Scene(); sc.add_geometry(m,geom_name='head',node_name='head')
for nm,g in pickle.load(open('parts.pkl','rb')): sc.add_geometry(g,geom_name=nm,node_name=nm)
sc.export('karma_face_stage1_C.glb'); print('GLB',os.path.getsize('karma_face_stage1_C.glb'),'head tris',len(m.faces),'total tris',sum(len(g.faces) for g in sc.geometry.values()))
