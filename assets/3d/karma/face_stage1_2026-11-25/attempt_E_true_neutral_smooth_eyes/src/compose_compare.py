"""Builds reference-next-to-render comparison sheets. Needs the PRIVATE reference crops and landmark arrays (not in repo); only the output sheets are committed.
Scale: reference scaled so inter-pupil distance = 300 px, pupil midpoint at (300,210); render camera is orthographic with the same scale and centre. Render rolled to the reference roll."""
import numpy as np
from PIL import Image,ImageDraw
def ref_tile(n):
    a=np.load('lm_%s.npy'%n)[:,:2];im=Image.open('crop_%s.png'%n).convert('RGB')
    p1,p2=sorted([a[468],a[473]],key=lambda p:p[0]);d=p2-p1;ipd=np.hypot(*d);roll=np.degrees(np.arctan2(d[1],d[0]));mid=(p1+p2)/2
    k=300/ipd;im=im.resize((int(im.width*k),int(im.height*k)),Image.LANCZOS);mid=mid*k
    t=Image.new('RGB',(600,600),(43,48,56));t.paste(im,(int(300-mid[0]),int(210-mid[1])));return t,roll
def rnd_tile(sheet,idx,roll):
    t=sheet.crop((idx*600,0,idx*600+600,600));return t.rotate(-roll,center=(300,210),resample=Image.BICUBIC,fillcolor=(43,48,56))
def label(t,s):
    d=ImageDraw.Draw(t);d.rectangle((0,0,600,22),fill=(0,0,0));d.text((6,5),s,fill=(255,255,255));return t
S=Image.open('Dm_smile.png').convert('RGB');N=Image.open('Dm_neutral.png').convert('RGB')
rows=[]
for n in('stand','wave','clasp'):
    r,roll=ref_tile(n)
    rows.append([label(r,'REFERENCE %s (yaw~4deg, roll %.1f)'%(n,roll)),label(rnd_tile(S,0,roll),'E smile, yaw 4.5, same scale/roll'),label(rnd_tile(N,0,roll),'E neutral, yaw 4.5, same scale/roll')])
def sheet(rows,out):
    W=Image.new('RGB',(1800,600*len(rows)))
    for i,r in enumerate(rows):
        for j,t in enumerate(r):W.paste(t,(j*600,i*600))
    W.save(out)
sheet(rows,'compare_front_matched.png')
r,roll=ref_tile('stand')
sheet([[label(r,'REFERENCE stand (no 3/4 view exists in references; yaw~4deg)'),label(rnd_tile(S,1,roll),'E smile, yaw 35 (NOT matched)'),label(rnd_tile(N,1,roll),'E neutral, yaw 35 (NOT matched)')]],'compare_three_quarter.png')
