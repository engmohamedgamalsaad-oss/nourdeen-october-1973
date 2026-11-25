# attempt_AJ part 2: add a thin dark lash/lid-line ribbon along the eye-skin intersection curve (upper thicker). Input: lash.py output.
import sys,os;sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
import numpy as np
from load import load; from glbio import write_glb
NSK=4268; R=0.300
from rast import render
def curve_mask(V,T,c,R,S=1000):
    """visible eye-opening outline from a z-buffer render of eye(white) vs skin(black)."""
    col=np.zeros((len(V),3)); col[NSK:]=255
    box=(c[0]-0.40,c[0]+0.40,c[1]-0.30,c[1]+0.30)
    im=np.asarray(render(V,col,T,box,S,0,'')).astype(float)[:,:,0]
    # undo label/grid: threshold on bright pixels
    m=im>110
    from scipy import ndimage  # may be missing
    return m,box
def ribbon(V,T,C,P):
    V=V.copy(); newV=[];newC=[];newT=[];n0=len(V); info={}
    for s in (-1,1):
        c=np.array([s*0.5,0.01,-0.03]); S_=1000
        m,box=curve_mask(V,T,c,P['R'],S_)
        from scipy import ndimage
        m=ndimage.binary_opening(m,iterations=1); lab,nl=ndimage.label(m)
        sizes=ndimage.sum(m,lab,range(1,nl+1)); m=lab==(1+int(np.argmax(sizes)))
        edge=m&~ndimage.binary_erosion(m)
        ys,xs=np.nonzero(edge); cy,cx=ys.mean(),xs.mean()
        an=np.arctan2(-(ys-cy),xs-cx); rr=np.hypot(ys-cy,xs-cx)
        NB=48; b_=((an+np.pi)/(2*np.pi)*NB).astype(int)%NB; px=[];pa=[]
        for k_ in range(NB):
            ii=np.where(b_==k_)[0]
            if len(ii)==0: continue
            j=ii[np.argsort(rr[ii])[len(ii)//2]]
            px.append((xs[j],ys[j])); pa.append(an[j])
        px=np.array(px,float); pa=np.array(pa); o=np.argsort(pa); px=px[o]
        wx=box[0]+px[:,0]/S_; wy=box[3]-px[:,1]/S_
        rxy2=(wx-c[0])**2+(wy-c[1])**2; wz=c[2]+np.sqrt(np.maximum(P['R']**2-rxy2,1e-6))
        p=np.c_[wx,wy,wz]
        for _ in range(2): p=(np.roll(p,1,0)+2*p+np.roll(p,-1,0))/4
        ang=np.arctan2(p[:,1]-(wy.mean()),p[:,0]-(wx.mean()))
        info[s]=len(p)
        d=p-c; rad=np.linalg.norm(d,axis=1)
        axis=np.c_[d[:,0],d[:,1],np.zeros(len(p))]; axis/=np.maximum(np.linalg.norm(axis,axis=1),1e-9)[:,None]
        up=np.clip(np.sin(ang),-1,1)
        th=P['t_lo']+(P['t_up']-P['t_lo'])*np.clip((up+0.2)/1.2,0,1)
        inner=c+d/rad[:,None]*(P['R']+P['lift']); inner=inner+axis*P['ext']; inner=c+(inner-c)/np.linalg.norm(inner-c,axis=1)[:,None]*(P['R']+P['lift'])
        outer=inner-axis*(th[:,None]+P['ext']); outer=c+(outer-c)/np.linalg.norm(outer-c,axis=1)[:,None]*(P['R']+P['lift'])
        k=len(p); base=n0+len(newV)
        kk=np.clip((up+0.1)/0.9,0,1)[:,None]; cc_=np.array(P['col_lo'])*(1-kk)+np.array(P['col'])*kk
        newV+=list(inner)+list(outer); newC+=list(cc_)+list(cc_)
        for i in range(k):
            j=(i+1)%k
            a,b,cc,dd=base+i,base+j,base+k+i,base+k+j
            newT+=[[a,b,dd],[a,dd,cc],[a,dd,b],[a,cc,dd]][:2]+[[a,dd,b],[a,cc,dd]]  # double sided
    V2=np.r_[V,np.array(newV)]; C2=np.r_[C[:,:3],np.array(newC,'u1')]; T2=np.r_[T,np.array(newT)]
    return V2,C2,T2,info
P=dict(R=0.300,lift=0.006,ext=0.010,t_up=0.017,t_lo=0.008,col=[30,20,16],col_lo=[120,80,70])
if __name__=='__main__':
    inp,out=sys.argv[1],sys.argv[2]; os.makedirs(out,exist_ok=True)
    for s in ('smile','neutral'):
        V,C,I=load(inp+f'/karma_face_MH_{s}_AJ.glb'); V=V.astype(float); T=I.reshape(-1,3).astype(int)
        V2,C2,T2,info=ribbon(V,T,C,P); write_glb(out+f'/karma_face_MH_{s}_AJ.glb',V2,C2,T2.ravel()); print(s,info,len(V2)-len(V),'new verts')
