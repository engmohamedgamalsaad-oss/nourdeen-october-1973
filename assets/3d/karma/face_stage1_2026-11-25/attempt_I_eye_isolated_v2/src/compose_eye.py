"""Eye comparison sheet. Needs PRIVATE reference crops and landmarks (not in repo). Top row: image-right eye of the 3 references, rolled level, IPD scale 667 px/IPD, pupil at (300,300). Bottom: isolated eye patch at yaw 0, 35, 75 (same scale and pupil position)."""
import numpy as np
from PIL import Image,ImageDraw
def ref(n):
    a=np.load('lm_%s.npy'%n)[:,:2];im=Image.open('crop_%s.png'%n).convert('RGB')
    p1,p2=sorted([a[468],a[473]],key=lambda p:p[0]);d=p2-p1;ipd=np.hypot(*d);roll=np.degrees(np.arctan2(d[1],d[0]))
    k=667/ipd;im=im.rotate(roll,center=tuple(p2),resample=Image.BICUBIC)   # level the pupil line
    im=im.resize((int(im.width*k),int(im.height*k)),Image.LANCZOS);c=p2*k
    t=Image.new('RGB',(600,600),(43,48,56));t.paste(im,(int(300-c[0]),int(300-c[1])));return t
R=Image.open('eye_anat.png').convert('RGB')
W=Image.new('RGB',(1800,1200))
for i,n in enumerate(['stand','wave','clasp']):
    t=ref(n);ImageDraw.Draw(t).text((6,5),'REFERENCE %s (image-right eye, roll removed)'%n,fill=(255,255,255));W.paste(t,(i*600,0))
    t=R.crop((i*600,0,i*600+600,600));ImageDraw.Draw(t).text((6,5),'isolated eye patch yaw %s'%['0','35','75'][i]+(' (matched scale, NOT matched pose)' if i else ''),fill=(255,255,255));W.paste(t,(i*600,600))
W.save('eye_compare.png')
