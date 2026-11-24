import sys;sys.path.append('/tmp/w')
from load import P,UV,F,TEXIMG
import numpy as np,cv2,pickle
import rend
from PIL import Image
T=np.array(TEXIMG);th,tw=T.shape[:2]
hair=np.load('hairmask.npy')
# hair-triangle UV mask (any-hair triangles with >=2 hair verts)
hm=hair[F].sum(1)>=2
m=np.zeros((th,tw),np.uint8)
uvp=(UV*[tw,th]).astype(np.float32)
for t in np.where(hm)[0]:
    cv2.fillConvexPoly(m,(uvp[F[t]]).astype(np.int32),255)
# only dark texels inside mask (hair strands), keep pom-poms/bows/skin: restrict to dark non-blue
lum=T.mean(2);dark=(lum<95)&(T[:,:,2]<=T[:,:,0]+10)&~(T[:,:,2].astype(int)>T[:,:,1].astype(int)+8)
hsv=cv2.cvtColor(T,cv2.COLOR_RGB2HSV).astype(float);hue=hsv[:,:,0]*2;sat=hsv[:,:,1]/255
prot=((hue>235)&(hue<355)&(sat>0.18))|((T[:,:,0].astype(int)-T[:,:,1]>35)&(T[:,:,2].astype(int)>T[:,:,1]))
prot=cv2.dilate(prot.astype(np.uint8),np.ones((3,3),np.uint8))>0
sel=(m>0)&dark&~prot
print('texels recoloured',sel.sum())
# map luminance to brown ramp: 0->(40,25,20) 95->(98,48,32)
t_=np.clip(lum/95,0,1)[...,None]
lo=np.array([38,24,18.]);hi=np.array([105,52,34.])
brown=lo+(hi-lo)*t_
T2=T.copy().astype(float);s3=sel[...,None]
# soften edge with blurred mask
w=cv2.GaussianBlur(sel.astype(np.float32),(0,0),0.8)[...,None]
T2=T2*(1-w)+brown*w
T2=np.clip(T2,0,255).astype(np.uint8)
Image.fromarray(T2).save('body_tex_brownhair.png')
np.save('hm_tri.npy',hm)
# remove head skin: non-hair triangles with centroid y>0.665
cen=P[F].mean(1);cy=cen[:,1]
from scipy.spatial import cKDTree
head=pickle.load(open('parts_v3.pkl','rb'))
HV=np.concatenate([p['V'] for p in head]);tr=cKDTree(HV[::3])
dist,_=tr.query(cen)
ell=((cen[:,0]/0.099)**2+((cen[:,1]-0.815)/0.110)**2+(cen[:,2]/0.094)**2)
oldskin=(~hm)&(cy>0.665)&(hair[F].sum(1)==0)
facehit=(cy>0.69)&((~hm&((dist<0.0045)|(ell<0.92)))|((np.abs(cen[:,0])<0.088)&(cy<0.905)&(cen[:,2]>0.07)))
keep=~(oldskin|facehit)
print('removed tris',(~keep).sum())
UVr=UV.copy();UVr[:,1]=1-UVr[:,1]
body=dict(V=P,F=F[keep],uv=UVr,tex=Image.fromarray(T2))
pickle.dump((F[keep],),open('bodyF.pkl','wb'))
head=pickle.load(open('parts_v3.pkl','rb'))
for nm,parts in(('a_body',[body]),('b_with_head',[body]+head)):
    ims=[rend.render(parts,S=520,R=0.30,cy=0.84,cx=0,yaw=y,light=(0.2,0.3,1)) for y in(0,0.7,1.5708)]
    c=Image.new('RGB',(1560,520));[c.paste(mm,(i*520,0)) for i,mm in enumerate(ims)];c.save(f'body2_{nm}.png')
