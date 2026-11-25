import numpy as np, json
from PIL import Image, ImageDraw
I=dict(pupL=468,pupR=473,eoL=33,eiL=133,eiR=362,eoR=263,nose=1,alaL=129,alaR=358,bridge=168,mL=61,mR=291,lipU=0,lipUi=13,lipLi=14,lipL=17,chin=152,top=10,fL=234,fR=454,
 lidUL=159,lidLL=145,lidUR=386,lidLR=374,browL=105,browR=334,subn=2,browLo=107,browRo=336)
res={}
for k in ['stand','wave','clasp']:
    L=np.load(f'lm_{k}.npy'); P=lambda n:L[I[n]][:2]
    # roll-correct: rotate so pupil line horizontal
    v=P('pupR')-P('pupL'); a=np.arctan2(v[1],v[0]); c,s=np.cos(-a),np.sin(-a); R=np.array([[c,-s],[s,c]])
    ipd=np.linalg.norm(v); mid=(P('pupL')+P('pupR'))/2
    T=lambda n:(R@(P(n)-mid))/ipd
    m={}
    for n in I: m[n]=T(n).tolist()
    m['_z']={n:float((L[I[n]][2])/ipd) for n in ['nose','alaL','alaR','bridge','chin','fL','fR','lipU','pupL','pupR']}
    m['_roll_deg']=float(np.degrees(a)); m['_ipd_px']=float(ipd)
    res[k]=m
    im=Image.open(f'crop_{k}.png').convert('RGB'); d=ImageDraw.Draw(im)
    for n in I:
        x,y=L[I[n]][:2]; d.ellipse((x-3,y-3,x+3,y+3),outline=(0,255,0))
    im.save(f'ov_{k}.png')
avg={n:np.mean([res[k][n] for k in res],0).tolist() for n in I}
avgz={n:float(np.mean([res[k]['_z'][n] for k in res])) for n in res['stand']['_z']}
json.dump({'per':res,'avg':avg,'avgz':avgz},open('metrics.json','w'),indent=1)
a=avg; g=lambda n:np.array(a[n])
print('roll',[round(res[k]['_roll_deg'],1) for k in res])
print('face width/ipd',np.linalg.norm(g('fL')-g('fR')))
print('face h (top-chin)/ipd',abs(g('chin')[1]-g('top')[1]))
print('eye outer span',np.linalg.norm(g('eoL')-g('eoR')),'eye width',np.linalg.norm(g('eoL')-g('eiL')))
print('nose width',np.linalg.norm(g('alaL')-g('alaR')),'nose tip y',g('nose')[1],'bridge y',g('bridge')[1])
print('mouth w',np.linalg.norm(g('mL')-g('mR')),'mouth y',g('lipU')[1],g('lipLi')[1],g('lipL')[1])
print('chin y',g('chin')[1],'top y',g('top')[1],'brow y',g('browL')[1])
print('lid open L',np.linalg.norm(g('lidUL')-g('lidLL')))
print('z',avgz)
