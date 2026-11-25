import numpy as np
D='/tmp/mh/makehuman/data/'
V0=[];F0=[];G={};cur=None
for l in open(D+'3dobjs/base.obj'):
    if l.startswith('v '): V0.append([float(x) for x in l.split()[1:4]])
    elif l.startswith('g '): cur=l.split()[1]; G[cur]=set()
    elif l.startswith('f '):
        ids=[int(t.split('/')[0])-1 for t in l.split()[1:]]
        if cur=='body': F0.append(ids)
        G[cur].update(ids)
V0=np.array(V0);F0=np.array(F0)
_cache={}
def target(path):
    if path not in _cache:
        idx=[];d=[]
        for l in open(D+'targets/'+path):
            if l.startswith('#') or not l.strip(): continue
            a=l.split(); idx.append(int(a[0])); d.append([float(x) for x in a[1:4]])
        _cache[path]=(np.array(idx),np.array(d))
    return _cache[path]
USED=set()
def apply(P,path,w):
    i,d=target(path); P[i]+=w*d; USED.add(path)
def child_base(age='child'):
    P=V0.copy()
    for r in ('african','asian','caucasian'): apply(P,f'macrodetails/{r}-female-{age}.target',1/3)
    return P
# head selection: faces with all verts above cut (set by caller)
def head_faces(P,ycut):
    m=(P[F0][:,:,1]>ycut).all(1)
    # drop faces on the back of the neck? keep all
    return F0[m]
