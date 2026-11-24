import sys;sys.path.insert(0,'/tmp/w')
from load import *
ph=np.array(Image.open('/downloads/karma_apose.png').convert('RGB')).astype(np.float32)
T=np.array(TEXIMG).astype(np.float32);H,W=T.shape[:2]
# landmark-fit affine (mesh model units -> photo px)
EX=-0.0125; sx=float(sys.argv[1]) if len(sys.argv)>1 else 900; sy=float(sys.argv[2]) if len(sys.argv)>2 else 906
ox=float(sys.argv[3]) if len(sys.argv)>3 else 0; oy=float(sys.argv[4]) if len(sys.argv)>4 else 0
def proj(X,Y): return 612+ox+sx*(X-EX), 206+oy+np.interp(Y,[0.66,0.72,0.749,0.817,0.8925,1.0,1.2],[345,318,282,254,206,109,0])-206*0+(-206)+206*0
# vertex normals
v0,v1,v2=P[F[:,0]],P[F[:,1]],P[F[:,2]]
fn=np.cross(v1-v0,v2-v0);N=np.zeros_like(P)
for k in range(3): np.add.at(N,F[:,k],fn)
N/=np.linalg.norm(N,axis=1,keepdims=True)+1e-9
def inreg(p,n):
    return (p[:,0]>-0.15)&(p[:,0]<0.125)&(p[:,1]>0.69)&(p[:,1]<1.0)&(p[:,2]>0.03)
vm=inreg(P,N)
tri=np.where(vm[F].any(1))[0]
print('tris',len(tri))
def wfun(X,Y,nz):
    r=np.sqrt(((X-EX)/0.105)**2+((Y-0.855)/0.16)**2)
    w=np.clip((1.0-r)/0.25,0,1)
    return w
out=T.copy();cov=np.zeros((H,W),np.float32)
Pf=P;U=UV
for t in tri:
    a,b,c=F[t]
    uv=np.stack([U[a],U[b],U[c]])*[W,H]
    x0,x1=int(np.floor(uv[:,0].min())),int(np.ceil(uv[:,0].max()))+1
    y0,y1=int(np.floor(uv[:,1].min())),int(np.ceil(uv[:,1].max()))+1
    xs,ys=np.meshgrid(np.arange(x0,x1),np.arange(y0,y1))
    px=xs+0.5;py=ys+0.5
    d=(uv[1,1]-uv[2,1])*(uv[0,0]-uv[2,0])+(uv[2,0]-uv[1,0])*(uv[0,1]-uv[2,1])
    if abs(d)<1e-9: continue
    l0=((uv[1,1]-uv[2,1])*(px-uv[2,0])+(uv[2,0]-uv[1,0])*(py-uv[2,1]))/d
    l1=((uv[2,1]-uv[0,1])*(px-uv[2,0])+(uv[0,0]-uv[2,0])*(py-uv[2,1]))/d
    l2=1-l0-l1
    m=(l0>=-0.02)&(l1>=-0.02)&(l2>=-0.02)
    if not m.any(): continue
    l0,l1,l2=l0[m],l1[m],l2[m];xi,yi=xs[m],ys[m]
    ok=(xi>=0)&(xi<W)&(yi>=0)&(yi<H)
    l0,l1,l2,xi,yi=l0[ok],l1[ok],l2[ok],xi[ok],yi[ok]
    X=l0*P[a,0]+l1*P[b,0]+l2*P[c,0];Y=l0*P[a,1]+l1*P[b,1]+l2*P[c,1]
    nz=l0*N[a,2]+l1*N[b,2]+l2*N[c,2]
    w=wfun(X,Y,nz)
    qx,qy=proj(X,Y)
    qx=np.clip(qx,0,1070);qy=np.clip(qy,0,1070)
    x0i=np.floor(qx).astype(int);y0i=np.floor(qy).astype(int);fx=(qx-x0i)[:,None];fy=(qy-y0i)[:,None]
    col=(ph[y0i,x0i]*(1-fx)*(1-fy)+ph[y0i,x0i+1]*fx*(1-fy)+ph[y0i+1,x0i]*(1-fx)*fy+ph[y0i+1,x0i+1]*fx*fy)
    wv=w[:,None]
    out[yi,xi]=out[yi,xi]*(1-wv)+col*wv
    cov[yi,xi]=np.maximum(cov[yi,xi],w)
from scipy import ndimage as ndi
msk=cov>0.02
d,ix=ndi.distance_transform_edt(~msk,return_indices=True)
fill=(~msk)&(d<=5)&(ndi.binary_dilation(msk,iterations=6))
# only fill where original is dark seam-like pixels inside strong region
strong=ndi.binary_closing(cov>0.6,iterations=3)
fill&=(cov[ix[0],ix[1]]>0.5)
out[fill]=out[ix[0][fill],ix[1][fill]]
Image.fromarray(np.clip(out,0,255).astype(np.uint8)).save('/tmp/w/tex_new.png')
Image.fromarray(np.clip(out,0,255).astype(np.uint8)).save('/tmp/w/tex_new.jpg',quality=90)
print('cov px',(cov>0.5).sum())
