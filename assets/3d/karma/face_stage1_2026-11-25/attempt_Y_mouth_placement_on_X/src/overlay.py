import sys,os;sys.path.insert(0,os.path.dirname(os.path.abspath(__file__))); from cfg import *
import panels as P
from rast import render
import numpy as np
from PIL import Image,ImageDraw,ImageFilter
S=P.S;BOX=P.BOX
def sil(tag,state):
    V,C,T=P.loadM(state) if tag=='W' else None
    im=render(V,C,T,BOX,S,0.5,''); a=np.asarray(im.convert('RGB')).astype(int)
    m=(abs(a-np.array([30,30,30])).sum(-1)>40)  # not background
    return m
def edge(m):
    im=Image.fromarray((m*255).astype('uint8')); e=np.asarray(im.filter(ImageFilter.FIND_EDGES))>60; return e
def over(k,m,col):
    r=P.refcrop(k,grid=True).convert('RGB'); e=edge(m); a=np.asarray(r).copy(); a[e]=col; return Image.fromarray(a)
P.OUT=OUT
m=sil('W','smile'); 
ims=[over(k,m,(255,0,0)) for k in ('stand','wave','clasp')]
W=sum(i.width for i in ims); o=Image.new('RGB',(W,ims[0].height)); x=0
for i in ims: o.paste(i,(x,0)); x+=i.width
o.save('/tmp/overlay_W.png'); print(o.size)
