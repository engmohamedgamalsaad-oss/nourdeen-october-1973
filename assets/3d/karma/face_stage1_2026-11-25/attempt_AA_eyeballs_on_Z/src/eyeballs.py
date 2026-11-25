# Attempt AA: add two eyeballs behind the lid openings of the Z GLBs (own procedural geometry, no asset file, no photo texture).
# Placement from the reference photos (pupil-aligned crops, by eye, +-.03 IPD): iris centre at x=+-0.50, y=+0.02, iris radius about .115,
# pupil radius about .045. Colours are flat vertex colours chosen as dark brown / off-white (a colour choice, not a projection or sampling of pixels).
# Depth: estimated. Eyeball radius .30 IPD (eye width .44), centre z=-0.03 so the front pole is 0.27, behind the lid edge ring (z .21 to .31). No measurement of true depth exists.
import sys,os;sys.path.insert(0,os.path.dirname(os.path.abspath(__file__))); from cfg import *
import numpy as np
from load import load
from glbio import write_glb
R=0.30; CZ=-0.03; CY=0.01; CX=0.50
IRIS_R=0.125; PUP_R=0.05
SK=np.array([232,176,150]); SCL=np.array([238,232,224]); IRIS=np.array([84,52,36]); LIMB=np.array([48,30,22]); PUP=np.array([12,8,8])
def sphere(cx,nu=96,nv=60):
    V=[];C=[];T=[]
    for j in range(nv+1):
        th=np.pi*j/nv   # 0 at the front pole (+z)
        for i in range(nu):
            ph=2*np.pi*i/nu
            p=np.array([np.sin(th)*np.cos(ph),np.sin(th)*np.sin(ph),np.cos(th)])
            V.append([cx+R*p[0],CY+R*p[1],CZ+R*p[2]])
            d=R*np.arcsin(min(1,np.hypot(p[0],p[1])))*(1 if p[2]>0 else 9)   # arc distance from the gaze axis
            C.append(PUP if d<PUP_R else IRIS if d<IRIS_R-0.012 else LIMB if d<IRIS_R else SCL)
    for j in range(nv):
        for i in range(nu):
            a=j*nu+i; b=j*nu+(i+1)%nu; c=(j+1)*nu+i; d=(j+1)*nu+(i+1)%nu
            T+=[[a,c,b],[b,c,d]]
    return np.array(V),np.array(C),np.array(T)
def add(V,T):
    Vs=[V];Cs=[np.tile(SK,(len(V),1))];Ts=[T];off=len(V)
    for cx in (-CX,CX):
        v,c,t=sphere(cx); Vs.append(v);Cs.append(c);Ts.append(t+off);off+=len(v)
    return np.vstack(Vs),np.vstack(Cs),np.vstack(Ts)
if __name__=='__main__':
    for st in ('neutral','smile'):
        V,C,I=load(OUT+f'/../attempt_Z_mouth_opening_on_Y/karma_face_MH_{st}_Z.glb'); V=V.astype(float); T=I.reshape(-1,3).astype(int)
        V2,C2,T2=add(V,T); write_glb(OUT+f'/karma_face_MH_{st}_AA.glb',V2,C2,T2); print(st,len(V2),len(T2))
