import sys,json;sys.path.insert(0,__import__('os').path.dirname(__import__('os').path.abspath(__file__))); from cfg import *
from lm import *
from scipy.optimize import least_squares
body=np.zeros(len(V0),bool); body[sorted(G['body'])]=True
def snapt(x,y,tx,ty,zmin=0.1,Q=Q0):
    m=(abs(Q[:,0]-x)<tx)&(abs(Q[:,1]-y)<ty)&body&(Q[:,2]>zmin)
    ids=np.where(m)[0]; d=np.hypot(Q[ids,0]-x,Q[ids,1]-y); near=ids[d<=d.min()+0.004]
    return int(near[np.argmax(Q[near,2])])
def mirror(i,Q=Q0):
    m=body&(abs(Q[:,0]+Q[i,0])<0.01)&(abs(Q[:,1]-Q[i,1])<0.01)&(abs(Q[:,2]-Q[i,2])<0.01)
    ids=np.where(m)[0]; return int(ids[np.argmin(np.linalg.norm(Q[ids]-np.array([-Q[i,0],Q[i,1],Q[i,2]]),axis=1))])
LM={}
LM['EL_out']=18; LM['EL_in']=1077; LM['EL_up']=6756; LM['EL_lo']=1069
for k in('out','in','up','lo'): LM['ER_'+k]=mirror(LM['EL_'+k])
LM['alarL']=340; LM['alarR']=mirror(340); LM['sub']=317; LM['mL']=499; LM['mR']=mirror(499); LM['lipTop']=509; LM['lipBot']=5337
if __name__=='__main__':
    for k,i in LM.items(): print(k,i,np.round(Q0[i],3))

def tf(name): return name
# parameter table: name -> list of (file_when_positive, file_when_negative)
def LR(fmt,pos,neg): return [(fmt.format(s=s,p=pos),fmt.format(s=s,p=neg)) for s in ('l','r')]
PARAMS={
 'eye_scale':LR('eyes/{s}-eye-scale-{p}','incr','decr'),
 'eye_h1':LR('eyes/{s}-eye-height1-{p}','incr','decr'),'eye_h2':LR('eyes/{s}-eye-height2-{p}','incr','decr'),'eye_h3':LR('eyes/{s}-eye-height3-{p}','incr','decr'),
 'eye_c1':LR('eyes/{s}-eye-corner1-{p}','up','down'),'eye_c2':LR('eyes/{s}-eye-corner2-{p}','up','down'),
 'eye_tx':LR('eyes/{s}-eye-trans-{p}','out','in'),'eye_ty':LR('eyes/{s}-eye-trans-{p}','up','down'),
 'n_w1':[('nose/nose-width1-incr.target'.replace('.target',''),'nose/nose-width1-decr')],'n_w2':[('nose/nose-width2-incr','nose/nose-width2-decr')],'n_w3':[('nose/nose-width3-incr','nose/nose-width3-decr')],
 'n_nostril':[('nose/nose-nostrils-width-incr','nose/nose-nostrils-width-decr')],'n_flare':[('nose/nose-flaring-incr','nose/nose-flaring-decr')],
 'n_sh':[('nose/nose-scale-horiz-incr','nose/nose-scale-horiz-decr')],'n_sv':[('nose/nose-scale-vert-incr','nose/nose-scale-vert-decr')],'n_sd':[('nose/nose-scale-depth-incr','nose/nose-scale-depth-decr')],
 'n_ty':[('nose/nose-trans-up','nose/nose-trans-down')],'n_pw':[('nose/nose-point-width-incr','nose/nose-point-width-decr')],
 'm_sh':[('mouth/mouth-scale-horiz-incr','mouth/mouth-scale-horiz-decr')],'m_sv':[('mouth/mouth-scale-vert-incr','mouth/mouth-scale-vert-decr')],
 'm_ty':[('mouth/mouth-trans-up','mouth/mouth-trans-down')],'m_ulh':[('mouth/mouth-upperlip-height-incr','mouth/mouth-upperlip-height-decr')],'m_llh':[('mouth/mouth-lowerlip-height-incr','mouth/mouth-lowerlip-height-decr')],
 'm_ulv':[('mouth/mouth-upperlip-volume-incr','mouth/mouth-upperlip-volume-decr')],'m_llv':[('mouth/mouth-lowerlip-volume-incr','mouth/mouth-lowerlip-volume-decr')],
 'h_sv':[('head/head-scale-vert-incr','head/head-scale-vert-decr')],'h_sh':[('head/head-scale-horiz-incr','head/head-scale-horiz-decr')],
 'chin_h':[('chin/chin-height-incr','chin/chin-height-decr')],'chin_w':[('chin/chin-width-incr','chin/chin-width-decr')],
 'cheek_v':LR('cheek/{s}-cheek-volume-{p}','incr','decr'),'cheek_b':LR('cheek/{s}-cheek-bones-{p}','incr','decr'),
}
RACES=('african','asian','caucasian')
EXPR={'smile_pull':'mouth-corner-puller','smile_elev':'mouth-elevation','mouth_open':'mouth-open'}
ID=list(PARAMS); EX=list(EXPR)
def build(wid,wex=None):
    P=child_base()
    for n,w in zip(ID,wid):
        if w==0: continue
        for fp,fn in PARAMS[n]: apply(P,(fp if w>0 else fn)+'.target',abs(w))
    if wex is not None:
        for n,w in zip(EX,wex):
            if w==0: continue
            for r in RACES: apply(P,f'expression/units/{r}/{EXPR[n]}.target',w/3)
    return P
def landmarks(P):
    Q=norm(P); g=lambda k: Q[LM[k]]
    cL=(g('EL_out')+g('EL_in'))/2; cR=(g('ER_out')+g('ER_in'))/2
    ipd=abs(cR[0]-cL[0]); ey=(g('EL_up')[1]+g('EL_lo')[1]+g('ER_up')[1]+g('ER_lo')[1])/4
    m={}
    m['eye_w_L']=np.linalg.norm((g('EL_out')-g('EL_in'))[:2])/ipd
    m['eye_w_R']=np.linalg.norm((g('ER_out')-g('ER_in'))[:2])/ipd
    m['aper_L']=(g('EL_up')[1]-g('EL_lo')[1])/ipd; m['aper_R']=(g('ER_up')[1]-g('ER_lo')[1])/ipd
    m['inner_gap']=(g('ER_in')[0]-g('EL_in')[0])/ipd; m['outer_span']=(g('ER_out')[0]-g('EL_out')[0])/ipd
    m['alar_w']=(g('alarR')[0]-g('alarL')[0])/ipd
    m['eye_sub']=(ey-g('sub')[1])/ipd
    m['mouth_w']=(g('mR')[0]-g('mL')[0])/ipd
    m['lip_h']=(g('lipTop')[1]-g('lipBot')[1])/ipd
    m['eye_mouthc']=(ey-(g('lipTop')[1]+g('lipBot')[1])/2)/ipd
    # menton: lowest midline vertex with z >= lipTop z - .45
    mid=body&(abs(Q[:,0])<0.03)&(Q[:,1]<g('lipBot')[1])&(Q[:,1]>-2.4)&(Q[:,2]>=g('lipTop')[2]-0.45)
    ids=np.where(mid)[0]; mi=ids[np.argmin(Q[ids,1])]
    m['eye_chin']=(ey-Q[mi,1])/ipd; m['sub_chin']=(g('sub')[1]-Q[mi,1])/ipd
    # face width (front half, z>-0.5) at mouth-centre level, and at eye-line-0.5
    def width(y):
        k=body&(abs(Q[:,1]-y)<0.02*ipd)&(Q[:,2]>-0.5*ipd); return (Q[k,0].max()-Q[k,0].min())/ipd
    mc=(g('lipTop')[1]+g('lipBot')[1])/2
    m['face_w_mouth']=width(ey-0.95*ipd); m['face_w_cheek']=width(ey-0.5*ipd)
    m['_ipd']=ipd; m['_menton']=int(mi)
    return m
REF={'eye_w':.447,'aper':.1455,'inner_gap':.562,'outer_span':1.445,'alar_w':.676,'eye_sub':.687,'sub_chin':.847,'eye_chin':1.533,'eye_mouthc':.953,'mouth_w':.989,'lip_h':.317}
if __name__=='__main__':
    m=landmarks(child_base()); print({k:round(v,3) for k,v in m.items()})
