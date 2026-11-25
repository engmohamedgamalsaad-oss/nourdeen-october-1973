import sys,json;sys.path.insert(0,'/tmp/m')
from fit import *
nI=len(ID);nE=len(EX)
def resid(x,lam=0.15):
    wid=x[:nI]; wex=x[nI:]
    mn=landmarks(build(wid)); ms=landmarks(build(wid,wex))
    r=[(mn['eye_w_L']+mn['eye_w_R'])/2/REF['eye_w']-1,(mn['aper_L']+mn['aper_R'])/2/REF['aper']-1,
       mn['inner_gap']/REF['inner_gap']-1,mn['outer_span']/REF['outer_span']-1,mn['alar_w']/REF['alar_w']-1,
       mn['eye_sub']/REF['eye_sub']-1,mn['sub_chin']/REF['sub_chin']-1,mn['eye_chin']/REF['eye_chin']-1,
       ms['mouth_w']/REF['mouth_w']-1,ms['lip_h']/REF['lip_h']-1,ms['eye_mouthc']/REF['eye_mouthc']-1,0.6*(mn['face_w_mouth']/1.717-1)]
    return np.r_[np.array(r)*10,lam*x]
x0=np.zeros(nI+nE)
res=least_squares(resid,x0,bounds=(-1,1),diff_step=0.02,max_nfev=60)
x=res.x
print('cost',res.cost,'nfev',res.nfev)
for n,w in zip(ID+EX,x):
    if abs(w)>1e-3: print(f'{n:12s} {w:+.3f}'+('  AT BOUND' if abs(w)>0.995 else ''))
wid=x[:nI];wex=x[nI:]
mn=landmarks(build(wid));ms=landmarks(build(wid,wex))
print('neutral',{k:round(float(v),3) for k,v in mn.items()}); print('smile',{k:round(float(v),3) for k,v in ms.items()})
json.dump({'ID':ID,'EX':EX,'x':list(map(float,x))},open('fit_x.json','w'))
