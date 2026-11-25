import sys,os;sys.path.insert(0,os.path.dirname(os.path.abspath(__file__))); from cfg import *
import panels as P
import numpy as np
from PIL import Image
S=P.S; BOX=P.BOX
def skin(im):
    a=np.asarray(im.convert('RGB')).astype(float); r,g,b=a[...,0],a[...,1],a[...,2]
    mx=a.max(-1); mn=a.min(-1)
    return (r>120)&(r>g+8)&(g>b-5)&((mx-mn)>25)&(r<255)&(b>60)&~((r>200)&(b>150)&(g<150))
def widths(mask,ys):
    out={}
    for y in ys:
        row=int((BOX[3]-y)*S); m=mask[row]; 
        c=int(-BOX[0]*S); 
        if not m[c]: out[y]=None; continue
        l=c
        while l>0 and m[l-1]: l-=1
        r=c
        while r<len(m)-1 and m[r+1]: r+=1
        out[y]=(r-l)/S
    return out
ys=[0.3,0.0,-0.25,-0.5,-0.75,-1.0,-1.25]
res={}
for k in ('stand','wave','clasp'):
    im=P.refcrop(k,grid=False); mk=skin(im); res[k]=widths(mk,ys)
    Image.fromarray((mk*255).astype('uint8')).save(f'/tmp/mask_{k}.png')
print('ref skin-run width at levels (IPD units; hair/shadow can truncate)')
for y in ys: print(y,[None if res[k][y] is None else round(res[k][y],2) for k in res])
