import numpy as np
def poly_sdf(px,py,poly):
    """signed distance (neg inside) of points (broadcast arrays px,py) to closed polygon poly (N,2)."""
    P=np.asarray(poly,np.float32); n=len(P)
    d=np.full(np.broadcast(px,py).shape,1e9,np.float32); inside=np.zeros(d.shape,bool)
    for i in range(n):
        a=P[i];b=P[(i+1)%n];ab=b-a
        t=np.clip(((px-a[0])*ab[0]+(py-a[1])*ab[1])/max(ab.dot(ab),1e-9),0,1)
        d=np.minimum(d,np.sqrt((px-(a[0]+t*ab[0]))**2+(py-(a[1]+t*ab[1]))**2))
        cond=((a[1]>py)!=(b[1]>py))&(px<(b[0]-a[0])*(py-a[1])/(b[1]-a[1]+1e-12)+a[0])
        inside^=cond
    return np.where(inside,-d,d).astype(np.float32)
