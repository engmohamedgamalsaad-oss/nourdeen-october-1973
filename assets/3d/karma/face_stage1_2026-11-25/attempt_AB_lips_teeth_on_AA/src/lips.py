# Attempt AB: lip colour region, dark mouth interior and a teeth strip, on the AA GLBs (own geometry, flat colours, no asset file).
# Lip outline from the frontal photos (by eye, +-.03 IPD): corners (+-.49, -.83), outer top at centre about -.77, outer bottom at centre about -1.12.
# The smile opening is taken from the mesh (Z): upper edge at centre y -.837, lower edge -.954, corners -.825.
# Depth of the teeth strip is ESTIMATED (z .45, behind the lip edge ring at z .52 to .54).
import sys,os;sys.path.insert(0,os.path.dirname(os.path.abspath(__file__))); from cfg import *
import numpy as np
from load import load
from glbio import write_glb
LIP=np.array([214,120,128]); DARK=np.array([70,28,30]); TEETH=np.array([236,230,216])
def lip_mask(V):
    x=V[:,0];y=V[:,1];z=V[:,2]
    u=np.clip(1-(x/0.52)**2,0,None)
    top=-0.83+0.06*u; bot=-0.83-0.29*u**0.8
    return (np.abs(x)<0.52)&(y<top)&(y>bot)&(z>0.35)
def run(st):
    V,C,I=load(OUT+f'/../attempt_AA_eyeballs_on_Z/karma_face_MH_{st}_AA.glb'); V=V.astype(float); T=I.reshape(-1,3).astype(int); C=C[:,:3].astype(float).copy()
    nskin=4268
    m=lip_mask(V[:nskin]); C[:nskin][m]=LIP
    # teeth strip: a curved band behind the opening, from the Z opening edges
    xs=np.linspace(-0.42,0.42,29)
    s=np.clip(1-(xs/0.52)**2,0,1)
    yt=-0.828-0.009*s+0.0     # upper edge (lower edge of the upper lip)
    yb=-0.828-0.126*s**1.0    # lower edge of the opening (smile)
    if st=='neutral': yb=-0.828-0.09*s
    zt=0.46-0.06*(xs/0.42)**2
    rows=[]
    for k in range(3):
        f=k/2; rows.append(np.c_[xs,yt+(yb-yt)*f,zt])
    Vt=np.vstack(rows); Ct=np.tile(TEETH,(len(Vt),1)); Ct[:29]=TEETH*0.9
    Tt=[]
    for k in range(2):
        for i in range(28):
            a=k*29+i;b=a+1;c=a+29;d=c+1; Tt+=[[a,c,b],[b,c,d]]
    Tt=np.array(Tt)+len(V)
    V2=np.vstack([V,Vt]);C2=np.vstack([C,Ct]);T2=np.vstack([T,Tt])
    write_glb(OUT+f'/karma_face_MH_{st}_AB.glb',V2,C2,T2); print(st,int(m.sum()),'lip verts')
if __name__=='__main__':
    for st in ('neutral','smile'): run(st)
