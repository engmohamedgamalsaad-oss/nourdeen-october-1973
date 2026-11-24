import numpy as np
from PIL import Image
def render(parts,S=900,cx=0.0,cy=0.84,R=0.17,yaw=0.0,light=(0.35,0.5,0.8)):
    # parts: dict V,F,col(Nx3 0-255 or None),uv,tex
    c,s=np.cos(yaw),np.sin(yaw);Ry=np.array([[c,0,s],[0,1,0],[-s,0,c]])
    L=np.array(light);L=L/np.linalg.norm(L)
    img=np.full((S,S,3),20,np.uint8);zb=np.full((S,S),-9.0)
    for p in parts:
        V=p['V']@Ry.T;F=p['F']
        n=np.cross(V[F[:,1]]-V[F[:,0]],V[F[:,2]]-V[F[:,0]]);nl=np.linalg.norm(n,axis=1)+1e-12;n=n/nl[:,None]
        # vertex normals
        vn=np.zeros_like(V);np.add.at(vn,F[:,0],n);np.add.at(vn,F[:,1],n);np.add.at(vn,F[:,2],n)
        vn/= (np.linalg.norm(vn,axis=1)[:,None]+1e-12)
        sh=np.clip(vn@L,0,1)*0.45+0.60
        sx=(V[:,0]-cx)/R*S/2+S/2;sy=(cy-V[:,1])/R*S/2+S/2
        tex=p.get('tex');
        if tex is not None: T=np.array(tex);th,tw=T.shape[:2]
        for t in range(len(F)):
            a,b,cc=F[t]
            if n[t,2]<-0.05 and not p.get('two',False): continue
            xs=sx[[a,b,cc]];ys=sy[[a,b,cc]]
            x0,x1=int(max(xs.min(),0)),int(min(xs.max()+1,S-1));y0,y1=int(max(ys.min(),0)),int(min(ys.max()+1,S-1))
            if x1<=x0 or y1<=y0: continue
            gx,gy=np.meshgrid(np.arange(x0,x1)+.5,np.arange(y0,y1)+.5)
            d=(ys[1]-ys[2])*(xs[0]-xs[2])+(xs[2]-xs[1])*(ys[0]-ys[2])
            if abs(d)<1e-9: continue
            l0=((ys[1]-ys[2])*(gx-xs[2])+(xs[2]-xs[1])*(gy-ys[2]))/d
            l1=((ys[2]-ys[0])*(gx-xs[2])+(xs[0]-xs[2])*(gy-ys[2]))/d
            l2=1-l0-l1;m=(l0>=0)&(l1>=0)&(l2>=0)
            if not m.any(): continue
            z=l0*V[a,2]+l1*V[b,2]+l2*V[cc,2]
            m&=z>zb[y0:y1,x0:x1]
            if not m.any(): continue
            shv=l0*sh[a]+l1*sh[b]+l2*sh[cc]
            if tex is not None:
                uu=l0*p['uv'][a,0]+l1*p['uv'][b,0]+l2*p['uv'][cc,0];vv=l0*p['uv'][a,1]+l1*p['uv'][b,1]+l2*p['uv'][cc,1]
                col=T[np.clip(((1-vv)*th).astype(int),0,th-1),np.clip((uu*tw).astype(int),0,tw-1)].astype(float)
            else:
                col=(l0[...,None]*p['col'][a]+l1[...,None]*p['col'][b]+l2[...,None]*p['col'][cc])
            out=np.clip(col*shv[...,None],0,255).astype(np.uint8)
            img[y0:y1,x0:x1][m]=out[m];zb[y0:y1,x0:x1][m]=z[m]
    return Image.fromarray(img)
