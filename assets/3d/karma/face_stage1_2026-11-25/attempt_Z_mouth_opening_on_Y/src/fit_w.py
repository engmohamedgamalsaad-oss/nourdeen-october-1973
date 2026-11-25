import sys,os,json
pass
sys.path.insert(0,os.getcwd())
from fit import *
Fq=F0
def nrm(Q):
    a=np.cross(Q[Fq[:,1]]-Q[Fq[:,0]],Q[Fq[:,2]]-Q[Fq[:,0]])+np.cross(Q[Fq[:,2]]-Q[Fq[:,0]],Q[Fq[:,3]]-Q[Fq[:,0]])
    ar=np.linalg.norm(a,axis=1); return a/ar[:,None],ar
P0=child_base(); Q0_=norm(P0); N0,A0=nrm(Q0_); c=Q0_[Fq].mean(1)
reg=(abs(c[:,0])<0.9)&(c[:,1]<-0.1)&(c[:,1]>-1.6)&(c[:,2]>0); front=reg&(N0[:,2]>0.3)
nI=len(ID);nE=len(EX)
def valid(Q,Nref,Aref,rmin):
    N,A=nrm(Q); dot=(N*Nref).sum(1)
    pen=np.maximum(0,0.5-dot[front])**2*4+np.maximum(0,rmin-A[front]/Aref[front])**2*4
    return pen
def metrics(x):
    wid=x[:nI];wex=x[nI:]; Pn=build(wid);Ps=build(wid,wex)
    Qn=norm(Pn);Qs=norm(Ps); Nn,An=nrm(Qn)
    pn=valid(Qn,N0,A0,0.35); ps=valid(Qs,Nn,An,0.45)  # smile judged vs the fitted neutral (the smile may only deform it moderately)
    return Pn,Ps,pn,ps,Qn,Qs,Nn,An
def resid(x,lam):
    Pn,Ps,pn,ps,*_=metrics(x); mn=landmarks(Pn); ms=landmarks(Ps)
    r=[(mn['eye_w_L']+mn['eye_w_R'])/2/REF['eye_w']-1,(mn['aper_L']+mn['aper_R'])/2/REF['aper']-1,
       mn['inner_gap']/REF['inner_gap']-1,mn['outer_span']/REF['outer_span']-1,mn['alar_w']/REF['alar_w']-1,
       mn['eye_sub']/REF['eye_sub']-1,mn['sub_chin']/REF['sub_chin']-1,mn['eye_chin']/REF['eye_chin']-1,
       ms['mouth_w']/REF['mouth_w']-1,ms['lip_h']/REF['lip_h']-1,ms['eye_mouthc']/REF['eye_mouthc']-1,0.6*(mn['face_w_mouth']/1.717-1)]
    return np.r_[np.array(r)*10,lam*x,np.sqrt(pn),np.sqrt(ps)]
if __name__=='__main__':
    lam=float(sys.argv[1]); tag=sys.argv[2]
    x0=np.zeros(nI+nE); x0[nI:]=0
    res=least_squares(resid,x0,bounds=(-1,1),diff_step=0.02,max_nfev=80,args=(lam,))
    x=res.x; Pn,Ps,pn,ps,Qn,Qs,Nn,An=metrics(x)
    N,A=nrm(Qs); dot=(N*Nn).sum(1)
    mn=landmarks(Pn);ms=landmarks(Ps)
    print(tag,'lam',lam,'cost',round(res.cost,4),'valid-pen neutral',round(pn.sum(),4),'smile',round(ps.sum(),4),
      'smile flips',int((front&(dot<0)).sum()),'minarea',round(float((A[front]/An[front]).min()),3))
    for k,ref in [('eye_w_L',.447),('aper_L',.1455),('alar_w',.676),('eye_sub',.687),('sub_chin',.847),('eye_chin',1.533)]: print(' N',k,round(mn[k],3),'ref',ref)
    for k in ('mouth_w','lip_h','eye_mouthc'): print(' S',k,round(ms[k],3),'ref',REF[k])
    print(' face_w_mouth',round(mn['face_w_mouth'],3),'cheek',round(mn['face_w_cheek'],3))
    print(' weights',{n:round(float(w),2) for n,w in zip(ID+EX,x) if abs(w)>.02})
    json.dump({'ID':ID,'EX':EX,'x':list(map(float,x))},open(SRC+'/fit_x_'+tag+'.json','w'))
