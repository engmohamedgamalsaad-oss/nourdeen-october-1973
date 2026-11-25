import sys,os,json;sys.path.insert(0,os.path.dirname(os.path.abspath(__file__))); from cfg import *
from fit import *
from mhr import mhrender
from PIL import Image
d=json.load(open(SRC+'/fit_x.json')); nI=len(d['ID']); x=np.array(d['x'])
dv=json.load(open(SRC+'/fit_x_V_original.json')); xv=np.array(dv['x'])
def im(P,t): return mhrender(P,(-0.75,0.75,-1.55,-0.35),520,t,wire=True,grid=0.25)
a=im(build(xv[:nI],xv[nI:]),'attempt V smile (folded loops)'); b=im(build(x[:nI],x[nI:]),'attempt W smile (validity-constrained)')
o=Image.new('RGB',(a.width+b.width,a.height)); o.paste(a,(0,0)); o.paste(b,(a.width,0)); o.save(OUT+'/evidence/smile_nose_mouth_wire_V_vs_W.png')
