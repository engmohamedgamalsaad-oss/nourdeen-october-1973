# attempt_AE: regional per-vertex sculpt on AD GLBs (cheeks, nasolabial relax, eyes, nose, lips), measured against pupil-aligned refs.
import sys,os;sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
import numpy as np
from load import load; from glbio import write_glb
AD='/tmp/repo/assets/3d/karma/face_stage1_2026-11-25/attempt_AD_consolidated_face_pass/'
NSK=4268
def G(d,s): return np.exp(-(d/s)**2)
def adj(T,n):
    from scipy.sparse import coo_matrix
    T=T[(T<NSK).all(1)]
    e=np.r_[T[:,[0,1]],T[:,[1,2]],T[:,[2,0]]]; e=np.r_[e,e[:,::-1]]
    A=coo_matrix((np.ones(len(e)),(e[:,0],e[:,1])),shape=(n,n)).tocsr(); A.data[:]=1; return A
def run(state,P):
    V,C,I=load(AD+f'karma_face_MH_{state}_AD.glb'); V=V.astype(float).copy(); C=C.copy(); T=I.reshape(-1,3).astype(int)
    x,y,z=V[:,0].copy(),V[:,1]-0.01,V[:,2].copy(); ax=np.abs(x); sg=np.sign(x)
    skin=np.arange(len(V))<NSK
    # 0. relax smile creases / hollow cheeks: Laplacian blend in cheek-mouth zone
    A=adj(T,len(V)); deg=np.asarray(A.sum(1)).ravel()
    w=(G(ax-0.8,0.35)*G(y+0.85,0.45))*skin*P['relax']
    for _ in range(P['relax_iter']):
        avg=(A@V)/np.maximum(deg,1)[:,None]; m=(deg>0)
        V[m]+= (avg[m]-V[m])*w[m,None]
    x,y,z=V[:,0].copy(),V[:,1]-0.01,V[:,2].copy()
    D=np.zeros_like(V)
    # 1. cheek fullness (round apple cheeks, fuller lower face)
    g=G(ax-0.85,0.32)*G(y+0.75,0.42)*skin
    D[:,2]+=P['cheek_z']*g; D[:,0]+=P['cheek_x']*g*sg
    # lower-face roundness: soft fill at jaw sides
    g2=G(ax-0.8,0.4)*G(y+1.25,0.3)*skin
    D[:,0]+=P['jaw_x']*g2*sg; D[:,2]+=P['jaw_z']*g2
    # 2. nose narrower at alae (x pull toward midline), tip slightly smaller
    gn=G(ax-0.0,0.5)*G(y+0.55,0.2)*skin
    D[:,0]+=-P['nose_x']*x*gn
    # 3. eyes: bigger, rounder aperture around each eye centre
    for s in (-1,1):
        dx=x-s*0.5; dy=y-0.0; r=np.hypot(dx/1.0,dy/1.0)
        ge=G(r,P['eye_r'])*skin*(r<0.5)
        D[:,0]+=P['eye_sx']*dx*ge; D[:,1]+=P['eye_sy']*np.where(dy>0,dy*1.0,dy*0.6)*ge
    # 4. mouth: narrower, lower, fuller lower lip, cupid bow (apply to lips+teeth, skin around mouth gets smooth field)
    mouth=G(x,0.75)*G(y+0.95,0.32)*(np.arange(len(V))<16100)  # whole mouth zone incl. teeth strip
    eye=(np.arange(len(V))>=NSK)&(C[:,:3]==(12,8,8)).all(1)
    D[:,0]+=-P['mouth_x']*x*mouth
    D[:,1]+=-P['mouth_dy']*mouth
    lowerlip=G(x,0.55)*G(y+1.08,0.14)*skin
    D[:,1]+=-P['lip_low_dy']*lowerlip; D[:,2]+=P['lip_low_z']*lowerlip
    # cupid bow on upper lip centre: raise at x=+-0.12, dip at 0 (lip-colour verts only)
    lipc=skin&((C[:,:3]==(214,120,128)).all(1)|(C[:,:3]==(206,124,128)).all(1))
    up=lipc&(y>-0.95+0.0)
    bow=(G(ax-0.13,0.07)-0.6*G(ax,0.05))*G(y+0.86,0.07)*up
    D[:,1]+=P['bow']*bow
    # no motion for eyeballs
    D[eye]=0
    Vn=V.copy(); Vn[:,:]+=D
    return Vn,C,T,V
if __name__=='__main__':
    import json
    P=json.load(open(sys.argv[1])); out=sys.argv[2]; os.makedirs(out,exist_ok=True)
    for s in ('smile','neutral'):
        Vn,C,T,V0=run(s,P); write_glb(out+f'/karma_face_MH_{s}_AE.glb',Vn,C,T.ravel()); print(s,'maxdisp',np.abs(Vn-V0).max())
