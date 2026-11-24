import numpy as np,pickle
import geo3 as G
from geo3 import u,ey,EYE_Y,sphere
from geo3 import ellipsoid,tube
BR=np.array([68,47,38.]);BRW=np.array([98,48,32.])
def sstep(a,b,x): t=np.clip((x-a)/(b-a),0,1);return t*t*(3-2*t)
def cap():
    d,F=sphere(120,160)
    a,b,c=0.099*1.07,0.108*1.06,0.092*1.08;cy=0.815
    zz=np.where(d[:,2]>0,np.abs(d[:,2])**0.72,d[:,2])
    P=np.stack([d[:,0]*a,cy+d[:,1]*b,zz*c],-1);P[:,1]+=0.004
    low=np.clip(-d[:,1],0,1);P[:,0]*=1-0.10*low**2
    x,y,z=P[:,0],P[:,1],P[:,2]
    ax=np.abs(x)/u
    hl=ey(-1.05)-0.5*u*sstep(0.0,0.35,ax)*0  # base hairline
    # hairline drops at sides: frames temples then falls to cheek level behind ear
    hl=ey(-1.0)-(ey(-1.0)-ey(0.9))*sstep(0.75,1.12,ax)
    front=z>0.0
    keep=np.where(front,y>hl,y>0.745)
    keep&=~((np.abs(x)<0.0012)&(z>0)&False)
    # centre part: slight darker line
    col=np.tile(BR,(len(P),1))
    phase=np.sin(x*520+np.sin(y*140)*2.0)*0.5+0.5
    col=col*(0.85+0.3*phase[:,None])+BRW*(0.25*(phase[:,None]>0.8))
    part=np.exp(-(x/0.0016)**2)*(z>0)*(y>ey(-1.05))
    col=col*(1-0.5*part[:,None])+np.array([150,100,80.])*0.5*part[:,None]
    ok=keep[F].all(1)
    return dict(V=P,F=F[ok],col=np.clip(col,0,255))
def hair_parts():
    ps=[cap()]
    PINK=(236,96,160);PINKD=(200,70,130)
    for s in(-1,1):
        bx=s*0.074;by=0.955
        ps.append(ellipsoid((bx,by,0.0),(0.030,0.030,0.030),tuple(BR)))
        # pompom: fuzzy by bumpy sphere
        ps.append(ellipsoid((bx+s*0.002,by+0.026,0.012),(0.034,0.030,0.030),PINK,20,28))
        # bow lobes at base facing front-outer
        ps.append(ellipsoid((bx+s*0.026,by-0.012,0.036),(0.022,0.013,0.008),PINKD,14,20))
        ps.append(ellipsoid((bx+s*0.052,by-0.030,0.034),(0.018,0.016,0.008),PINK,14,20))
        ps.append(ellipsoid((bx+s*0.036,by-0.020,0.040),(0.006,0.006,0.006),(250,170,200),10,14))
        # braid: chain of elongated blobs hanging from bun down the side, forward of the shoulder
        n=22
        for k in range(n):
            t=k/(n-1);yy=0.92-0.40*t;xx=s*(0.108+0.010*np.sin(t*3.0)+0.012*t);zz=0.014+0.012*t
            shade=np.array(BR)*(0.8+0.35*(k%2)) if True else BR
            ps.append(ellipsoid((xx+0.006*s*(k%2),yy,zz),(0.017*(1-0.35*t),0.014,0.016*(1-0.3*t)),tuple(np.clip(shade,0,255)),8,12))
        # long wavy lock behind/outside braid
        tt=np.linspace(0,1,40);path=np.stack([s*(0.122+0.012*np.sin(tt*9)),0.90-0.46*tt,-0.012+0.0*tt],-1)
        ps.append(tube(path,0.011*(1-0.4*tt),tuple(BRW),8))
    # small clips (flowers white) on one side, red clips near part
    ps.append(ellipsoid((-0.040,0.935,0.088),(0.006,0.006,0.003),(250,250,250),8,12))
    ps.append(ellipsoid((-0.046,0.918,0.088),(0.006,0.006,0.003),(250,250,250),8,12))
    return ps
if __name__=='__main__':
    head=pickle.load(open('parts_v3.pkl','rb'))
    allp=head+hair_parts()
    pickle.dump(allp,open('parts_head_hair_v1.pkl','wb'));print(len(allp))
