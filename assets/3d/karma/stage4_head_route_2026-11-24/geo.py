import numpy as np
u=0.0861; EYE_Y=0.831; CX=-0.0
def sphere(nl=90,nw=120):
    th=np.linspace(0,np.pi,nl);ph=np.linspace(-np.pi,np.pi,nw,endpoint=False)
    T,Ph=np.meshgrid(th,ph,indexing='ij')
    d=np.stack([np.sin(T)*np.sin(Ph),np.cos(T),np.sin(T)*np.cos(Ph)],-1).reshape(-1,3)  # +z front
    F=[]
    for i in range(nl-1):
        for j in range(nw):
            a=i*nw+j;b=i*nw+(j+1)%nw;c=(i+1)*nw+j;e=(i+1)*nw+(j+1)%nw
            F+= [[a,c,b],[b,c,e]]
    return d,np.array(F)
def g(P,c,s): return np.exp(-((P-np.array(c))**2).sum(-1)/(2*s*s))
def head():
    d,F=sphere()
    a,b,c=0.098,0.108,0.092;cy=0.815
    # lower half rounder: squash x toward chin
    P=np.stack([d[:,0]*a,cy+d[:,1]*b,d[:,2]*c],-1)
    low=np.clip(-d[:,1],0,1)
    P[:,0]*=1-0.10*low**2; P[:,2]*=1-0.05*low**2
    N=d.copy()
    def bump(cx,cy_,s,h,zc=None):
        # displacement along normal weighted by gaussian in (x,y) on front face
        w=np.exp(-(((P[:,0]-cx)**2+(P[:,1]-cy_)**2)/(2*s*s)))*(d[:,2]>0.1)
        P[:]=P+N*(h*w)[:,None]
    ey=lambda k: EYE_Y-k*u
    bump(0,ey(0.65),0.016,0.020)          # nose tip
    bump(0,ey(0.45),0.012,0.012)          # nose bridge
    bump(-0.0*u,ey(0.55),0.010,0.0)
    for s in(-1,1):
        bump(s*0.34*u,ey(0.54),0.010,0.009)  # nostril wings
        bump(s*0.82*u,ey(0.45),0.034,0.010)  # cheeks
        bump(s*0.5*u,ey(0.0),0.020,-0.006)   # eye socket
        bump(s*0.68*u,ey(-0.35),0.020,0.003) # brow ridge
        bump(s*0.50*u,ey(0.85),0.016,-0.003) # mouth corner dimple
    bump(0,ey(1.01),0.018,0.005)          # lower lip
    bump(0,ey(0.90),0.020,0.002)
    bump(0,ey(1.38),0.020,0.006)          # chin
    bump(0,ey(0.80),0.024,-0.003)         # philtrum/mouth area
    return P,F,d
