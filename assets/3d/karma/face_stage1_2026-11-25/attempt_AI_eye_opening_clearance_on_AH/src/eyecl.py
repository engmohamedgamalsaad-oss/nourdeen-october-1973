import sys;sys.path.insert(0,'.')
import numpy as np
from load import load; from rast import render
from PIL import Image
def rot(V,deg):
    a=np.radians(deg); c,s=np.cos(a),np.sin(a); return V@np.array([[c,0,s],[0,1,0],[-s,0,c]]).T
def R(p,deg,box):
    V,C,I=load(p); V=V.astype(float); V[:,1]-=0.01; V=rot(V,deg)
    return render(V,C[:,:3].astype(float),I.reshape(-1,3).astype(int),box,700,0,'')
out=sys.argv[1]; ps=sys.argv[2:]
rows=[]
for deg,box in ((0,(-0.95,-0.05,-0.3,0.35)),(35,(-1.0,-0.05,-0.3,0.35))):
    ims=[R(p,deg,box) for p in ps]
    w=sum(i.width for i in ims); o=Image.new('RGB',(w,ims[0].height)); x=0
    for i in ims: o.paste(i,(x,0)); x+=i.width
    rows.append(o)
O=Image.new('RGB',(rows[0].width,rows[0].height*2)); O.paste(rows[0],(0,0)); O.paste(rows[1],(0,rows[0].height)); O.save(out)
