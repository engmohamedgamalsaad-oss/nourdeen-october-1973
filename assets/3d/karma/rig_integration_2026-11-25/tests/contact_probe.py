#!/usr/bin/env python3
"""Drives test_page.html in headless Chrome: clicks every motion button, fast-forwards the simulation, records state/visibility/in-view, saves a screenshot per motion.
Usage: python3 motion_page.py <serve_root> <page path> <out_dir> [desktop|phone]   (needs node_modules/three under serve_root)"""
import subprocess, sys, time, json, base64, urllib.request, websocket, os
root, page, out = sys.argv[1], sys.argv[2], sys.argv[3]; vp = sys.argv[4] if len(sys.argv) > 4 else 'desktop'
os.makedirs(out, exist_ok=True)
srv = subprocess.Popen(['python3', '-m', 'http.server', '8767'], cwd=root, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
w, h, mob = (1440, 900, False) if vp == 'desktop' else (390, 844, True)
ch = subprocess.Popen(['google-chrome', '--headless=new', '--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--remote-debugging-port=9335', f'--window-size={w},{h}', 'about:blank'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
res = {}
try:
    for _ in range(30):
        time.sleep(1)
        try: tabs = json.load(urllib.request.urlopen('http://127.0.0.1:9335/json')); break
        except Exception: pass
    ws = websocket.create_connection([t for t in tabs if t['type'] == 'page'][0]['webSocketDebuggerUrl'], timeout=100, suppress_origin=True)
    n = [0]; errors = []
    def call(m, p=None):
        n[0] += 1; ws.send(json.dumps({'id': n[0], 'method': m, 'params': p or {}}))
        while True:
            r = json.loads(ws.recv())
            if r.get('method') == 'Runtime.exceptionThrown': errors.append(r['params']['exceptionDetails'].get('exception', {}).get('description', 'exc')[:200])
            if r.get('id') == n[0]: return r
    ev = lambda e: call('Runtime.evaluate', {'expression': e, 'returnByValue': True, 'awaitPromise': True})['result']['result'].get('value')
    call('Runtime.enable'); call('Page.enable')
    call('Emulation.setDeviceMetricsOverride', {'width': w, 'height': h, 'deviceScaleFactor': 1, 'mobile': mob})
    call('Page.addScriptToEvaluateOnNewDocument', {'source': "window.__t=1;"})
    call('Page.navigate', {'url': f'http://localhost:8767/{page}?guard=0&three=http://localhost:8767/node_modules/three'})
    for _ in range(60):
        time.sleep(1)
        if ev("!!window.__karmaStage") : break
    assert ev("!!window.__karmaStage"), 'stage did not start: ' + str(errors)
    ev("scrollTo(0,150)")
    names = ev("[...document.querySelectorAll('#bar button')].map(b=>b.textContent)")
    ev("document.querySelectorAll('#bar button')[%d].click()" % names.index('Lean on card')); 
    JS = """(()=>{const s=__karmaStage,c=s.controller;const bn=s.rig.bones||s.rig.bone||s.rig;const out={keys:Object.keys(s.rig).slice(0,8)};
      const cards=[...document.querySelectorAll('.story-index-card')].map(e=>e.getBoundingClientRect());
      const vw=innerWidth,vh=innerHeight;const P=(n)=>{const o=(bn[n]||(s.rig.getBone&&s.rig.getBone(n)));if(!o)return null;o.updateWorldMatrix(true,false);const e=o.matrixWorld.elements;return {x:e[12]+vw/2,y:vh/2-e[13]}};
      const d=(p,r)=>{const dx=Math.max(r.left-p.x,0,p.x-r.right),dy=Math.max(r.top-p.y,0,p.y-r.bottom);return Math.hypot(dx,dy)};
      const res={state:c.stateName,pos:[c.pos.x,c.pos.y],charH:c.charH,halfW:c.halfW,hands:{}};
      for(const n of ['Hand_L','Hand_R','Forearm_L','Forearm_R']){const p=P(n);if(!p){res.hands[n]=null;continue}const near=cards.map(r=>d(p,r)).sort((a,b)=>a-b)[0];res.hands[n]={x:Math.round(p.x),y:Math.round(p.y),gap_to_nearest_card_px:Math.round(near)}}
      const nr=cards.filter(r=>Math.abs(((r.right+r.left)/2)-c.pos.x)<400&&c.pos.y>r.top&&c.pos.y-c.charH<r.bottom).sort((a,b)=>Math.abs(a.right-c.pos.x)-Math.abs(b.right-c.pos.x))[0];res.card_right=nr&&Math.round(nr.right);if(nr){for(const n of ['Hand_L','Hand_R']){const p=res.hands[n];if(p)p.penetration_into_card_px=Math.round(nr.right-p.x)}};res.nearestCardRight=cards.map(r=>Math.round(r.right)).filter(v=>Math.abs(v-c.pos.x)<200);return res})()"""
    for t in (0.5, 1.5, 2.5, 3.5):
        ev(f"window.__karmaStage.fastForward({0.9 if t==0.5 else 1.0})")
        print(t, json.dumps(ev(JS)))
finally:
    ch.kill(); srv.kill()
