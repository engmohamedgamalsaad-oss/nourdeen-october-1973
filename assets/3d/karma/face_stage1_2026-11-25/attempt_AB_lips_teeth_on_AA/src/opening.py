# Attempt Z: open the mouth (interior form) on the exported Y GLBs, same vertex order.
# Frontal evidence (3 photos, read by eye, +-.03 IPD): opening between upper-lip lower edge and lower-lip upper edge at the centre
# about .11 IPD (y -0.87 to -0.98). Y has .082 (y -0.837 to -0.919). Test: lower lip, lower-lip edge move down by D with a smooth
# falloff; corners (|x|>.55) and everything above y -0.84 stay. Depth: z NOT changed (estimated, no depth measurement exists).
import sys,os;sys.path.insert(0,os.path.dirname(os.path.abspath(__file__))); from cfg import *
import numpy as np
from load import load
from glbio import write_glb
D=0.035
def ss(t): t=np.clip(t,0,1); return t*t*(3-2*t)
def fwd(V):
    V2=V.copy(); x,y=V[:,0],V[:,1]
    up=ss((-0.84-y)/0.06)                       # 0 above -0.84, 1 below -0.90
    down=1-ss((-1.0-y)/0.25)                    # 1 above -1.0, 0 at -1.25 and below
    wx=1-ss((np.abs(x)-0.25)/0.30)              # 1 for |x|<.25, 0 beyond .55
    V2[:,1]=y-D*up*down*wx
    return V2
def jac():
    g=np.linspace(-1,1,401); X,Y=np.meshgrid(g,np.linspace(-1.5,-0.5,401)); V=np.c_[X.ravel(),Y.ravel(),np.zeros(X.size)]
    py=fwd(V)[:,1].reshape(X.shape); return float((np.diff(py,axis=0)/np.diff(Y,axis=0)).min())
if __name__=='__main__':
    print('min dy\'/dy',jac())
    for st in ('neutral','smile'):
        V,C,I=load(OUT+f'/../attempt_Y_mouth_placement_on_X/karma_face_MH_{st}_Y.glb'); V=V.astype(float); T=I.reshape(-1,3).astype(int)
        write_glb(OUT+f'/karma_face_MH_{st}_Z.glb',fwd(V),np.tile(np.array([[232,176,150]]),(len(V),1)),T)
