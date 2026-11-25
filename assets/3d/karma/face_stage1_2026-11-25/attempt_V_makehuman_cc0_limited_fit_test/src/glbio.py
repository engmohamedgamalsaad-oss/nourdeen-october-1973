import json,struct,numpy as np
def write_glb(path,V,C,T):
    V=V.astype('<f4');T=T.astype('<u4');C=C.astype('u1')
    C4=np.c_[C[:,:3],np.full(len(C),255,'u1')]
    bp=V.tobytes();bi=T.tobytes();bc=C4.tobytes()
    def pad(b): return b+b'\x00'*((-len(b))%4)
    bp,bi,bc=pad(bp),pad(bi),pad(bc)
    blob=bi+bp+bc
    j={"asset":{"version":"2.0","generator":"karma face test (MakeHuman CC0 assets, own script)"},
     "scene":0,"scenes":[{"nodes":[0]}],"nodes":[{"mesh":0,"name":"head"}],
     "meshes":[{"primitives":[{"attributes":{"POSITION":1,"COLOR_0":2},"indices":0}]}],
     "buffers":[{"byteLength":len(blob)}],
     "bufferViews":[{"buffer":0,"byteOffset":0,"byteLength":len(bi),"target":34963},{"buffer":0,"byteOffset":len(bi),"byteLength":len(bp),"target":34962},{"buffer":0,"byteOffset":len(bi)+len(bp),"byteLength":len(bc),"target":34962}],
     "accessors":[{"bufferView":0,"componentType":5125,"count":int(T.size),"type":"SCALAR","min":[int(T.min())],"max":[int(T.max())]},
      {"bufferView":1,"componentType":5126,"count":len(V),"type":"VEC3","min":V.min(0).tolist(),"max":V.max(0).tolist()},
      {"bufferView":2,"componentType":5121,"normalized":True,"count":len(V),"type":"VEC4"}]}
    jb=json.dumps(j,separators=(',',':')).encode(); jb+=b' '*((-len(jb))%4)
    total=12+8+len(jb)+8+len(blob)
    with open(path,'wb') as f:
        f.write(struct.pack('<III',0x46546C67,2,total)); f.write(struct.pack('<II',len(jb),0x4E4F534A)); f.write(jb)
        f.write(struct.pack('<II',len(blob),0x004E4942)); f.write(blob)
