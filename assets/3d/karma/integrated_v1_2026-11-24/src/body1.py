import sys;sys.path.append('/tmp/w')
from load import P,UV,F,TEXIMG
import numpy as np,colorsys
import rend
T=np.array(TEXIMG);th,tw=T.shape[:2]
col=T[np.clip((UV[:,1]*th).astype(int),0,th-1),np.clip((UV[:,0]*tw).astype(int),0,tw-1)].astype(float)
lum=col.mean(1);mx=col.max(1);mn=col.min(1);sat=(mx-mn)/(mx+1)
print(P.shape,F.shape,th,tw)
dark=(lum<75)&(sat<0.5)
# hair: dark and above hips; denim is blue (b>r) so exclude
blue=col[:,2]>col[:,0]+10
hair=dark&~blue&(P[:,1]>0.42)
print('hair verts',hair.sum(),'of',len(P))
np.save('hairmask.npy',hair)
vc=col.copy();vc[hair]=[255,0,255]
parts=[dict(V=P,F=F,col=vc)]
from PIL import Image
ims=[rend.render(parts,S=520,R=0.58,cy=0.5,cx=0,yaw=y,light=(0.2,0.3,1)) for y in(0,3.1416)]
c=Image.new('RGB',(1040,520));[c.paste(m,(i*520,0)) for i,m in enumerate(ims)];c.save('body_hairmask.png')
