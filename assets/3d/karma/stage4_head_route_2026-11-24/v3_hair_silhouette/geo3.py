import numpy as np
from scipy.interpolate import griddata,LinearNDInterpolator
from geo import sphere,u,EYE_Y
ey=lambda k: EYE_Y-k*u
SKIN=np.array([246,196,168.])
def gauss2(P,cx,cy,sx,sy): return np.exp(-(((P[:,0]-cx)/sx)**2+((P[:,1]-cy)/sy)**2)/2)
def head(nl=170,nw=230):
    d,F=sphere(nl,nw)
    a,b,c=0.099,0.108,0.092;cy=0.815
    zz=np.where(d[:,2]>0,np.abs(d[:,2])**0.72,d[:,2])
    P=np.stack([d[:,0]*a,cy+d[:,1]*b,zz*c],-1)
    low=np.clip(-d[:,1],0,1);P[:,0]*=1-0.10*low**2;P[:,2]*=1-0.06*low**2
    N=d.copy()
    front=np.clip((d[:,2]-0.05)/0.45,0,1)**1.5
    def bump(cx,cy_,sx,h,sy=None):
        sy=sy or sx
        w=gauss2(P,cx,cy_,sx,sy)*front;P[:]=P+N*(h*w)[:,None]
    bump(0,ey(0.64),0.011,0.023)          # nose tip
    bump(0,ey(0.40),0.012,0.010,0.028)     # bridge
    for s in(-1,1):
        bump(s*0.30*u,ey(0.58),0.011,0.005) # nostril wings
        bump(s*0.84*u,ey(0.52),0.042,0.018,0.038) # round cheeks
        bump(s*0.50*u,ey(0.0),0.022,-0.004,0.016)
        bump(s*0.52*u,ey(0.20),0.020,-0.002,0.010)
        bump(s*0.50*u,ey(-0.32),0.020,0.003,0.008) # upper lid fold
        bump(s*0.70*u,ey(-0.55),0.022,0.004,0.010) # brow
    bump(0,ey(1.04),0.020,0.004,0.014)
    bump(0,ey(1.32),0.016,0.005)         # small round chin

    return P,F,d
def zf_factory(P,d):
    m=d[:,2]>0.1
    pts=P[m][:,:2];z=P[m][:,2]
    f=LinearNDInterpolator(pts,z)
    return lambda x,y: f(np.stack([np.atleast_1d(x),np.atleast_1d(y)],-1))
def tube(path,r,col,ns=8):
    path=np.asarray(path);n=len(path)
    T=np.gradient(path,axis=0);T/=np.linalg.norm(T,axis=1)[:,None]+1e-12
    ref=np.array([0,0,1.]);Nn=np.cross(T,ref);Nn/=np.linalg.norm(Nn,axis=1)[:,None]+1e-12;B=np.cross(T,Nn)
    rr=r if np.ndim(r)==1 else np.full(n,r)
    V=[];F=[]
    for i in range(n):
        for k in range(ns):
            an=2*np.pi*k/ns;V.append(path[i]+rr[i]*(np.cos(an)*Nn[i]+np.sin(an)*B[i]))
    for i in range(n-1):
        for k in range(ns):
            a=i*ns+k;b=i*ns+(k+1)%ns;c=(i+1)*ns+k;e=(i+1)*ns+(k+1)%ns;F+=[[a,b,c],[b,e,c]]
    V=np.array(V);return dict(V=V,F=np.array(F),col=np.tile(np.array(col,float),(len(V),1)))
def ellipsoid(c,r,col,nl=16,nw=24):
    D,F=sphere(nl,nw);V=D*np.array(r)+np.array(c);return dict(V=V,F=F,col=np.tile(np.array(col,float),(len(V),1)))
