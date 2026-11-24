import sys,re,base64;sys.path.insert(0,'/tmp/w')
from load import *
EX=-0.0125;sx=900
yp=np.array([345,282,254,206,109,0.]);Yv=np.array([0.66,0.749,0.817,0.8925,1.0,1.2])
c=P[F].mean(1)
pxx=612+sx*(c[:,0]-EX);pyy=np.interp(c[:,1],Yv,yp)
r=np.sqrt(((pxx-612)/92)**2+((pyy-215)/100)**2)
cut=(r<0.97)&(c[:,2]>0.02)
print(cut.sum(),len(F))
Fn=F[~cut].astype(np.uint32)
s=open('/downloads/karma3d_close/src/meshData.ts').read()
s=re.sub(r"(export const idx = ')[^']*(')",lambda m:m.group(1)+base64.b64encode(Fn.tobytes()).decode()+m.group(2),s)
open('/downloads/karma3d_face/src/meshData.ts','w').write(s)
