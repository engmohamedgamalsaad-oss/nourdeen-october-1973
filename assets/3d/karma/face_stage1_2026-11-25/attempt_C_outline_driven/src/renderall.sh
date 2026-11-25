#!/bin/bash
cd /tmp/f
./shot.sh karma_face_stage1_C.glb /tmp/f/C_clay.png 1 1 >/dev/null
./shot.sh karma_face_stage1_C.glb /tmp/f/C_tex.png 0 1 >/dev/null
./shot.sh karma_face_stage1_C.glb /tmp/f/C_head_clay.png 1 0 >/dev/null
./shot.sh karma_face_stage1_C.glb /tmp/f/C_head_tex.png 0 0 >/dev/null
python3 - <<'P'
from PIL import Image
for n in ['C_clay','C_tex','C_head_clay','C_head_tex']: Image.open(f'/tmp/f/{n}.png').crop((0,0,1800,600)).save(f'/tmp/f/{n}.png')
a=Image.open('/tmp/f/C_clay.png');b=Image.open('/tmp/f/C_head_clay.png')
s=Image.new('RGB',(1800,1200));s.paste(a,(0,0));s.paste(b,(0,600));s.save('/tmp/f/v_both.png')
P
