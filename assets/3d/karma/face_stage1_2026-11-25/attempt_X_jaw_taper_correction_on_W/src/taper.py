# Attempt X: one smooth, monotone lateral taper of the lower face applied to the exported W GLBs (same vertex order).
# Profile s(y): x -> s(y)*x. y is in IPD units, eye line = 0 (same frame as the GLB).
# Targets come from the front outline of the 3 reference photos read on the pupil-aligned crops (by eye, about +-.05 IPD).
import sys,os;sys.path.insert(0,os.path.dirname(os.path.abspath(__file__))); from cfg import *
import numpy as np, struct, json
from scipy.interpolate import PchipInterpolator
from load import load
from glbio import write_glb
REFHALF={-0.75:1.03,-1.0:0.90,-1.25:0.67}          # reference half-width of the face outline (read by eye)
WHALF  ={-0.75:1.11,-1.0:0.98,-1.25:0.82}          # W front silhouette half-width measured from the W GLB render (outline_profile.py)
PTS=[(-0.55,1.0)]+[(y,REFHALF[y]/WHALF[y]) for y in (-0.75,-1.0,-1.25)]+[(-1.5,0.84),(-2.2,0.92)]
PTS=sorted(PTS)
SY=PchipInterpolator([p[0] for p in PTS],[p[1] for p in PTS],extrapolate=True)
def s_of(y): return np.where(y>-0.55,1.0,SY(np.clip(y,-2.2,-0.55)))
def wx(x):
    # weight 0 inside |x|<.45 (keeps mouth, nose and chin centre untouched), 1 beyond |x|>.8; smoothstep, keeps the map monotone in x
    t=np.clip((np.abs(x)-0.45)/0.35,0,1); return t*t*(3-2*t)
def run(src_tag='W',dst_tag='X'):
    for st in ('neutral','smile'):
        V,C,I=load(OUT+f'/../attempt_W_validity_constrained_fit_test/karma_face_MH_{st}_{src_tag}.glb'); V=V.astype(float); T=I.reshape(-1,3).astype(int)
        V2=V.copy(); V2[:,0]=V[:,0]*(1-(1-s_of(V[:,1]))*wx(V[:,0]))
        write_glb(OUT+f'/karma_face_MH_{st}_{dst_tag}.glb',V2,np.tile(np.array([[232,176,150]]),(len(V2),1)),T)
if __name__=='__main__':
    print([(round(y,2),round(float(s),3)) for y,s in PTS]); run()
