# Attempt Y: smooth mouth width + mouth height placement applied to the exported X GLBs (same vertex order).
# Targets: smile mouth width .989 IPD and eye line to mouth centre .953 IPD (U-table reference); X smile has .919 and 1.004.
# Both maps are smooth and monotone (checked below), same map for neutral and smile.
import sys,os;sys.path.insert(0,os.path.dirname(os.path.abspath(__file__))); from cfg import *
import numpy as np
from load import load
from glbio import write_glb
DY=0.051; AX=0.075; YM=-1.0
def ss(t): t=np.clip(t,0,1); return t*t*(3-2*t)
def wy(y,full,zero): return 1-ss((np.abs(y-YM)-full)/(zero-full))
def wxx(x,full,zero): return 1-ss((np.abs(x)-full)/(zero-full))
def fwd(V):
    V2=V.copy(); x,y=V[:,0],V[:,1]
    w=wy(y,0.18,0.30)*wxx(x,0.7,1.0)             # mouth band, nose (y>-.78) and chin below -1.3 not moved
    V2[:,1]=y+DY*w
    w2=wy(y,0.2,0.32)*wxx(x,0.5,0.9)
    V2[:,0]=x*(1+AX*w2)
    return V2
def run():
    for st in ('neutral','smile'):
        V,C,I=load(OUT+f'/../attempt_X_jaw_taper_correction_on_W/karma_face_MH_{st}_X.glb'); V=V.astype(float); T=I.reshape(-1,3).astype(int)
        write_glb(OUT+f'/karma_face_MH_{st}_Y.glb',fwd(V),np.tile(np.array([[232,176,150]]),(len(V),1)),T)
def jac_check():
    g=np.linspace(-1.4,1.4,561); X,Y=np.meshgrid(g,np.linspace(-2.0,0.5,501)); V=np.c_[X.ravel(),Y.ravel(),np.zeros(X.size)]
    V2=fwd(V); n=X.shape
    px=V2[:,0].reshape(n);py=V2[:,1].reshape(n)
    dxdx=np.diff(px,axis=1)/np.diff(X,axis=1); dydy=np.diff(py,axis=0)/np.diff(Y,axis=0)
    return float(dxdx.min()),float(dydy.min())
if __name__=='__main__':
    print('min d(x)/dx, min d(y)/dy (must be >0):',jac_check()); run()
