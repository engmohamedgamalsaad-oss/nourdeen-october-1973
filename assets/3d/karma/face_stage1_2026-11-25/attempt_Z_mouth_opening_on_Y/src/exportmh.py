import sys,json,hashlib;sys.path.insert(0,__import__('os').path.dirname(__import__('os').path.abspath(__file__))); from cfg import *
from fit import *
from glbio import write_glb
from load import load
d=json.load(open(SRC+'/fit_x.json')); ID_,EX_,x=d['ID'],d['EX'],np.array(d['x'])
nI=len(ID_); wid=x[:nI]; wex=x[nI:]
def export(P,path):
    Q=norm(P)
    g=lambda k: Q[LM[k]]
    cL=(g('EL_out')+g('EL_in'))/2; cR=(g('ER_out')+g('ER_in'))/2
    ipd=abs(cR[0]-cL[0]); ey=(g('EL_up')[1]+g('EL_lo')[1]+g('ER_up')[1]+g('ER_lo')[1])/4; cx=(cL[0]+cR[0])/2
    Qn=Q.copy(); Qn[:,0]=(Q[:,0]-cx)/ipd; Qn[:,1]=(Q[:,1]-ey)/ipd; Qn[:,2]=Q[:,2]/ipd
    Fq=F0[(Qn[F0][:,:,1]>-2.2).all(1)]
    T=np.r_[Fq[:,[0,1,2]],Fq[:,[0,2,3]]]
    used=np.unique(Fq); mp=-np.ones(len(Q),int); mp[used]=np.arange(len(used))
    Vn=Qn[used]; Tn=mp[T]
    C=np.tile(np.array([[232,176,150]]),(len(Vn),1))
    write_glb(path,Vn,C,Tn)
    return mp,len(Tn),len(Vn)
res={}
for nm,P in [('neutral',build(wid)),('smile',build(wid,wex))]:
    p=OUT+f'/karma_face_MH_{nm}_W.glb'
    mp,nt,nv=export(P,p); b=open(p,'rb').read()
    res[nm]=dict(path=p,bytes=len(b),tris=nt,verts=nv,sha256=hashlib.sha256(b).hexdigest())
    np.save(OUT+f'/map_{nm}.npy',mp)
print(json.dumps(res,indent=1))
json.dump(res,open(OUT+'/glb_info.json','w'))
