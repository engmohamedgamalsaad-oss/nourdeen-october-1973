# Contact sheet of the final GLBs at front, 3/4 (45 deg) and side (90 deg), flat shading from the exported vertex colours.
import sys,os;sys.path.insert(0,os.path.dirname(os.path.abspath(__file__))); from cfg import *
import numpy as np
from load import load
from rast import render
from PIL import Image,ImageDraw
def rot(V,deg):
    a=np.radians(deg); c,s=np.cos(a),np.sin(a); R=np.array([[c,0,s],[0,1,0],[-s,0,c]]); return V@R.T
def sheet(state,fn):
    V,C,I=load(OUT+f'/karma_face_MH_{state}_AD.glb'); V=V.astype(float); T=I.reshape(-1,3).astype(int); C=C[:,:3].astype(float)
    ims=[]
    for deg in (0,45,90,-45):
        V2=rot(V,deg); ims.append(render(V2,C,T,(-1.4,1.4,-2.0,0.9),230,0,f'{state} yaw {deg}',zmin=-9))
    o=Image.new('RGB',(sum(i.width for i in ims),ims[0].height)); x=0
    for i in ims: o.paste(i,(x,0)); x+=i.width
    return o
a=sheet('neutral',0); b=sheet('smile',0)
o=Image.new('RGB',(a.width,a.height*2)); o.paste(a,(0,0)); o.paste(b,(0,a.height)); o.save(OUT+'/evidence/final_neutral_smile_front_34_side.png'); print(o.size)
