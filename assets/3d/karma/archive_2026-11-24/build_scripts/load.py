import re,base64,numpy as np,io
from PIL import Image
s=open('/downloads/karma3d/src/meshData.ts').read()
g=lambda n:re.search(r"export const %s = '([^']*)'"%n,s).group(1)
LO=np.array([-0.31301504373550415,-0.0009574294090270996,-0.13400611281394958]);SC=np.array([9.542633051751181e-06,1.526312917121686e-05,4.2286646930733696e-06])
q=np.frombuffer(base64.b64decode(g('pos')),dtype=np.uint16).reshape(-1,3)
P=(LO+q*SC)          # model units (no K)
UV=np.frombuffer(base64.b64decode(g('uv')),dtype=np.uint16).reshape(-1,2)/65535
F=np.frombuffer(base64.b64decode(g('idx')),dtype=np.uint32).reshape(-1,3)
TEXIMG=Image.open(io.BytesIO(base64.b64decode(g('tex')))).convert('RGB')
