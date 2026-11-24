import cv2,numpy as np,mediapipe as mp,pickle
from geo3 import u,EYE_Y
from rend import render
from PIL import Image
im=cv2.imread('/downloads/karma_preserved_stage0/refs/image-c13b2b9f.jpg');H,W=im.shape[:2]
fm=mp.solutions.face_mesh.FaceMesh(static_image_mode=True,refine_landmarks=True,max_num_faces=1)
l=np.array([[p.x*W,p.y*H] for p in fm.process(cv2.cvtColor(im,cv2.COLOR_BGR2RGB)).multi_face_landmarks[0].landmark])
iL,iR=l[468],l[473];a=np.arctan2(iR[1]-iL[1],iR[0]-iL[0]);c=(iL+iR)/2;ipd=np.linalg.norm(iR-iL);ca,sa=np.cos(a),np.sin(a)
d=np.load('/tmp/dq/depth.npy');d=cv2.resize(d,(430,460))
full=np.zeros((H,W),np.float32);full[100:560,330:760]=d
parts=pickle.load(open('parts_v3.pkl','rb'));h=parts[0];V=h['V'].copy()
xm=V[:,0]/u*ipd;ym=-(V[:,1]-EYE_Y)/u*ipd
px=(c[0]+xm*ca-ym*sa).astype(np.float32);py=(c[1]+xm*sa+ym*ca).astype(np.float32)
n=len(px);side=300;pad=side*side*((n+side*side-1)//(side*side))
mx=np.zeros(pad,np.float32);my=np.zeros(pad,np.float32);mx[:n]=px;my[:n]=py
def samp(img):return cv2.remap(img,mx.reshape(-1,side),my.reshape(-1,side),cv2.INTER_LINEAR,borderMode=cv2.BORDER_REPLICATE).reshape(-1)[:n]
dn=full/ d.max()
res=dn-cv2.GaussianBlur(dn,(0,0),ipd*0.9)       # local relief only (nose, cheeks, brow ridge), large-scale shape stays mine
r=samp(cv2.GaussianBlur(res,(0,0),2.0))
x=V[:,0]/u;y=(V[:,1]-EYE_Y)/u
mask=np.clip((V[:,2]-0.01)/0.03,0,1)*np.clip((1.0-((x/1.0)**2+((y+0.35)/1.15)**2))/0.15,0,1)
nose=r[(np.abs(x)<0.15)&(np.abs(y+0.55)<0.25)].max();print('nose residual',nose)
k=0.014/nose;print('k',k)
V[:,2]+=k*r*mask
h2=dict(h);h2['V']=V;out=[h2]+parts[1:];pickle.dump(out,open('parts_dep1.pkl','wb'))
ims=[]
for nm,yw in(('front',0),('q34',0.7),('side',1.5708)):
    for lab,P in(('v3',parts),('dep',out)):
        ims.append(render(P,S=420,R=0.14,cy=0.82,yaw=yw,light=(0.5,0.3,1.0)))
cv=Image.new('RGB',(420*3,840))
for i,m in enumerate(ims):cv.paste(m,((i//2)*420,(i%2)*420))
cv.save('dep1_compare.png')
