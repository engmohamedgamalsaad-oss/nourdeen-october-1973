import sys,os;sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
from mhr import *
P0=child_base(); Q0=norm(P0)
def snap(x,y,tol=0.035,Q=Q0,zfront=True):
    m=(abs(Q[:,0]-x)<tol)&(abs(Q[:,1]-y)<tol)&(Q[:,1]>-2.2)&(Q[:,2]>-0.6)
    ids=np.where(m)[0]
    d=np.hypot(Q[ids,0]-x,Q[ids,1]-y)
    # prefer front-most among those within 0.012 of the nearest
    near=ids[d<=d.min()+0.012]
    best=near[np.argmax(Q[near,2])]
    return int(best)
ANN={ # annotated on child base wireframe renders, IPD0 units (viewer coords, +x right)
 'eyeL_outer':(-0.737,-0.002),'eyeL_inner':(-0.328,-0.021),'eyeL_up':(-0.533,0.089),'eyeL_lo':(-0.533,-0.091),
 'eyeR_outer':(0.739,-0.002),'eyeR_inner':(0.326,-0.022),'eyeR_up':(0.533,0.089),'eyeR_lo':(0.533,-0.091),
 'alarL':(-0.283,-0.55),'alarR':(0.283,-0.55),'subnasale':(0.0,-0.683),
 'mouthL':(-0.319,-1.051),'mouthR':(0.319,-1.051),'lipTop':(0.0,-0.958),'lipBot':(0.0,-1.256)}
if __name__=='__main__':
    for k,(x,y) in ANN.items():
        i=snap(x,y); print(k,i,np.round(Q0[i],3))
