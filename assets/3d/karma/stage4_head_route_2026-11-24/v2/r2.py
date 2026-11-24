import pickle,rend,sys
from PIL import Image
parts=pickle.load(open('parts_v2.pkl','rb'))
S=int(sys.argv[1]) if len(sys.argv)>1 else 900
rend.render(parts,S=S,R=0.14,cy=0.82).save('head_front_v2.png')
for nm,y in(('q34',0.6),('side',1.45)): rend.render(parts,S=500,R=0.14,cy=0.82,yaw=y).save(f'head_{nm}_v2.png')
a=[Image.open(f'head_{n}_v2.png').resize((420,420)) for n in('front','q34','side')]
c=Image.new('RGB',(1260,420));[c.paste(x,(i*420,0)) for i,x in enumerate(a)];c.save('head_views_v2.png')
