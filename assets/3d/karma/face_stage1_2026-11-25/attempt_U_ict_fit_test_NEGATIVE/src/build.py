import sys,numpy as np,trimesh,json
from fit import *
lam=float(sys.argv[1]) if len(sys.argv)>1 else 1e-3; tag=sys.argv[2] if len(sys.argv)>2 else 'U'
F=d['F']
w,s,t,P=fit_neutral(lam)
Vn=V0+np.einsum('k,kij->ij',w,ids)
# smile expression: bounded LS on all landmarks using identity-fixed neutral
EB=ex[:,lm,:2]; Pn=s*(Vn[lm,:2])+t
A=[];y=[]
for i in range(68):
    for c in range(2): A.append(s*EB[:,i,c]); y.append(T[i,c]-Pn[i,c])
A=np.array(A);y=np.array(y)
allow=['mouthSmile_L','mouthSmile_R','cheekRaiser_L','cheekRaiser_R','eyeSquint_L','eyeSquint_R','mouthUpperUp_L','mouthUpperUp_R','mouthStretch_L','mouthStretch_R','mouthDimple_L','mouthDimple_R']
lo=np.zeros(len(exn));hi=np.array([1.0 if n in allow else 1e-9 for n in exn])
r=lsq_linear(A,y,bounds=(lo,hi)); we=r.x
print('expression weights',{exn[i]:round(we[i],2) for i in range(len(exn)) if we[i]>0.02})
Vs=Vn+np.einsum('k,kij->ij',we,ex)
Ps=s*Vs[lm,:2]+t
en=np.linalg.norm(Pn-T,axis=1); es=np.linalg.norm(Ps-T,axis=1)
print('neutral resid  inv %.3f mouth %.3f | smile resid inv %.3f mouth %.3f all %.3f'%(en[INV].mean(),en[48:].mean(),es[INV].mean(),es[48:].mean(),es.mean()))
json.dump(dict(w=w.tolist(),we=we.tolist(),s=float(s),t=t.tolist(),lam=lam,res_neutral_inv=float(en[INV].mean()),res_smile_all=float(es.mean())),open(f'fit_{tag}.json','w'))
# export: IPD units, origin between eyeball centres. eyeballs vertex ranges from README
def eyec(V): return (V[21451:22221].mean(0)+V[23021:23791].mean(0))/2, np.linalg.norm(V[21451:22221].mean(0)-V[23021:23791].mean(0))
def parts_mesh(V,name):
    c,ipd=eyec(V); W=(V-c)/ipd
    R=[('skin',0,17006,(222,186,166)),('teeth',17006,21496,(244,240,228)),('sclera',21496,22296,(245,245,245)),('sclera',23094,23894,(245,245,245)),('lash',25304,26384,(50,35,30))]
    out=[]
    for nm,a,b,col in R:
        tris=[]
        for f in F[a:b]:
            for k in range(1,len(f)-1): tris.append([f[0],f[k],f[k+1]])
        m=trimesh.Trimesh(W.copy(),np.array(tris),process=False); m.remove_unreferenced_vertices()
        cols=np.tile(np.array(col+(255,),np.uint8),(len(m.vertices),1))
        if nm=='sclera':
            cen=m.vertices.mean(0); rad=np.linalg.norm(m.vertices-cen,axis=1).mean(); u=(m.vertices-cen); u/=np.linalg.norm(u,axis=1)[:,None]
            ang=np.degrees(np.arccos(np.clip(u[:,2],-1,1)))
            cols[ang<28]=[96,60,40,255]; cols[ang<12]=[20,14,12,255]
        m.visual.vertex_colors=cols; m.vertex_normals; out.append(m)
    return out
for nm,V in (('neutral',Vn),('smile',Vs)):
    ms=parts_mesh(V,nm)
    # lips colour on skin: vertices near lip landmarks polygon (outer lip 48-59) get pink
    skin=ms[0]; c,ipd=eyec(V); lmx=(V[lm]-c)/ipd
    from matplotlib.path import Path
    po=Path(lmx[48:60,:2]); inside=po.contains_points(skin.vertices[:,:2]) & (skin.vertices[:,2]>lmx[:,2].min()-0.1)
    cols=skin.visual.vertex_colors.copy(); cols[inside]=[205,120,125,255]; skin.visual.vertex_colors=cols
    sc=trimesh.Scene(); [sc.add_geometry(m,node_name=f'p{i}') for i,m in enumerate(ms)]
    sc.export(f'/tmp/f/src/karma_face_stage1_{tag}_{nm}_EXPERIMENT.glb')
    print(nm,'tris',sum(len(m.faces) for m in ms),'verts',sum(len(m.vertices) for m in ms),'extent head',np.ptp(ms[0].vertices,0).round(2))
