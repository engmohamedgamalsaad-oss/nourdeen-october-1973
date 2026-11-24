import numpy as np,geo,face,rend
from geo import u
from PIL import Image
P,F,d=geo.head()
parts=[dict(V=P,F=F,uv=face.uvmap(P),tex=face.paint())]
# eyes
def eyeball(cx,cyy,cz,r=0.0255,nl=36,nw=48):
    D,Fe=geo.sphere(nl,nw);V=D*r+np.array([cx,cyy,cz])
    ang=np.arccos(np.clip(D[:,2],-1,1));col=np.tile([250,248,244.],(len(D),1))
    ir=ang<0.78; col[ir]=[110,66,44]; col[ang<0.58]=[140,84,52]; col[ang<0.30]=[28,16,14]
    h=np.linalg.norm(D[:,[0,1]]-np.array([0.17,0.17]),axis=1)<0.10;col[h&(D[:,2]>0.9)]=[255,255,255]
    return dict(V=V,F=Fe,col=col)
for s in(-1,1):
    x=s*0.5*u
    # find head surface z at eye
    zs=P[(abs(P[:,0]-x)<0.004)&(abs(P[:,1]-geo.EYE_Y)<0.004)&(P[:,2]>0)][:,2].max()
    parts.append(eyeball(x,geo.EYE_Y,zs-0.016))
im=rend.render(parts,S=700,R=0.14,cy=0.82)
im.save('head_front_v1.png');print('done')
for nm,y in(('side',1.45),('q34',0.6)):
    rend.render(parts,S=500,R=0.14,cy=0.82,yaw=y).save(f'head_{nm}_v1.png')
