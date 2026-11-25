import sys,os;sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
from mh import *
from rast import *
from PIL import Image,ImageDraw
IPD0=0.50891667; EY0=3.42331667
def norm(P): 
    Q=P.copy(); Q[:,0]=P[:,0]/IPD0; Q[:,1]=(P[:,1]-EY0)/IPD0; Q[:,2]=(P[:,2]-0.875725)/IPD0; return Q
def mhrender(P,box,S,label='',wire=True,grid=0.05,ycut=None,side=False):
    Q=norm(P)
    if ycut is None: ycut=-2.2
    Fq=F0[(Q[F0][:,:,1]>ycut).all(1)]
    T=np.r_[Fq[:,[0,1,2]],Fq[:,[0,2,3]]]
    C=np.tile(np.array([[232,176,150]]),(len(Q),1)).astype(float)
    N=vnormals(Q,T)
    if side:
        R=lambda A: np.c_[A[:,2],A[:,1],-A[:,0]]
        Qr=R(Q);Nr=R(N)
    else: Qr=Q;Nr=N
    im=render(Qr,C,T,box,S,grid,label,N=Nr,zmin=-9,light=(0.3,0.2,1) if side else (0,.15,1))
    if wire:
        d=ImageDraw.Draw(im); x0,x1,y0,y1=box
        px=(Qr[:,0]-x0)*S; py=(y1-Qr[:,1])*S
        tn=np.cross(Qr[Fq[:,1]]-Qr[Fq[:,0]],Qr[Fq[:,2]]-Qr[Fq[:,0]])[:,2]
        for f in Fq[tn>0]:
            pts=[(px[i],py[i]) for i in f]
            if max(p[0] for p in pts)<0 or min(p[0] for p in pts)>im.width or max(p[1] for p in pts)<0 or min(p[1] for p in pts)>im.height: continue
            d.line(pts+[pts[0]],fill=(60,60,60),width=1)
    return im
