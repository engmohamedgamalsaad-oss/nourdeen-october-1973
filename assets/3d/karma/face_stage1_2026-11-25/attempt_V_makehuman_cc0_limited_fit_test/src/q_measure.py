import sys,json;sys.path.insert(0,__import__('os').path.dirname(__import__('os').path.abspath(__file__))); from cfg import *
from load import load
import numpy as np
D=REPO+'/assets/3d/karma/face_stage1_2026-11-25/attempt_Q_wider_eyes_lighter_nose_cheeks/'
# manual anatomical landmarks read off zoomed orthographic front renders of the Q GLB (grid in GLB units); x right, y up
A={'EL_out':(-.759,.002),'EL_in':(-.272,-.081),'EL_up':(-.514,.098),'EL_lo':(-.514,-.094),
   'ER_out':(.766,.002),'ER_in':(.278,-.069),'ER_up':(.52,.100),'ER_lo':(.52,-.091)}
M={'smile':dict(mL=(-.502,-.828),mR=(.486,-.820),top=-.822,bot=-1.153),'neutral':dict(mL=(-.439,-.906),mR=(.417,-.900),top=-.847,bot=-1.064)}
SUB_Y=-.74   # subnasale, from side silhouette render (nose underside meets upper lip)
MENT_Y_VIS=-1.52 # chin-bottom read off side silhouette render (+-.06)
cL=((A['EL_out'][0]+A['EL_in'][0])/2,(A['EL_out'][1]+A['EL_in'][1])/2); cR=((A['ER_out'][0]+A['ER_in'][0])/2,0)
ipd=cR[0]-cL[0]; ey=(A['EL_up'][1]+A['EL_lo'][1]+A['ER_up'][1]+A['ER_lo'][1])/4
n=lambda a,b: np.hypot(a[0]-b[0],a[1]-b[1])
out={'ipd_glb_units':round(ipd,4),'eye_line_y_glb_units':round(ey,4)}
base={'eye_w':round((n(A['EL_out'],A['EL_in'])+n(A['ER_out'],A['ER_in']))/2/ipd,3),
 'aper':round(((A['EL_up'][1]-A['EL_lo'][1])+(A['ER_up'][1]-A['ER_lo'][1]))/2/ipd,3),
 'inner_gap':round((A['ER_in'][0]-A['EL_in'][0])/ipd,3),'outer_span':round((A['ER_out'][0]-A['EL_out'][0])/ipd,3),
 'alar_w':None,'eye_sub':round((ey-SUB_Y)/ipd,3),'eye_chin_visual':round((ey-MENT_Y_VIS)/ipd,3),'sub_chin_visual':round((SUB_Y-MENT_Y_VIS)/ipd,3)}
for e in ('neutral','smile'):
    V,C,I=load(D+f'karma_face_stage1_Q_{e}_EXPERIMENT.glb'); V=V.astype(float)
    m=dict(base); mm=M[e]
    m['mouth_w']=round((mm['mR'][0]-mm['mL'][0])/ipd,3); m['lip_h']=round((mm['top']-mm['bot'])/ipd,3)
    m['eye_mouthc']=round((ey-(mm['top']+mm['bot'])/2)/ipd,3)
    def width(y):
        k=(abs(V[:,1]-y)<0.02*ipd)&(V[:,2]>-0.5*ipd); return round((V[k,0].max()-V[k,0].min())/ipd,3)
    m['face_w_y-0.95']=width(ey-0.95*ipd); m['face_w_y-0.5']=width(ey-0.5*ipd)
    # automatic menton by the same midline rule used for the MakeHuman GLB
    lt=(abs(V[:,0])<.03)&(abs(V[:,1]-mm['top'])<.02); ltz=V[lt,2].max()
    mid=(abs(V[:,0])<0.03*ipd)&(V[:,1]<mm['bot'])&(V[:,2]>=ltz-0.45*ipd)&(V[:,1]>-2.4)
    ids=np.where(mid)[0]; mi=ids[np.argmin(V[ids,1])]
    m['eye_chin_rule']=round((ey-V[mi,1])/ipd,3)
    out[e]=m
print(json.dumps(out,indent=1)); json.dump(out,open(OUT+'/Q_measured_from_GLB_renders.json','w'),indent=1)
