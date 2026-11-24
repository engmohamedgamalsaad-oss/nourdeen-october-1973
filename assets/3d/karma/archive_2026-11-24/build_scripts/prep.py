import trimesh, numpy as np, base64, fast_simplification as fs
from scipy.spatial import cKDTree
s=trimesh.load('karma.glb'); g=list(s.geometry.values())[0]
v=np.asarray(g.vertices); f=np.asarray(g.faces)
col=np.asarray(g.visual.to_color().vertex_colors)[:,:3]
nv,nf=fs.simplify(v.astype(np.float32),f.astype(np.int32),target_reduction=0.78)
print(nv.shape,nf.shape)
# color: average of 4 nearest orig verts
d,i=cKDTree(v).query(nv,k=4); nc=col[i].mean(axis=1).astype(np.uint8)
x,y,z=nv[:,0],nv[:,1],nv[:,2]
ss=lambda a,b,t:(lambda u:u*u*(3-2*u))(np.clip((t-a)/(b-a),0,1))
bright=nc.astype(float).sum(1); hair=(nc[:,0]<95)&(nc[:,1]<80)&(nc[:,2]<80)
Y=y+0.5
# bones: 0 hips,1 spine,2 head,3 lThigh,4 lShin,5 rThigh,6 rShin,7 lArm,8 lFore,9 rArm,10 rFore
W=np.zeros((len(nv),11))
head=ss(0.15,0.21,y)
side=np.sign(x); ax=np.abs(x)
armm=ss(0.10,0.17,ax)*(1-ss(0.13,0.19,y))*(y>-0.2)*(~hair)*(np.abs(z)<0.1)*(1-head)
leg=(1-ss(-0.07,0.0,y))*(1-armm)*(1-head)
lw=ss(-0.03,0.03,x)
kn=ss(0.17,0.29,Y)   # 0 below knee .. 1 above knee
elb=ss(0.38,0.52,Y)  # 0 forearm .. 1 upper arm
W[:,2]=head
W[:,7]=armm*(side<0)*elb; W[:,8]=armm*(side<0)*(1-elb)
W[:,9]=armm*(side>=0)*elb; W[:,10]=armm*(side>=0)*(1-elb)
W[:,3]=leg*(1-lw)*kn; W[:,4]=leg*(1-lw)*(1-kn)
W[:,5]=leg*lw*kn; W[:,6]=leg*lw*(1-kn)
rest=np.clip(1-W.sum(1),0,1)
sp=ss(-0.12,-0.03,y)
W[:,1]=rest*sp; W[:,0]=rest*(1-sp)
W/=W.sum(1,keepdims=True)
# top4
idx=np.argsort(-W,axis=1)[:,:4]; w4=np.take_along_axis(W,idx,1); w4/=w4.sum(1,keepdims=True)
P=(nv+np.array([0,0.5,0])).astype(np.float32)
pass
out={'pos':P.astype('<f4').tobytes(),'col':nc.tobytes(),'idx':nf.astype('<u4').tobytes(),'si':idx.astype('u1').tobytes(),'sw':(w4*255).round().astype('u1').tobytes()}
ts='// generated from the TRELLIS.2 mesh of Karma (decimated, vertex-colored)\n'
for k,b in out.items(): ts+=f"export const {k} = '{base64.b64encode(b).decode()}';\n"
ts+=f'export const NV = {len(nv)}, NF = {len(nf)};\n'
open('karma3d/src/meshData.ts','w').write(ts); print(len(ts)/1e6,'MB')
