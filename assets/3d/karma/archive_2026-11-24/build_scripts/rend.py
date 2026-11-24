import sys;sys.path.insert(0,'/tmp/w')
from load import *
T=np.array(Image.open(sys.argv[1]).convert('RGB'));H,W=T.shape[:2]
S=2200;cx,cy=-0.0125,0.85;R=0.30
img=np.zeros((S,S,3),np.uint8);zb=np.full((S,S),-9.0)
def sc(p): return (p[:,0]-cx)/R*S/2+S/2,(cy-p[:,1])/R*S/2+S/2
sx_,sy_=sc(P)
sel=np.where((P[F,1].min(1)>0.5)&(P[F,1].max(1)<1.15)&(np.abs(P[F,0]).max(1)<0.35))[0]
for t in sel:
    a,b,c=F[t]
    xs=sx_[[a,b,c]];ys=sy_[[a,b,c]]
    x0,x1=int(max(xs.min(),0)),int(min(xs.max()+1,S-1));y0,y1=int(max(ys.min(),0)),int(min(ys.max()+1,S-1))
    if x1<=x0 or y1<=y0: continue
    gx,gy=np.meshgrid(np.arange(x0,x1),np.arange(y0,y1))
    d=(ys[1]-ys[2])*(xs[0]-xs[2])+(xs[2]-xs[1])*(ys[0]-ys[2])
    if abs(d)<1e-9: continue
    l0=((ys[1]-ys[2])*(gx-xs[2])+(xs[2]-xs[1])*(gy-ys[2]))/d
    l1=((ys[2]-ys[0])*(gx-xs[2])+(xs[0]-xs[2])*(gy-ys[2]))/d
    l2=1-l0-l1;m=(l0>=0)&(l1>=0)&(l2>=0)
    if not m.any(): continue
    z=l0*P[a,2]+l1*P[b,2]+l2*P[c,2]
    u=l0*UV[a,0]+l1*UV[b,0]+l2*UV[c,0];v=l0*UV[a,1]+l1*UV[b,1]+l2*UV[c,1]
    m&=z>zb[y0:y1,x0:x1]
    ui=np.clip((u*W).astype(int),0,W-1);vi=np.clip((v*H).astype(int),0,H-1)
    sub=img[y0:y1,x0:x1];sub[m]=T[vi,ui][m];zb[y0:y1,x0:x1][m]=z[m]
Image.fromarray(img).resize((1100,1100),Image.LANCZOS).save(sys.argv[2])
