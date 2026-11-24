import numpy as np,sys
import geo3 as G
from geo3 import u,ey,EYE_Y,SKIN,tube,ellipsoid
P,F,d=G.head(260,340)
zf=G.zf_factory(P,d)
EI,EO=0.29,0.745
sn=lambda t,p=0.8: np.sin(np.pi*np.clip(t,0,1))**p
def eye_curves(s,n=24):
    t=np.linspace(0,1,n);x=s*(EI+(EO-EI)*t)*u
    base=EYE_Y-0.062*u*(1-t)
    up=base+0.165*u*sn(t**0.85,0.75);lo=base-0.050*u*sn(t,0.9)
    return t,x,up,lo
def inside_eye(x,y,s):
    t=(s*x-EI*u)/((EO-EI)*u);ok=(t>0.02)&(t<0.98)
    base=EYE_Y-0.062*u*(1-t);tt=np.clip(t,0,1)
    up=base+0.165*u*sn(tt**0.85,0.75);lo=base-0.050*u*sn(tt,0.9)
    return ok&(y<up-0.0006)&(y>lo+0.0006)
L=0.50*u;COR=ey(0.74)
mtop=lambda t: COR+(ey(0.905)-COR)*sn(t,0.8)
mbot=lambda t: COR+(ey(0.99)-COR)*sn(t,0.8)
def inside_mouth(x,y):
    t=(x+L)/(2*L);ok=(t>0.03)&(t<0.97);tt=np.clip(t,0,1)
    return ok&(y<mtop(tt)-0.0005)&(y>mbot(tt)+0.0005)
# vertex colors
x,y=P[:,0],P[:,1];front=d[:,2]>0
col=np.tile(SKIN,(len(P),1))
bl=np.zeros(len(P))
for s in(-1,1): bl=np.maximum(bl,G.gauss2(P,s*1.0*u,ey(0.62),0.026,0.030))
col=col*(1-0.5*bl[:,None])+np.array([238,132,112.])*0.5*bl[:,None]
# brows
bw=np.zeros(len(P))
for s in(-1,1):
    for t in np.linspace(0,1,40):
        bx=s*(0.30+0.72*t)*u;by=ey(-0.12-0.10*np.sin(np.pi*t)-0.14*t**2)
        th=0.0017*(0.45+0.9*np.sin(np.pi*t*0.85+0.35))
        w=np.exp(-(((x-bx)**2+(y-by)**2)/(2*th**2)))*front;
        bw=np.maximum(bw,w)
bw=np.clip(bw*1.6,0,1)
col=col*(1-0.85*bw[:,None])+np.array([96,62,46.])*0.85*bw[:,None]
# lips region
xt=(x+0.52*u)/(1.04*u);inl=(xt>0)&(xt<1)&front;tt=np.clip(xt,0,1)
c0=ey(0.80);upo=c0+(ey(0.855)-c0)*sn(tt,0.8);loo=c0+(ey(1.13)-c0)*sn(tt,0.8)
sg=lambda z: 1/(1+np.exp(-z/0.0012))
wl=sg(upo-y)*sg(y-loo)*inl
col=col*(1-0.8*wl[:,None])+np.array([232,118,134.])*0.85*wl[:,None]
# nostrils
for s in(-1,1):
    w=G.gauss2(P,s*0.13*u,ey(0.66),0.0035,0.0025)*front;col=col*(1-0.7*w[:,None])+np.array([120,60,50.])*0.7*w[:,None]
wn=G.gauss2(P,0,ey(0.74),0.008,0.003)*front
col=col*(1-0.25*wn[:,None])+np.array([200,130,110.])*0.25*wn[:,None]
for s_ in(-1,1):
    for (cx_,cy_,sx_,sy_,k_) in((s_*0.34*u,ey(0.52),0.003,0.008,0.30),(s_*0.16*u,ey(0.67),0.004,0.003,0.5),(s_*0.46*u,ey(0.50),0.004,0.014,0.18)):
        w_=G.gauss2(P,cx_,cy_,sx_,sy_)*front;col=col*(1-k_*w_[:,None])+np.array([205,128,108.])*k_*w_[:,None]
wh=np.maximum(G.gauss2(P,0,ey(0.45),0.005,0.016),G.gauss2(P,0,ey(0.62),0.006,0.005))*front;col=col*(1-0.28*wh[:,None])+np.array([255,225,205.])*0.28*wh[:,None]
# remove hole faces
keep=np.ones(len(F),bool)
ins=np.zeros(len(P),bool)
for s in(-1,1): ins|=inside_eye(x,y,s)&front
keep=~ins[F].all(1)
Fk=F[keep]
parts=[dict(V=P,F=Fk,col=col)]
C0=np.array([0,0.815,0]);parts.append(dict(V=C0+(P-C0)*0.94,F=F[ins[F].any(1)],col=np.tile([196,128,108.],(len(P),1))))
Zf=lambda xx,yy: float(zf(xx,yy)[0])
# eyes
for s in(-1,1):
    ex=s*(EI+EO)/2*u;eyc=EYE_Y+0.03*u;r=0.0205
    D,Fe=G.sphere(72,96);V=D*r*np.array([1.06,1.0,1.0])+np.array([ex,eyc,Zf(ex,eyc)-r+0.0008])
    ax=np.array([0,np.sin(0.10),np.cos(0.10)]);ang=np.arccos(np.clip(D@ax,-1,1))
    ec=np.tile([236,224,216.],(len(D),1));ec[ang<0.66]=[58,34,26];ec[ang<0.54]=[96,58,40];ec[ang<0.30]=[22,12,10]
    hl=np.linalg.norm(D[:,:2]-np.array([0.10,0.18]),axis=1)<0.07;ec[hl&(D[:,2]>0.9)]=[255,255,255]
    parts.append(dict(V=V,F=Fe,col=ec))
    t,xx,up,lo=eye_curves(s)
    pu=np.array([[a,b,Zf(a,b)+0.0006] for a,b in zip(xx,up)]);pl=np.array([[a,b,Zf(a,b)+0.0004] for a,b in zip(xx,lo)])
    rr=0.0009+0.0016*np.sin(np.pi*t)*(0.6+0.8*t)
    parts.append(tube(pu,rr,(48,28,22)));parts.append(tube(pl,0.0009,(205,128,118)))
# mouth: lips are surface displacement, teeth a continuous ribbon
def curve_bump(path,h,sig):
    Nn=(P-np.array([0,0.815,0]));Nn/=np.linalg.norm(Nn,axis=1)[:,None]
    wm=np.zeros(len(P))
    for (px,py) in path:
        wm=np.maximum(wm,np.exp(-(((x-px)**2+(y-py)**2)/(2*sig**2)))*front)
    P[:]+=Nn*(h*wm)[:,None]
t=np.linspace(0,1,60);mx=-L+2*L*t
curve_bump([(a,mtop(b_)+0.0018*sn(b_)) for a,b_ in zip(mx,t)],0.0012,0.0026)
curve_bump([(a,mbot(b_)-0.0040*sn(b_)) for a,b_ in zip(mx,t)],0.0022,0.0036)
parts[0]['V']=P
nt=120;nv=9;Vt=[];Ct=[];Ft=[]
tt=np.linspace(0.0,1.0,nt)
for tv in tt:
    xx=-L+2*L*tv
    for vi in range(nv):
        v=vi/(nv-1);yy=mtop(tv)+(mbot(tv)-mtop(tv))*v
        Vt.append([xx,yy,Zf(xx,yy)+0.0014])
        k6=(tv-0.12)/0.76*6;fr=k6-np.floor(k6);inr=0.12<tv<0.88
        gap=inr and (fr<0.05 or fr>0.95)
        vcut=0.62+0.20*np.sin(np.pi*fr)**0.5 if inr else 0.30
        if v<vcut: c=(214,204,192) if gap else (250,246,238)
        elif v<vcut+0.10: c=(120,60,66)
        else: c=(84,28,36) if v<0.88 else (208,100,114)
        Ct.append(c)
for k in range(nt-1):
    for m_ in range(nv-1):
        a=k*nv+m_;b2=(k+1)*nv+m_;Ft+=[[a,a+1,b2],[a+1,b2+1,b2]]
parts.append(dict(V=np.array(Vt),F=np.array(Ft),col=np.array(Ct,float),two=True))
rimu=np.array([[a,mtop(b_),Zf(a,mtop(b_))+0.0004] for a,b_ in zip(mx,t)]);riml=np.array([[a,mbot(b_),Zf(a,mbot(b_))+0.0004] for a,b_ in zip(mx,t)])
parts.append(tube(rimu,0.0013,(214,108,122),6));parts.append(tube(riml,0.0016,(226,122,136),6))
import pickle;pickle.dump(parts,open('parts_v3.pkl','wb'))
print(len(P),len(Fk))
