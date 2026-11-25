import sys;sys.path.insert(0,'.')
from cmp import *
def refg(k,box,S): return refcrop(k,box=box,S=S,grid=True)
box=eval(sys.argv[2]); S=int(sys.argv[3]); out=sys.argv[1]
ims=[refg('clasp',box,S),refg('stand',box,S)]
for p in sys.argv[4:]:
    V,C,I=load(p); V=V.astype(float); V[:,1]-=0.01
    ims.append(render(V,C[:,:3].astype(float),I.reshape(-1,3).astype(int),box,S,0.25,os.path.basename(p)))
row(ims).save(out)
