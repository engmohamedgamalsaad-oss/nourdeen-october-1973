# attempt_AF: lid contour, nose tip/bridge smoothing+narrowing, mouth width reconciled to measured exported lips. Input = AE GLBs.
import sys,os,json;sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
import numpy as np
from load import load; from glbio import write_glb
from sculpt import adj,G,NSK
IN='/tmp/AE/out3/'
def run(state,P):
    V,C,I=load(IN+f'karma_face_MH_{state}_AE.glb'); V=V.astype(float).copy(); T=I.reshape(-1,3).astype(int)
    N=len(V); skin=np.arange(N)<NSK
    x=V[:,0]; y=V[:,1]-0.01; ax=np.abs(x); sg=np.sign(x)
    D=np.zeros_like(V)
    # nose: extra alar narrowing
    gn=G(ax,0.45)*G(y+0.55,0.22)*skin
    D[:,0]+=-P['nose_x']*x*gn
    # eyes: raise upper lid margin, define crease, extend outer corner
    for s in (-1,1):
        dx=x-s*0.5; r=np.hypot(dx,y)
        up=(y>0)
        gl=G(r,P['lid_r'])*skin
        D[:,1]+=P['lid_up']*gl*up*np.clip(1-ax*0+0,0,1)*G(dx,0.3)
        # crease groove above the lid: sink z in band y~.2, bulge lid z at y~.1
        D[:,2]+=(-P['crease']*G(y-P['crease_y'],0.04)+P['lidfull']*G(y-0.10,0.05))*G(dx,0.28)*skin
        # outer corner extension (outward = away from midline)
        outer=(dx*s>0)
        D[:,0]+=s*P['outer']*G(dx,0.18)*G(y,0.08)*skin*outer
    V1=V+D
    # nose tip/bridge relax: smooth alae/tip region only
    A=adj(T,N); deg=np.asarray(A.sum(1)).ravel()
    w=G(ax,0.42)*G(y+0.55,0.2)*skin*P['nose_relax']
    for _ in range(P['nose_iter']):
        avg=(A@V1)/np.maximum(deg,1)[:,None]; m=deg>0; V1[m]+=(avg[m]-V1[m])*w[m,None]
    # mouth width: scale x of whole mouth zone (lips, teeth, nearby skin); eyes not touched
    ym=V1[:,1]-0.01
    mouth=G(V1[:,0],0.75)*G(ym+0.97,0.32)*(np.arange(N)<16100)
    V1[:,0]*=1-P['mouth_w']*mouth
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
        V1,C,T,V0=run(s,P); write_glb(out+f'/karma_face_MH_{s}_AF.glb',V1,C,T.ravel()); rep[s]=checks(V0,V1,T); print(s,rep[s],'maxdisp',np.abs(V1-V0).max().round(3))
    json.dump(rep,open(out+'/normal_area_check_vs_AE.json','w'),indent=1)
