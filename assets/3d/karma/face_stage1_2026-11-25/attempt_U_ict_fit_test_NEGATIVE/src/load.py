import numpy as np,json,glob,os
D='/tmp/ict/FaceXModel/'
def rd(fn,faces=False):
    V=[];F=[]
    for l in open(fn):
        if l.startswith('v '): V.append(l.split()[1:4])
        elif faces and l.startswith('f '): F.append([int(t.split('/')[0])-1 for t in l.split()[1:]])
    return np.array(V,np.float32),F
V0,F=rd(D+'generic_neutral_mesh.obj',True)
import pickle
ids=np.stack([rd(D+'identity%03d.obj'%i)[0]-V0 for i in range(100)])
exn=['mouthSmile_L','mouthSmile_R','cheekRaiser_L','cheekRaiser_R','eyeSquint_L','eyeSquint_R','mouthUpperUp_L','mouthUpperUp_R','mouthStretch_L','mouthStretch_R','mouthDimple_L','mouthDimple_R','jawOpen','mouthPress_L','mouthPress_R','noseSneer_L','noseSneer_R','mouthLowerDown_L','mouthLowerDown_R','cheekSquint_L','cheekSquint_R']
ex=np.stack([rd(D+n+'.obj')[0]-V0 for n in exn])
pickle.dump(dict(V0=V0,F=F,ids=ids,ex=ex,exn=exn),open('ict.pkl','wb'))
print(V0.shape,ids.shape,ex.shape,np.abs(ids).max(),np.linalg.norm(ids.reshape(100,-1),axis=1)[:5])
