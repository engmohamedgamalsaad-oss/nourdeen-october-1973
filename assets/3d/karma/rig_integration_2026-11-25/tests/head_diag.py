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
    from PIL import Image, ImageDraw
    ev("document.querySelectorAll('#bar button')[%d].click()" % names.index('Walk')); ev("window.__karmaStage.fastForward(8)")
    ev("(()=>{const c=__karmaStage.controller;window.__o=c._poseIdle.bind(c);window.__X=[0,0,0,0];c._poseIdle=(T)=>{window.__o(T);const x=window.__X;T.Head=[0,x[1],0];T.Neck=[0,x[2],0];T.Chest=[0,x[3],0];c._yawTarget=x[0];};})()")
    cases = [('A_body_yaw_only_0.55', [0.55,0,0,0]), ('B_head_neck_chest_only_0.25/0.1/0.1', [0,0.25,0.1,0.1]), ('C_point_combo', [0.55,0.25,0.1,0.1]), ('D_head_only_0.8', [0,0.8,0,0])]
    frames = []
    for nm, x in cases:
        ev(f"window.__X={json.dumps(x)}"); ev("window.__karmaStage.fastForward(1.2)")
        st = ev("(()=>{const c=__karmaStage.controller;return {x:Math.round(c.pos.x),y:Math.round(c.pos.y),h:c.charH,hw:c.halfW}})()")
        shot = call('Page.captureScreenshot', {'format': 'png'})['result']['data']
        fn = f'{out}/diag_{nm[0]}.png'; open(fn, 'wb').write(base64.b64decode(shot)); frames.append((nm, st, fn))
    st = frames[0][1]; l = st['x'] - 80; t = st['y'] - st['h'] - 20; r = st['x'] + 80; b = st['y'] + 10
    sh = Image.new('RGB', (320 * 4 // 2 * 2, 40 + int((b - t) * 2)), 'white'); d = ImageDraw.Draw(sh)
    sh = Image.new('RGB', (320 * 4, 40 + int((b - t) * 2)), 'white'); d = ImageDraw.Draw(sh)
    for k, (nm, st, fn) in enumerate(frames):
        im = Image.open(fn).convert('RGB').crop((int(l), int(t), int(r), int(b))).resize((320, int((b - t) * 2)))
        sh.paste(im, (k * 320, 40)); d.text((k * 320 + 4, 4), nm.replace('_', ' '), fill='black')
    sh.save(f'{out}/head_diagnosis_sheet.png')
finally:
    ch.kill(); srv.kill()
