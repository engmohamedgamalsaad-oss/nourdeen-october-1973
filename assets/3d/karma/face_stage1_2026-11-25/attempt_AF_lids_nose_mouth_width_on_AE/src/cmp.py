import sys,os;sys.path.insert(0,'.')
import numpy as np
from load import load; from rast import render
from PIL import Image,ImageDraw
src=open('panels_old.py').read()
code=src[src.index("PUP="):src.index("if __name__")]
ns={'np':np,'Image':Image,'ImageDraw':ImageDraw,'REFDIR':'/downloads','BOX':(-1.1,1.1,-1.8,0.55),'S':400}
exec(code,ns)
refcrop=ns['refcrop']; row=ns['row']
def mrender(path,box=(-1.1,1.1,-1.8,0.55),S=400,grid=0):
    V,C,I=load(path); V=V.astype(float); V[:,1]-=0.01
    return render(V,C[:,:3].astype(float),I.reshape(-1,3).astype(int),box,S,grid,os.path.basename(path))
if __name__=='__main__':
    out=sys.argv[1]; paths=sys.argv[2:]
    ims=[refcrop('clasp',grid=False),refcrop('stand',grid=False)]+[mrender(p) for p in paths]
    row(ims).save(out)
