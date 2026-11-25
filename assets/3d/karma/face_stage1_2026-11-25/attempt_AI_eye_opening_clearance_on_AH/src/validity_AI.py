# Validity checks on the FINAL GLBs: (1) skin self-intersection (triangle-triangle, non-adjacent, welded by position),
# (2) eyeball triangles crossing skin triangles, (3) teeth strip triangles crossing skin triangles, (4) normal flips vs the child base
# are in the Z / X loop_check json files (skin unchanged since). Reports counts of intersecting triangle PAIRS; it is a numeric test,
# not a visual one, and it uses a small tolerance. Touching along shared mesh edges is excluded.
import sys,os,json;sys.path.insert(0,os.path.dirname(os.path.abspath(__file__))); from cfg import *
import numpy as np
from load import load
EPS=1e-7
def tri_edges_hit(VA,TA,VB,TB,ia,ib):
    # for pairs (ia[k],ib[k]): do edges of A pass through triangle B?
    hit=np.zeros(len(ia),bool)
    B0=VB[TB[ib,0]];B1=VB[TB[ib,1]];B2=VB[TB[ib,2]]
    n=np.cross(B1-B0,B2-B0)
    for e in ((0,1),(1,2),(2,0)):
        P=VA[TA[ia,e[0]]];Q=VA[TA[ia,e[1]]]; d=Q-P
        den=(n*d).sum(1); ok=abs(den)>1e-12
        t=np.where(ok,(n*(B0-P)).sum(1)/np.where(ok,den,1),-1)
        ins=ok&(t>EPS)&(t<1-EPS)
        X=P+t[:,None]*d
        def side(a,b): return (np.cross(b-a,X-a)*n).sum(1)
        inside=(side(B0,B1)>EPS)&(side(B1,B2)>EPS)&(side(B2,B0)>EPS)
        hit|=ins&inside
    return hit
def pairs(VA,TA,VB,TB,same,key=None):
    # grid broadphase on xy+z cells
    cell=0.06
    def bb(V,T): P=V[T]; return P.min(1),P.max(1)
    amin,amax=bb(VA,TA);bmin,bmax=bb(VB,TB)
    from collections import defaultdict
    g=defaultdict(list)
    for j in range(len(TB)):
        lo=np.floor(bmin[j]/cell).astype(int);hi=np.floor(bmax[j]/cell).astype(int)
        for x in range(lo[0],hi[0]+1):
            for y in range(lo[1],hi[1]+1):
                for z in range(lo[2],hi[2]+1): g[(x,y,z)].append(j)
    cand=set()
    for i in range(len(TA)):
        lo=np.floor(amin[i]/cell).astype(int);hi=np.floor(amax[i]/cell).astype(int)
        for x in range(lo[0],hi[0]+1):
            for y in range(lo[1],hi[1]+1):
                for z in range(lo[2],hi[2]+1):
                    for j in g.get((x,y,z),()):
                        if same and j<=i: continue
                        cand.add((i,j))
    cand=np.array(sorted(cand)); 
    if len(cand)==0: return []
    ia,ib=cand[:,0],cand[:,1]
    # real bbox overlap
    ov=(amin[ia]<=bmax[ib]+1e-9).all(1)&(bmin[ib]<=amax[ia]+1e-9).all(1); ia,ib=ia[ov],ib[ov]
    if key is not None:
        sh=np.array([len(set(key[TA[a]])&set(key[TB[b]]))>0 for a,b in zip(ia,ib)]); ia,ib=ia[~sh],ib[~sh]
    h=tri_edges_hit(VA,TA,VB,TB,ia,ib)|tri_edges_hit(VB,TB,VA,TA,ib,ia)
    return list(zip(ia[h].tolist(),ib[h].tolist()))
def run(state):
    V,C,I=load(OUT+f'/karma_face_MH_{state}_AI.glb'); V=V.astype(float); T=I.reshape(-1,3).astype(int)
    nskin=4268; skin=T[(T<nskin).all(1)]
    # eyeball tris: those using vertices 4268..(4268+2*97*60?) ; teeth: last 56 tris (smile) 
    eye_end=nskin+2*(96*61)
    eyeT=T[((T>=nskin)&(T<eye_end)).all(1)]; teethT=T[(T>=eye_end).all(1)] if len(V)>eye_end else np.zeros((0,3),int)
    key=np.round(V*1e5).astype(np.int64); key=np.array([hash(tuple(r)) for r in key])
    r={'skin_tris':len(skin),'eye_tris':len(eyeT),'teeth_tris':len(teethT)}
    r['skin_self_intersecting_pairs']=len(pairs(V,skin,V,skin,True,key))
    # eye vs skin: restrict skin to the eye region
    c=V[skin].mean(1); reg=skin[(abs(c[:,0])<0.9)&(abs(c[:,1])<0.35)]
    pe=pairs(V,eyeT,V,reg,False,key); r['eyeball_vs_skin_crossing_pairs']=len(pe)
    r['eyeball_skin_tris_crossed']=len(set(b for a,b in pe))
    if len(teethT):
        c=V[skin].mean(1); regm=skin[(abs(c[:,0])<0.7)&(c[:,1]<-0.6)&(c[:,1]>-1.3)]
        pt=pairs(V,teethT,V,regm,False,key); r['teeth_vs_skin_crossing_pairs']=len(pt)
    return r
if __name__=='__main__':
    out={s:run(s) for s in ('neutral','smile')}; print(json.dumps(out,indent=1)); json.dump(out,open(OUT+'/validity_final_GLBs.json','w'),indent=1)
