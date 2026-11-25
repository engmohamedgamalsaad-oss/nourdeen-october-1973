# attempt_AJ: lash line + lid crease via vertex colour, small upper-lid fold bulge. Input AI GLBs.
import sys,os;sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
import numpy as np
from load import load; from glbio import write_glb
IN='/tmp/AE/out9/'; NSK=4268
def run(state,P):
    V,C,I=load(IN+f'karma_face_MH_{state}_AI.glb'); V=V.astype(float).copy(); C=C.copy(); T=I.reshape(-1,3).astype(int)
    cols=C[:,:3].astype(float); n=0
    for s in (-1,1):
        c=np.array([s*0.5,0.01,-0.03]); d=V[:NSK]-c; r=np.linalg.norm(d,axis=1)
        ang=np.degrees(np.arccos(np.clip(d[:,2]/np.maximum(r,1e-9),-1,1)))
        up=d[:,1]/np.maximum(np.hypot(d[:,0],d[:,1]),1e-9)   # +1 straight up around the eye axis
        near=r<0.42
        # lash line: at the opening rim (ang ~ 60), upper half strong, lower half weak
        w=np.clip((P['rr']-r)/0.012,0,1)*near*(ang<95)
        wu=w*np.clip((up+0.15)/1.15,0,1)*P['up']; wl=w*np.clip((-up+0.2)/1.2,0,1)*P['lo']
        a=np.clip(wu+wl,0,1)
        lash=np.array(P['lash'],float)
        cols[:NSK]=cols[:NSK]*(1-a[:,None])+lash*a[:,None]
        # crease: softer darker band above rim
        cw=np.exp(-((ang-P['crease'])/P['cw'])**2)*near*np.clip(up,0,1)*P['cr']
        cols[:NSK]=cols[:NSK]*(1-cw[:,None])+cols[:NSK]*cw[:,None]*0.78
        # upper lid descent: rotate upper-rim skin about the eye centre (x axis) downward, so the lid covers the top of the eyeball
        lw=np.clip((ang-P['d0'])/(P['d1']-P['d0']),0,1)*np.clip((95-ang)/15,0,1)*near*np.clip((up-0.1)/0.5,0,1)
        th=np.radians(P['drop'])*lw
        y=d[:,1]; z=d[:,2]; ny=y*np.cos(th)+z*np.sin(th)*0 - 0; 
        # rotation about x: positive th moves +y points toward +z? use sign so that y decreases
        ny=y*np.cos(th)-z*np.sin(th); nz=y*np.sin(th)+z*np.cos(th)
        # skip vertices that would end inside the sphere
        newd=np.c_[d[:,0],ny,nz]; ok=np.linalg.norm(newd,axis=1)>=0.0
        V[:NSK]=c+np.where(ok[:,None],newd,d)
        d=V[:NSK]-c
        # upper-lid fold: push outward along radial dir a little
        fw=np.exp(-((ang-P['fold_a'])/P['fold_w'])**2)*near*np.clip(up,0,1)*P['fold']
        V[:NSK]+= (d/np.maximum(r,1e-9)[:,None])*fw[:,None]; n+=int((a>0.1).sum())
    # eyeball: darken sclera toward the upper lid (lid shadow), colour only on eye vertices
    for s_ in (-1,1):
        c=np.array([s_*0.5,0.01,-0.03]); idx=np.arange(NSK,len(V)); d=V[idx]-c; m=np.linalg.norm(d,axis=1)<0.32
        ii=idx[m]; dd=V[ii]-c; yy=dd[:,1]/0.3; k=np.clip((yy-0.1)/0.7,0,1)*P['sh']
        cols[ii]=cols[ii]*(1-k[:,None]*0.55)+np.array([90,60,50.])*k[:,None]*0.55
    return V,np.c_[np.clip(cols,0,255).astype('u1'),C[:,3:]] if C.shape[1]>3 else np.clip(cols,0,255).astype('u1'),T,n
P=dict(rim=58,rw=5,up=1.0,lo=0.45,lash=[55,35,28],crease=78,cw=9,cr=0.0,fold_a=72,fold_w=9,fold=0.0,sh=0.9,rr=0.332,d0=35,d1=62,drop=0)
if __name__=='__main__':
    out=sys.argv[1]; os.makedirs(out,exist_ok=True)
    for s in ('smile','neutral'):
        V,C,T,n=run(s,P); write_glb(out+f'/karma_face_MH_{s}_AJ.glb',V,C[:,:3],T.ravel()); print(s,n)
