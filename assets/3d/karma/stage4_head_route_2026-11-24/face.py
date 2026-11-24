import numpy as np
from PIL import Image,ImageDraw,ImageFilter
import geo
from geo import u,EYE_Y
ey=lambda k: EYE_Y-k*u
TS=1024;W=0.26
def tc(x,y): return ((0.5+x/W)*TS,(0.5-(y-0.82)/W)*TS)
def uvmap(P): return np.stack([0.5+P[:,0]/W,0.5+(P[:,1]-0.82)/W],-1)   # v up; sample with flip
def paint():
    im=Image.new('RGB',(TS,TS),(246,196,168));dr=ImageDraw.Draw(im,'RGBA')
    # blush
    bl=Image.new('RGBA',(TS,TS),(0,0,0,0));bd=ImageDraw.Draw(bl)
    for s in(-1,1):
        x,y=tc(s*0.85*u,ey(0.55));r=0.030/W*TS;bd.ellipse([x-r*1.3,y-r,x+r*1.3,y+r],fill=(240,140,120,150))
    bl=bl.filter(ImageFilter.GaussianBlur(26));im.paste(bl,(0,0),bl);dr=ImageDraw.Draw(im,'RGBA')
    # brows
    for s in(-1,1):
        pts=[tc(s*(0.30+0.78*t)*u,ey(-0.30-0.12*np.sin(t*np.pi)+0.05*t)) for t in np.linspace(0,1,12)]
        dr.line(pts,fill=(70,45,35,230),width=16,joint='curve')
    # mouth open smile
    L=0.56*u;top=ey(0.86);bot=ey(1.16);cor=ey(0.80)
    def mp(t,y0,y1): return tc(-L+2*L*t,y0+(y1-y0)*np.sin(np.pi*t))
    outer=[tc(-L+2*L*t,cor+(top-cor)*np.sin(np.pi*t)+0.0) for t in np.linspace(0,1,24)]
    lower=[tc(-L+2*L*t,cor-(cor-bot)*np.sin(np.pi*t)) for t in np.linspace(1,0,24)]
    dr.polygon(outer+lower,fill=(216,92,108,255))
    # inner mouth
    Li=0.50*u;itop=ey(0.90);ibot=ey(1.10);icor=ey(0.83)
    inner=[tc(-Li+2*Li*t,icor+(itop-icor)*np.sin(np.pi*t)) for t in np.linspace(0,1,24)]+[tc(-Li+2*Li*t,icor-(icor-ibot)*np.sin(np.pi*t)) for t in np.linspace(1,0,24)]
    dr.polygon(inner,fill=(92,30,36,255))
    # teeth upper
    tt=[tc(-Li*0.92+2*Li*0.92*t,icor+(itop-icor)*np.sin(np.pi*t)) for t in np.linspace(0,1,24)]+[tc(Li*0.92-2*Li*0.92*t,icor+(itop-icor)*np.sin(np.pi*(1-t))-(0.20*u)*np.sin(np.pi*(1-t))**0.6) for t in np.linspace(0,1,24)]
    dr.polygon(tt,fill=(252,250,244,255))
    # tongue
    tg=[tc(-Li*0.55+2*Li*0.55*t,ibot+(0.12*u)*np.sin(np.pi*t)) for t in np.linspace(0,1,16)]+[tc(Li*0.55,ibot),tc(-Li*0.55,ibot)]
    dr.polygon(tg,fill=(214,110,120,255))
    # lip outline
    dr.line(outer,fill=(190,70,90,255),width=6);dr.line(lower,fill=(190,70,90,255),width=6)
    # nostrils
    for s in(-1,1):
        x,y=tc(s*0.14*u,ey(0.62));dr.ellipse([x-8,y-5,x+8,y+5],fill=(150,80,70,170))
    return im
if __name__=='__main__':
    paint().save('face_tex.png')
