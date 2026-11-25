"""Project the private front reference onto the authored head (orthographic, landmark-aligned) -> vertex colours -> GLB."""
import numpy as np, json, trimesh, sys
from PIL import Image
ref=sys.argv[1] if len(sys.argv)>1 else 'stand'
paths={'stand':'/downloads/image-de4a722b.jpg','wave':'/downloads/image-0b5b46c1.jpg','clasp':'/downloads/image-89132d01.jpg'}
m=trimesh.load('head_raw.ply'); V=np.array(m.vertices); N=np.array(m.vertex_normals)
L=np.load(f'/tmp/f/lm_{ref}.npy')  # crop px (2x upscaled crop)
I=dict(pupL=468,pupR=473)
P=lambda n:L[I[n]][:2]
v=P('pupR')-P('pupL'); a=np.arctan2(v[1],v[0]); ipd=np.linalg.norm(v); mid=(P('pupL')+P('pupR'))/2
c,s=np.cos(a),np.sin(a)   # image = mid + ipd*Rot(a)*(x,-y)
img=np.array(Image.open(f'/tmp/f/crop_{ref}.png').convert('RGB')).astype(np.float32)
uv=np.stack([V[:,0],-V[:,1]],1)
px=mid[0]+ipd*(c*uv[:,0]-s*uv[:,1]); py=mid[1]+ipd*(s*uv[:,0]+c*uv[:,1])
h,w=img.shape[:2]
from scipy.ndimage import map_coordinates
col=np.stack([map_coordinates(img[...,k],[py,px],order=1,mode='nearest') for k in range(3)],1)
skin=np.array([232,176,150],np.float32)
w_front=np.clip((N[:,2]-0.05)/0.5,0,1)[:,None]
# yaw/tilt: the reference is slightly rotated; fine for stage-1 proof
col=col*w_front+skin*(1-w_front)
# back/top cap: dark hair brown placeholder (stage 2 builds real hair)
hairc=np.array([62,38,30],np.float32)
back=np.clip((-V[:,2]-0.9)/0.5,0,1)[:,None]
top=np.clip((V[:,1]-1.0)/0.3,0,1)[:,None]
hm=np.maximum(back,top); col=col*(1-hm)+hairc*hm
rgba=np.concatenate([np.clip(col,0,255),np.full((len(V),1),255)],1).astype(np.uint8)
m.visual.vertex_colors=rgba
# scale: IPD unit -> metres (child IPD ~0.052 m), keep head origin at pupils
m2=m.copy(); 
m2.export(f'karma_face_stage1_{ref}.glb'); import os
print(ref,'GLB bytes',os.path.getsize(f'karma_face_stage1_{ref}.glb'),'tris',len(m2.faces))
