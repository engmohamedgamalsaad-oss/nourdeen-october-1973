# attempt_AI: push skin vertices that lie inside either eyeball sphere (opening region) out to just beyond the sphere surface.
import sys,os;sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
import numpy as np
from load import load; from glbio import write_glb
IN='/tmp/AE/out7/'; NSK=4268; R=0.300; MARG=0.015
def run(state):
    V,C,I=load(IN+f'karma_face_MH_{state}_AH.glb'); V=V.astype(float).copy(); T=I.reshape(-1,3).astype(int); n=0; mx=0
    for s in (-1,1):
        c=np.array([s*0.5,0.01,-0.03]); d=V[:NSK]-c; r=np.linalg.norm(d,axis=1)
        ang=np.degrees(np.arccos(np.clip(d[:,2]/np.maximum(r,1e-9),-1,1)))
        m=(r<R+MARG)&(ang<60)
        idx=np.where(m)[0]; n+=len(idx)
        new=c+d[idx]/r[idx,None]*(R+MARG); mx=max(mx,np.linalg.norm(new-V[idx],axis=1).max()); V[idx]=new
    return V,C,T,n,mx
if __name__=='__main__':
    out=sys.argv[1]; os.makedirs(out,exist_ok=True)
    for s in ('smile','neutral'):
        V,C,T,n,mx=run(s); write_glb(out+f'/karma_face_MH_{s}_AI.glb',V,C,T.ravel()); print(s,'moved verts',n,'max move',round(mx,4))
