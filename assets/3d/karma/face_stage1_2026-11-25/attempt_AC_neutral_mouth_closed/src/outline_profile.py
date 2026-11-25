import sys,os;sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
import panels as P
from rast import render
import numpy as np
from PIL import Image,ImageFilter
B=(-1.6,1.6,-1.8,0.7); S=300
def silmask(state,loader=P.loadM):
    V,C,T=loader(state); im=render(V,C,T,B,S,0,''); a=np.asarray(im.convert('RGB')).astype(int); return abs(a-30).sum(-1)>12
def prof(m,ys=(0.5,0.3,0,-0.25,-0.5,-0.75,-1.0,-1.25,-1.5)):
    o={}
    for y in ys:
        xs=np.where(m[int((B[3]-y)*S)])[0]; o[y]=(round(float(xs.min()/S+B[0]),2),round(float(xs.max()/S+B[0]),2)) if len(xs) else None
    return o
def overlay(m,keys=('stand','clasp'),col=(255,0,0)):
    e=np.asarray(Image.fromarray((m*255).astype('uint8')).filter(ImageFilter.FIND_EDGES))>60; outs=[]
    for k in keys:
        r=np.asarray(P.refcrop(k,box=B,S=S,grid=True).convert('RGB')).copy(); r[e]=col; outs.append(Image.fromarray(r))
    o=Image.new('RGB',(sum(i.width for i in outs),outs[0].height)); x=0
    for i in outs: o.paste(i,(x,0)); x+=i.width
    return o
if __name__=='__main__':
    m=silmask('smile'); print(prof(m)); overlay(m).save('/tmp/overlay2.png')
