import sys,json;sys.path.insert(0,__import__('os').path.dirname(__import__('os').path.abspath(__file__))); from cfg import *
from load import load
from fit import LM
import numpy as np
def measure(path,mp):
    V,C,I=load(path); V=V.astype(float)
    g=lambda k: V[mp[LM[k]]]
    cL=(g('EL_out')+g('EL_in'))/2; cR=(g('ER_out')+g('ER_in'))/2; ipd=abs(cR[0]-cL[0]); ey=(g('EL_up')[1]+g('EL_lo')[1]+g('ER_up')[1]+g('ER_lo')[1])/4
    m={}
    m['eye_w']=(np.linalg.norm((g('EL_out')-g('EL_in'))[:2])+np.linalg.norm((g('ER_out')-g('ER_in'))[:2]))/2/ipd
    m['aper']=((g('EL_up')[1]-g('EL_lo')[1])+(g('ER_up')[1]-g('ER_lo')[1]))/2/ipd
    m['inner_gap']=(g('ER_in')[0]-g('EL_in')[0])/ipd; m['outer_span']=(g('ER_out')[0]-g('EL_out')[0])/ipd
    m['alar_w']=(g('alarR')[0]-g('alarL')[0])/ipd; m['eye_sub']=(ey-g('sub')[1])/ipd
    m['mouth_w']=(g('mR')[0]-g('mL')[0])/ipd; m['lip_h']=(g('lipTop')[1]-g('lipBot')[1])/ipd
    mc=(g('lipTop')[1]+g('lipBot')[1])/2; m['eye_mouthc']=(ey-mc)/ipd
    mid=(abs(V[:,0])<0.03*ipd)&(V[:,1]<g('lipBot')[1])&(V[:,2]>=g('lipTop')[2]-0.45*ipd)
    ids=np.where(mid)[0]; mi=ids[np.argmin(V[ids,1])]
    m['eye_chin']=(ey-V[mi,1])/ipd; m['sub_chin']=(g('sub')[1]-V[mi,1])/ipd
    def width(y):
        k=(abs(V[:,1]-y)<0.02*ipd)&(V[:,2]>-0.5*ipd); return (V[k,0].max()-V[k,0].min())/ipd
    m['face_w_y-0.95']=width(ey-0.95*ipd); m['face_w_y-0.5']=width(ey-0.5*ipd)
    m['ipd_in_glb_units']=ipd
    return {k:round(float(v),3) for k,v in m.items()}
if __name__=='__main__':
    out={}
    for nm in ('neutral','smile'):
        out[nm]=measure(OUT+f'/karma_face_MH_{nm}_W.glb',np.load(OUT+f'/map_{nm}.npy'))
        print(nm,out[nm])
    json.dump(out,open(OUT+'/MH_measured_from_GLB.json','w'),indent=1)
