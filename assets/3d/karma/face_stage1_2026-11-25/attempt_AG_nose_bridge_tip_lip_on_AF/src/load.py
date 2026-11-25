import json,struct,numpy as np
def load(f):
    b=open(f,'rb').read()
    l=struct.unpack('<I',b[12:16])[0]; j=json.loads(b[20:20+l])
    o=20+l+8; bin_=b[o:]
    def acc(i):
        a=j['accessors'][i]; bv=j['bufferViews'][a['bufferView']]
        ct={5126:'f4',5125:'u4',5121:'u1',5123:'u2'}[a['componentType']]
        n={'SCALAR':1,'VEC3':3,'VEC4':4}[a['type']]
        off=bv.get('byteOffset',0)+a.get('byteOffset',0)
        return np.frombuffer(bin_,dtype=ct,count=a['count']*n,offset=off).reshape(-1,n) if n>1 else np.frombuffer(bin_,dtype=ct,count=a['count'],offset=off)
    p=j['meshes'][0]['primitives'][0]
    return acc(p['attributes']['POSITION']),acc(p['attributes']['COLOR_0']),acc(p['indices'])
