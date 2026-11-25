# attempt_AG: nose bridge narrowing + tip projection reduction + lower-lip fullness. Input = AF GLBs.
import sys,os,json;sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
import numpy as np
from load import load; from glbio import write_glb
from sculpt import adj,G,NSK
IN='/tmp/AE/out6/'
def run(state,P):
    V,C,I=load(IN+f'karma_face_MH_{state}_AG.glb'); V=V.astype(float).copy(); T=I.reshape(-1,3).astype(int)
    N=len(V); skin=np.arange(N)<NSK
    x=V[:,0]; y=V[:,1]-0.01; ax=np.abs(x); sg=np.sign(x)
    D=np.zeros_like(V)
    # side-view fix: AD/AE/AG lips jut forward. Pull the lip/mouth zone back, more at the lower lip, and soften the chin-lip transition.
    zone=G(x,0.7)*G(y+1.02,0.2)*(np.arange(N)<16100)
    D[:,2]+=-P['lip_back']*zone
    chin=G(x,0.4)*G(y+1.35,0.15)*skin
    D[:,2]+=P['chin_fwd']*chin
    V1=V+D
    A=adj(T,N); deg=np.asarray(A.sum(1)).ravel()
    w=(G(x,0.6)*G(y+1.1,0.3)*skin)*P['relax']
    for _ in range(P['iters']):
        avg=(A@V1)/np.maximum(deg,1)[:,None]; m=deg>0; V1[m]+=(avg[m]-V1[m])*w[m,None]
    return V1,C,T,V
def checks(V0,V1,T):
    sk=T[(T<NSK).all(1)]
    def na(V):
        n=np.cross(V[sk[:,1]]-V[sk[:,0]],V[sk[:,2]]-V[sk[:,0]]); a=np.linalg.norm(n,axis=1); return n/np.maximum(a,1e-12)[:,None],a/2
    n0,a0=na(V0); n1,a1=na(V1); dot=(n0*n1).sum(1); r=a1/np.maximum(a0,1e-12)
    return {'skin_tris':int(len(sk)),'flipped_dot_lt_0':int((dot<0).sum()),'turn_over_60deg':int((dot<0.5).sum()),'area_ratio_min':float(r.min().round(3)),'area_lt_0.25':int((r<0.25).sum())}
if __name__=='__main__':
    P=json.load(open(sys.argv[1])); out=sys.argv[2]; os.makedirs(out,exist_ok=True); rep={}
    for s in ('smile','neutral'):
        V1,C,T,V0=run(s,P); write_glb(out+f'/karma_face_MH_{s}_AH.glb',V1,C,T.ravel()); rep[s]=checks(V0,V1,T); print(s,rep[s],'maxdisp',np.abs(V1-V0).max().round(3))
    json.dump(rep,open(out+'/normal_area_check_vs_AG.json','w'),indent=1)
