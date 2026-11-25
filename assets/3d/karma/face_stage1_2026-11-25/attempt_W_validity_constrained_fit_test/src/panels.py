import sys;sys.path.insert(0,__import__('os').path.dirname(__import__('os').path.abspath(__file__))); from cfg import *
from load import load; from rast import *; from fit import LM
from PIL import Image,ImageDraw
import numpy as np, json
S=400; BOX=(-1.1,1.1,-1.8,0.55)
DQ=REPO+'/assets/3d/karma/face_stage1_2026-11-25/attempt_Q_wider_eyes_lighter_nose_cheeks/'
Q=json.load(open(OUT+'/Q_measured_from_GLB_renders.json'))
def loadQ(e):
    V,C,I=load(DQ+f'karma_face_stage1_Q_{e}_EXPERIMENT.glb'); V=V.astype(float)
    ipd=Q['ipd_glb_units']; ey=Q['eye_line_y_glb_units']; V[:,0]/=ipd; V[:,1]=(V[:,1]-ey)/ipd; V[:,2]/=ipd
    return V,C,I.reshape(-1,3).astype(int)
def loadM(e):
    V,C,I=load(OUT+f'/karma_face_MH_{e}_W.glb'); return V.astype(float),C,I.reshape(-1,3).astype(int)
PUP={'stand':(REFDIR+'/image-de4a722b.jpg',(563,246),(657,232)),'wave':(REFDIR+'/image-0b5b46c1.jpg',(583.3,240.7),(672,226)),'clasp':(REFDIR+'/image-89132d01.jpg',(564,284),(660.7,268.3))}
def refcrop(k,box=BOX,S=S,grid=True):
    f,p1,p2=PUP[k]; im=Image.open(f).convert('RGB')
    c=((p1[0]+p2[0])/2,(p1[1]+p2[1])/2); dx,dy=p2[0]-p1[0],p2[1]-p1[1]; ipd=np.hypot(dx,dy); a,b=dx/ipd,dy/ipd
    x0,x1,y0,y1=box; W=int((x1-x0)*S);H=int((y1-y0)*S)
    # output (u,v)->X=x0+u/S, Y=y1-v/S ; source = c + ipd*(X a + Y b, X b - Y a)
    # affine coeffs for PIL: (A,B,C,D,E,F): xs=A u+B v+C ; ys=D u+E v+F
    A=ipd*a/S; B=-ipd*b/S; Cx=c[0]+ipd*((x0)*a+(y1)*b)
    D=ipd*b/S; E=ipd*a/S; Fy=c[1]+ipd*((x0)*b-(y1)*a)
    out=im.transform((W,H),Image.AFFINE,(A,B,Cx,D,E,Fy),resample=Image.BICUBIC)
    d=ImageDraw.Draw(out)
    if grid:
        for gx in np.arange(np.ceil(x0*2)/2,x1,0.5): d.line([((gx-x0)*S,0),((gx-x0)*S,H)],fill=(0,200,255),width=1)
        for gy in np.arange(np.ceil(y0*2)/2,y1,0.5): d.line([(0,(y1-gy)*S),(W,(y1-gy)*S)],fill=(0,200,255),width=1)
    d.text((6,H-12),f'reference ({k}) aligned to pupils',fill=(255,255,0)); return out
def lab(im,t): ImageDraw.Draw(im).text((6,4),t,fill=(255,255,0)); return im
def row(ims):
    W=sum(i.width for i in ims); o=Image.new('RGB',(W,ims[0].height)); x=0
    for i in ims: o.paste(i,(x,0)); x+=i.width
    return o
if __name__=='__main__':
    Vq,Cq,Tq=loadQ('smile'); Vm,Cm,Tm=loadM('smile')
    qs=render(Vq,Cq,Tq,BOX,S,0.5,'Q smile (from GLB)'); ms=render(Vm,Cm,Tm,BOX,S,0.5,'MakeHuman W (validity-constrained fit), smile (from GLB)')
    row([refcrop(k) for k in ('stand','wave','clasp')]).save(OUT+'/evidence/panel_refs_NOT_PUBLISHED.png')
    row([refcrop('stand'),refcrop('wave'),refcrop('clasp'),qs,ms]).save(OUT+'/evidence/front_smile_ref_Q_MH.png')
    Vq,Cq,Tq=loadQ('neutral'); Vm,Cm,Tm=loadM('neutral')
    row([render(Vq,Cq,Tq,BOX,S,0.5,'Q neutral (from GLB)'),render(Vm,Cm,Tm,BOX,S,0.5,'MakeHuman W (validity-constrained fit), neutral (from GLB)')]).save(OUT+'/evidence/front_neutral_Q_MH.png')
