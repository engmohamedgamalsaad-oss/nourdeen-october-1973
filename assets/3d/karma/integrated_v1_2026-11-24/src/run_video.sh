#!/bin/bash
# usage: run_video.sh model.glb outprefix
for from in 0 48 96 144; do python3 cdp_run.py "video_page.html?glb=$1&from=$from&zoom=${ZOOM:-0}" $2_sheet$from.png $2_log$from.txt || exit 1; done
python3 - "$2" <<'P'
import sys,os;from PIL import Image
p=sys.argv[1];Z=os.environ.get('ZOOM')=='1';CW,CH=(300,340) if Z else (400,210);os.makedirs(p+'_frames',exist_ok=True)
for fr in (0,48,96,144):
    im=Image.open(f'{p}_sheet{fr}.png')
    for k in range(48):
        c,r=k%8,k//8;f=fr+k
        if f>=195: break
        im.crop((c*CW,r*CH,c*CW+CW,r*CH+CH)).save(f'{p}_frames/f{f:04d}.png')
P
ffmpeg -y -loglevel error -framerate 10 -i ${2}_frames/f%04d.png -c:v libx264 -pix_fmt yuv420p $2.mp4
