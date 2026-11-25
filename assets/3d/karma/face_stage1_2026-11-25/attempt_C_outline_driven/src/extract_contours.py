"""Derive contours.json (averaged, roll-corrected, IPD-normalised eye and lip outlines) from the 3 PRIVATE reference images.
Needs lm_<name>.npy files made by lm.py (MediaPipe face landmarker on the private images). contours.json is already committed, so this is only for provenance."""
import numpy as np, json
I={'eyeL':[33,246,161,160,159,158,157,173,133,155,154,153,145,144,163,7],
'eyeR':[263,466,388,387,386,385,384,398,362,382,381,380,374,373,390,249],
'lipOuter':[61,185,40,39,37,0,267,269,270,409,291,375,321,405,314,17,84,181,91,146],
'lipInner':[78,191,80,81,82,13,312,311,310,415,308,324,318,402,317,14,87,178,88,95]}
acc={k:[] for k in I}
for r in ['stand','wave','clasp']:
    L=np.load(f'lm_{r}.npy')[:,:2]
    pl,pr=L[468],L[473];v=pr-pl;a=np.arctan2(v[1],v[0]);c,s=np.cos(-a),np.sin(-a);R=np.array([[c,-s],[s,c]]);ipd=np.linalg.norm(v);mid=(pl+pr)/2
    for k,ix in I.items():
        q=(R@(L[ix]-mid).T).T/ipd; acc[k].append(np.stack([q[:,0],-q[:,1]],1))
json.dump({k:np.mean(v,0).round(4).tolist() for k,v in acc.items()},open('contours.json','w'))
