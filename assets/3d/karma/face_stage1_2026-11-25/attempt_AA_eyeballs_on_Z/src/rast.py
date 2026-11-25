import numpy as np
from PIL import Image, ImageDraw
def vnormals(V,T):
    n=np.cross(V[T[:,1]]-V[T[:,0]],V[T[:,2]]-V[T[:,0]])
    N=np.zeros_like(V)
    for k in range(3): np.add.at(N,T[:,k],n)
    return N/np.maximum(np.linalg.norm(N,axis=1,keepdims=True),1e-12)
def render(V,C,T,box,S,grid=0.1,label='',zmin=-9,N=None,light=(0,0.15,1.0)):
    if N is None: N=vnormals(V,T)
    x0,x1,y0,y1=box; W=int((x1-x0)*S);H=int((y1-y0)*S)
    L=np.array(light,float);L/=np.linalg.norm(L)
    sh=np.clip(N@L,0,1)*0.75+0.25
    col=(C[:,:3]*sh[:,None]).clip(0,255)
    P=np.c_[(V[:,0]-x0)*S,(y1-V[:,1])*S]
    # cull triangles outside box and backfacing
    tn=np.cross(V[T[:,1]]-V[T[:,0]],V[T[:,2]]-V[T[:,0]])[:,2]
    xs=P[T][:,:,0];ys=P[T][:,:,1]
    keep=(tn>0)&(xs.max(1)>=0)&(xs.min(1)<W)&(ys.max(1)>=0)&(ys.min(1)<H)
    T=T[keep]
    size=np.maximum(xs[keep].max(1)-xs[keep].min(1),ys[keep].max(1)-ys[keep].min(1))
    zb=np.full((H,W),-1e9); img=np.zeros((H,W,3))+30
    for lo,hi,k in [(-1,3,3),(3,8,9),(8,20,22),(20,60,60),(60,1e9,120)]:
        sel=T[(size>lo)&(size<=hi)]
        if len(sel)==0: continue
        a=np.arange(k+1)/k
        uu,vv=np.meshgrid(a,a); m=uu+vv<=1+1e-9; u=uu[m];v=vv[m]; w=1-u-v
        for ch in range(0,len(sel),20000):
            s=sel[ch:ch+20000]
            px=P[s[:,0],0][:,None]*w+P[s[:,1],0][:,None]*u+P[s[:,2],0][:,None]*v
            py=P[s[:,0],1][:,None]*w+P[s[:,1],1][:,None]*u+P[s[:,2],1][:,None]*v
            pz=V[s[:,0],2][:,None]*w+V[s[:,1],2][:,None]*u+V[s[:,2],2][:,None]*v
            cc=col[s[:,0]][:,None,:]*w[None,:,None]+col[s[:,1]][:,None,:]*u[None,:,None]+col[s[:,2]][:,None,:]*v[None,:,None]
            ix=px.round().astype(int).ravel();iy=py.round().astype(int).ravel();iz=pz.ravel();ic=cc.reshape(-1,3)
            ok=(ix>=0)&(ix<W)&(iy>=0)&(iy<H)&(iz>zmin)
            ix,iy,iz,ic=ix[ok],iy[ok],iz[ok],ic[ok]
            o=np.argsort(iz)
            ix,iy,iz,ic=ix[o],iy[o],iz[o],ic[o]
            upd=iz>=zb[iy,ix]
            zb[iy[upd],ix[upd]]=iz[upd]; img[iy[upd],ix[upd]]=ic[upd]
    im=Image.fromarray(img.astype(np.uint8))
    if grid:
        ov=Image.new('RGBA',im.size,(0,0,0,0)); d=ImageDraw.Draw(ov)
        gx=np.ceil(x0/grid-1e-9)*grid
        while gx<x1:
            X=int((gx-x0)*S); major=abs(gx/0.5-round(gx/0.5))<1e-6
            d.line([(X,0),(X,H)],fill=(0,220,255,110 if major else 40),width=1)
            if major: d.text((X+2,2),f'{gx:.1f}',fill=(0,255,255,255))
            gx+=grid
        gy=np.ceil(y0/grid-1e-9)*grid
        while gy<y1:
            Y=int((y1-gy)*S); major=abs(gy/0.5-round(gy/0.5))<1e-6
            d.line([(0,Y),(W,Y)],fill=(0,220,255,110 if major else 40),width=1)
            if major: d.text((2,Y+2),f'{gy:.1f}',fill=(0,255,255,255))
            gy+=grid
        im=Image.alpha_composite(im.convert('RGBA'),ov).convert('RGB')
    ImageDraw.Draw(im).text((6,H-12),label,fill=(255,255,0))
    return im
