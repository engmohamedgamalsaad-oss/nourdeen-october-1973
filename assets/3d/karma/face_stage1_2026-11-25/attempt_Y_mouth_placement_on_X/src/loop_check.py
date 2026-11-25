# Post-export loop check: reads the exported GLBs (not the optimiser state) and counts front-region faces whose
# normal flips or collapses, relative to the unmodified child base (neutral) or the same attempt's neutral (smile).
import sys,os,json;sys.path.insert(0,os.path.dirname(os.path.abspath(__file__))); from cfg import *
from load import load
import numpy as np
def tris(path):
    V,C,I=load(path); return V.astype(float),I.reshape(-1,3).astype(int)
def nrm(V,T):
    a=np.cross(V[T[:,1]]-V[T[:,0]],V[T[:,2]]-V[T[:,0]]); ar=np.linalg.norm(a,axis=1)+1e-12; return a/ar[:,None],ar
def check(folder,tag):
    Vn,T=tris(folder+f'/karma_face_MH_neutral_{tag}.glb'); Vs,T2=tris(folder+f'/karma_face_MH_smile_{tag}.glb'); assert (T==T2).all()
    Nn,An=nrm(Vn,T); Ns,As=nrm(Vs,T)
    c=Vn[T].mean(1); reg=(abs(c[:,0])<0.9)&(c[:,1]<-0.1)&(c[:,1]>-1.6)&(c[:,2]>0)
    # base reference: same triangles, neutral of the child base is not in the GLB, so use the base via mh.py
    from mh import child_base; from mhr import norm
    from fit import LM
    mp=np.load(folder+'/map_neutral.npy'); keep=np.where(mp>=0)[0]
    Qb=norm(child_base()); Qb=Qb[keep]  # order = mp order
    ok=np.argsort(mp[keep]); Qb=Qb[ok]
    # re-centre like exportmh (same landmark normalisation)
    g=lambda k: norm(child_base())[LM[k]]
    cL=(g('EL_out')+g('EL_in'))/2; cR=(g('ER_out')+g('ER_in'))/2; ipd=abs(cR[0]-cL[0]); ey=(g('EL_up')[1]+g('EL_lo')[1]+g('ER_up')[1]+g('ER_lo')[1])/4; cx=(cL[0]+cR[0])/2
    Qb=np.c_[(Qb[:,0]-cx)/ipd,(Qb[:,1]-ey)/ipd,Qb[:,2]/ipd]
    Nb,Ab=nrm(Qb,T)
    front=reg&(Nb[:,2]>0.3)
    r={'front_region_tris':int(front.sum())}
    for nm,(N,A,N0,A0) in {'neutral_vs_child_base':(Nn,An,Nb,Ab),'smile_vs_own_neutral':(Ns,As,Nn,An)}.items():
        d=(N*N0).sum(1); rr=A/A0
        r[nm]={'flipped':int((front&(d<0)).sum()),'turned_over_60deg':int((front&(d<0.5)).sum()),'area_under_25pct':int((front&(rr<0.25)).sum()),'min_area_ratio':round(float(rr[front].min()),3)}
    return r
if __name__=='__main__':
    out={}
    for f,t in [(OUT,'Y')]: out[t]=check(f,t)
    print(json.dumps(out,indent=1)); json.dump(out,open(OUT+'/loop_check_from_GLB.json','w'),indent=1)
