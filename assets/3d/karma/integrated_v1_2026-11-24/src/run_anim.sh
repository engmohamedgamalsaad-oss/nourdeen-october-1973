#!/bin/bash
# usage: run_anim.sh model.glb out.png out.txt   (serves cwd; needs node_modules/three, canonical JS beside)
python3 -m http.server 8765 >/tmp/http.log 2>&1 & HP=$!; sleep 2
for i in $(seq 1 25); do timeout 110 google-chrome --headless=new --no-sandbox --use-gl=angle --use-angle=swiftshader --enable-unsafe-swiftshader --virtual-time-budget=300000 --dump-dom "http://localhost:8765/anim_page.html?glb=$1" 2>/dev/null > /tmp/anim_dom.html; grep -q "id=\"png\"" /tmp/anim_dom.html && break; done
kill $HP
python3 - "$2" "$3" <<'P'
import re,sys,base64
s=open('/tmp/anim_dom.html').read()
m=re.search(r'<textarea id="png">data:image/png;base64,([^<]*)</textarea>',s);open(sys.argv[1],'wb').write(base64.b64decode(m.group(1)))
l=re.search(r'<pre id="log"[^>]*>(.*?)</pre>',s,re.S).group(1);open(sys.argv[2],'w').write(l)
P
