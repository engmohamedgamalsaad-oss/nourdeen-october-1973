# Attempt AC: a neutral that is not the smile with the mouth shut. The neutral skin is X's neutral (W fit + jaw taper only; no
# mouth stretch, no mouth shift, no lower-lip drop: those were fitted to the SMILE photos). Eyeballs as in AA. Lips coloured to a
# closed-lip outline from X's neutral landmarks (corners +-.43 at y -.935, top about -.878, bottom about -1.141). No teeth.
# The neutral is INFERRED, no photo shows a neutral face; depth of the eyeballs is estimated as in AA.
import sys,os;sys.path.insert(0,os.path.dirname(os.path.abspath(__file__))); from cfg import *
import numpy as np
from load import load
from glbio import write_glb
import eyeballs
LIP=np.array([206,124,128])
def lip_mask(V):
    x=V[:,0];y=V[:,1];z=V[:,2]
    u=np.clip(1-(x/0.46)**2,0,None)
    top=-0.935+0.06*u; bot=-0.935-0.21*u**0.8
    return (np.abs(x)<0.46)&(y<top)&(y>bot)&(z>0.35)
if __name__=='__main__':
    V,C,I=load(OUT+'/../attempt_X_jaw_taper_correction_on_W/karma_face_MH_neutral_X.glb'); V=V.astype(float); T=I.reshape(-1,3).astype(int)
    V2,C2,T2=eyeballs.add(V,T); C2=C2.astype(float).copy(); m=lip_mask(V2[:4268]); C2[:4268][m]=LIP
    write_glb(OUT+'/karma_face_MH_neutral_AC.glb',V2,C2,T2); print('neutral AC',len(V2),len(T2),int(m.sum()),'lip verts')
