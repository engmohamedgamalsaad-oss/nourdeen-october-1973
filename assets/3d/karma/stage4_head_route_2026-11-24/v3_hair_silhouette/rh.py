import pickle,rend,sys
from PIL import Image
parts=pickle.load(open('parts_head_hair_v1.pkl','rb'))
views=[('front',0),('q34',0.6),('side',1.5708),('back',3.1416)]
ims=[]
for nm,y in views:
    im=rend.render(parts,S=520,R=0.30,cx=0,cy=0.80,yaw=y,light=(0.12,0.25,1.0) if nm!='back' else (0.1,0.3,-1.0));im.save(f'hh_{nm}_v1.png');ims.append(im)
c=Image.new('RGB',(2080,520));[c.paste(x,(i*520,0)) for i,x in enumerate(ims)];c.resize((1560,390)).save('hh_views_v1.png')
