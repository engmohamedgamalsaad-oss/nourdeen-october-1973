import numpy as np,pickle,json
from scipy.optimize import lsq_linear
d=pickle.load(open('ict.pkl','rb')); V0,ids,ex,exn=d['V0'],d['ids'],d['ex'],d['exn']
lm=np.array(json.load(open('/tmp/ict/FaceXModel/vertex_indices.json'))['idx_to_landmark_verts'])
MP={0:234,1:93,2:132,3:58,4:172,5:136,6:150,7:176,8:152,9:400,10:379,11:365,12:397,13:288,14:361,15:323,16:454,
17:70,18:63,19:105,20:66,21:107,22:336,23:296,24:334,25:293,26:300,27:168,28:6,29:195,30:4,31:129,32:98,33:2,34:327,35:358,
36:33,37:160,38:158,39:133,40:153,41:144,42:362,43:385,44:387,45:263,46:373,47:380,
48:61,49:40,50:37,51:0,52:267,53:270,54:291,55:321,56:314,57:17,58:84,59:91,60:78,61:81,62:13,63:311,64:308,65:402,66:14,67:178}
Ls=[]
for r in ['stand','wave','clasp']:
    L=np.load(f'/tmp/f/lm_{r}.npy'); pl,pr=L[468,:2],L[473,:2];v=pr-pl;a=np.arctan2(v[1],v[0]);c,s=np.cos(-a),np.sin(-a);R=np.array([[c,-s],[s,c]]);ip=np.linalg.norm(v);m_=(pl+pr)/2
    xy=(R@(L[:,:2]-m_).T).T/ip; Ls.append(np.c_[xy[:,0],-xy[:,1]])
Ls=np.array(Ls); Lm=Ls.mean(0)
T=np.array([Lm[MP[i]] for i in range(68)])
np.save('target68.npy',T)
INV=list(range(0,5))+list(range(12,17))+[8]+list(range(17,27))+list(range(27,36))+[36,39,42,45]   # expression-invariant: jaw outline upper, chin, brows, nose, eye corners
SM=[i for i in range(68) if i not in INV]
B=ids[:,lm,:2]  # 100 x 68 x 2
L0=V0[lm,:2]
def fit_neutral(lam,iters=8,idx=INV):
    s=1/np.linalg.norm(V0[lm[45]]-V0[lm[36]])*np.linalg.norm(T[45]-T[36]); w=np.zeros(100); t=np.zeros(2)
    for _ in range(iters):
        # solve w,t for fixed s
        A=[];y=[]
        for i in idx:
            for c in range(2):
                row=np.zeros(102); row[:100]=s*B[:,i,c]; row[100+c]=1; A.append(row); y.append(T[i,c]-s*L0[i,c])
        A=np.array(A);y=np.array(y)
        Ar=np.vstack([A,np.sqrt(lam)*np.c_[np.eye(100),np.zeros((100,2))]]); yr=np.r_[y,np.zeros(100)]
        sol=np.linalg.lstsq(Ar,yr,rcond=None)[0]; w=sol[:100]; t=sol[100:]
        P=(L0+np.einsum('k,kij->ij',w,B)); # model lm xy
        # solve s,t for fixed w (all idx)
        A=[];y=[]
        for i in idx:
            for c in range(2):
                row=np.zeros(3); row[0]=P[i,c]; row[1+c]=1; A.append(row); y.append(T[i,c])
        s,tx,ty=np.linalg.lstsq(np.array(A),np.array(y),rcond=None)[0]; t=np.array([tx,ty])
    P=s*(L0+np.einsum('k,kij->ij',w,B))+t
    return w,s,t,P
if __name__=='__main__':
    for lam in [0.003,0.01,0.03,0.1,0.3,1,3]:
        w,s,t,P=fit_neutral(lam)
        e=np.linalg.norm(P-T,axis=1)
        print('lam %.3f |w|=%.2f max|w|=%.2f  inv-resid mean %.4f max %.3f  all68 mean %.4f'%(lam,np.linalg.norm(w),np.abs(w).max(),e[INV].mean(),e[INV].max(),e.mean()))
