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
    call('Page.navigate', {'url': f'http://localhost:8767/{page}?three=http://localhost:8767/node_modules/three'})
    for _ in range(60):
        time.sleep(1)
        if ev("!!window.__karmaStage") : break
    assert ev("!!window.__karmaStage"), 'stage did not start: ' + str(errors)
    ev("scrollTo(0,150)")
    names = ev("[...document.querySelectorAll('#bar button')].map(b=>b.textContent)")
    for i, nm in enumerate(names):
        ev(f"document.querySelectorAll('#bar button')[{i}].click()")
        ev("window.__karmaStage.fastForward(7)")
        s = ev("(()=>{const c=__karmaStage.controller;return {state:c.stateName,x:Math.round(c.pos.x),y:Math.round(c.pos.y),visible:c.object3D.visible,inView:c.pos.x-c.halfW>=-1&&c.pos.x+c.halfW<=innerWidth+1&&c.pos.y<=innerHeight+3,log:document.getElementById('log').textContent}})()")
        res[nm] = s
        shot = call('Page.captureScreenshot', {'format': 'png'})['result']['data']
        open(f'{out}/motion_{vp}_{i:02d}_{nm.replace(" ", "_")}.png', 'wb').write(base64.b64decode(shot))
        print(vp, nm, json.dumps(s), flush=True)
    res['js_errors'] = errors[:5]
    json.dump(res, open(f'{out}/motion_page_result_{vp}.json', 'w'), indent=1)
finally:
    ch.kill(); srv.kill()
