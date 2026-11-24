import numpy as np,sys
import geo2 as G
from geo2 import u,ey,EYE_Y,SKIN,tube,ellipsoid
P,F,d=G.head()
zf=G.zf_factory(P,d)
sn=lambda t,p=0.8: np.sin(np.pi*np.clip(t,0,1))**p
def eye_curves(s,n=24):
    t=np.linspace(0,1,n);x=s*(0.267+0.463*t)*u
    base=EYE_Y-0.062*u*(1-t)
    up=base+0.215*u*sn(t**0.85,0.75);lo=base-0.085*u*sn(t,0.9)
    return t,x,up,lo
def inside_eye(x,y,s):
    t=(s*x-0.267*u)/(0.463*u);ok=(t>0.02)&(t<0.98)
    base=EYE_Y-0.062*u*(1-t);tt=np.clip(t,0,1)
    up=base+0.215*u*sn(tt**0.85,0.75);lo=base-0.085*u*sn(tt,0.9)
    return ok&(y<up-0.0006)&(y>lo+0.0006)
L=0.49*u;COR=ey(0.74)
mtop=lambda t: COR+(ey(0.90)-COR)*sn(t,0.8)
mbot=lambda t: COR+(ey(1.01)-COR)*sn(t,0.8)
def inside_mouth(x,y):
    t=(x+L)/(2*L);ok=(t>0.03)&(t<0.97);tt=np.clip(t,0,1)
    return ok&(y<mtop(tt)-0.0005)&(y>mbot(tt)+0.0005)
# vertex colors
x,y=P[:,0],P[:,1];front=d[:,2]>0
col=np.tile(SKIN,(len(P),1))
bl=np.zeros(len(P))
for s in(-1,1): bl=np.maximum(bl,G.gauss2(P,s*0.9*u,ey(0.6),0.038,0.034))
col=col*(1-0.55*bl[:,None])+np.array([238,132,112.])*0.55*bl[:,None]
# brows
bw=np.zeros(len(P))
for s in(-1,1):
    for t in np.linspace(0,1,40):
        bx=s*(0.30+0.72*t)*u;by=ey(-0.17-0.12*np.sin(np.pi*t)-0.10*t**2)
        th=0.0028*(0.55+0.9*np.sin(np.pi*t*0.9+0.2))
        w=np.exp(-(((x-bx)**2+(y-by)**2)/(2*th**2)))*front;
        bw=np.maximum(bw,w)
bw=np.clip(bw*1.6,0,1)
col=col*(1-0.85*bw[:,None])+np.array([88,56,42.])*0.85*bw[:,None]
# lips region
xt=(x+0.56*u)/(1.12*u);inl=(xt>0)&(xt<1)&front;tt=np.clip(xt,0,1)
c0=ey(0.80);upo=c0+(ey(0.84)-c0)*sn(tt,0.8);loo=c0+(ey(1.22)-c0)*sn(tt,0.8)
sg=lambda z: 1/(1+np.exp(-z/0.0012))
wl=sg(upo-y)*sg(y-loo)*inl
col=col*(1-0.8*wl[:,None])+np.array([236,128,142.])*0.8*wl[:,None]
# nostrils
for s in(-1,1):
    w=G.gauss2(P,s*0.13*u,ey(0.66),0.0035,0.0025)*front;col=col*(1-0.7*w[:,None])+np.array([120,60,50.])*0.7*w[:,None]
# remove hole faces
keep=np.ones(len(F),bool)
ins=np.zeros(len(P),bool)
for s in(-1,1): ins|=inside_eye(x,y,s)&front
ins|=inside_mouth(x,y)&front
keep=~ins[F].all(1)
Fk=F[keep]
parts=[dict(V=P,F=Fk,col=col)]
Zf=lambda xx,yy: float(zf(xx,yy)[0])
# eyes
for s in(-1,1):
    ex=s*0.50*u;eyc=EYE_Y+0.03*u;r=0.0195
    D,Fe=G.sphere(72,96);V=D*r+np.array([ex,eyc,Zf(ex,eyc)-r+0.0008])
    ax=np.array([0,np.sin(0.10),np.cos(0.10)]);ang=np.arccos(np.clip(D@ax,-1,1))
    ec=np.tile([248,244,240.],(len(D),1));ec[ang<0.72]=[70,42,32];ec[ang<0.60]=[112,68,46];ec[ang<0.30]=[22,12,10]
    hl=np.linalg.norm(D[:,:2]-np.array([0.10,0.18]),axis=1)<0.07;ec[hl&(D[:,2]>0.9)]=[255,255,255]
    parts.append(dict(V=V,F=Fe,col=ec))
    t,xx,up,lo=eye_curves(s)
    pu=np.array([[a,b,Zf(a,b)+0.0006] for a,b in zip(xx,up)]);pl=np.array([[a,b,Zf(a,b)+0.0004] for a,b in zip(xx,lo)])
    rr=0.0010+0.0014*np.sin(np.pi*t)
    parts.append(tube(pu,rr,(48,28,22)));parts.append(tube(pl,0.0009,(205,128,118)))
# mouth
t=np.linspace(0,1,40);mx=-L+2*L*t
top=np.array([[a,mtop(b),Zf(a,mtop(b))+0.0008] for a,b in zip(mx,t)]);bot=np.array([[a,mbot(b),Zf(a,mbot(b))+0.0008] for a,b in zip(mx,t)])
parts.append(tube(top,0.0016+0.0010*sn(t),(226,106,122)))
botl=bot.copy();botl[:,1]-=0.0030*sn(t);parts.append(tube(botl,0.0020+0.0022*sn(t),(238,130,144)))
zc=Zf(0,ey(0.95))
parts.append(ellipsoid((0,ey(0.955),zc-0.010),(0.40*u,0.050*u,0.006),(66,20,28)))
for k in range(8):
    tx=0.5+(k-3.5)*0.095;xx=-L+2*L*tx
    yy=mtop(tx)-0.0030
    parts.append(ellipsoid((xx,yy,Zf(xx,yy)-0.0030),(0.0044,0.0052,0.0030),(250,246,236),8,12))
import pickle;pickle.dump(parts,open('parts_v2.pkl','wb'))
print(len(P),len(Fk))
