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
    TIMES = {'Jump': [0.1, 0.2, 0.3, 0.4, 0.5, 0.6], 'Run': [0.4, 0.8, 1.2, 1.8, 2.6], 'Walk': [0.6, 1.4, 2.4, 3.4, 4.4]}
    DEF = [0.3, 0.8, 1.4, 2.0, 2.8]
    sheets = []
    ONLY = [x for x in os.environ.get('KARMA_MOTIONS', '').split(',') if x]
    for i, nm in enumerate(names):
        if ONLY and nm not in ONLY: continue
        if nm in ('Walk', 'Run', 'Lean on card'):
            ev(("(()=>{const c=__karmaStage.controller;c.cancelActions&&c.cancelActions();c.pos.x=(__MODE__=='run'?-c.halfW*2:innerWidth+c.halfW*2+40);c.stand();})()").replace('__MODE__', repr('run' if nm == 'Run' else 'x')))
            ev("window.__karmaStage.fastForward(0.5)")
        else:
            if ev("__karmaStage.controller.pos.x>innerWidth"):
                ev("document.querySelectorAll('#bar button')[%d].click()" % names.index('Walk')); ev("window.__karmaStage.fastForward(8)")
            ev("window.__karmaStage.fastForward(1.5)")
        ev(f"document.querySelectorAll('#bar button')[{i}].click()")
        t0 = 0; frames = []
        for t in TIMES.get(nm, DEF):
            ev(f"window.__karmaStage.fastForward({round(t - t0, 3)})"); t0 = t
            st = ev("(()=>{const c=__karmaStage.controller;return {state:c.stateName,x:Math.round(c.pos.x),y:Math.round(c.pos.y),oy:+(c.jumpDY||0).toFixed(1),visible:c.object3D.visible,halfW:c.halfW,charH:c.charH,inView:c.pos.x-c.halfW>=-1&&c.pos.x+c.halfW<=innerWidth+1}})()")
            shot = call('Page.captureScreenshot', {'format': 'png'})['result']['data']
            fn = f'{out}/frame_{vp}_{i:02d}_{nm.replace(" ", "_")}_{int(t*1000):04d}ms.png'; open(fn, 'wb').write(base64.b64decode(shot))
            frames.append((t, st, fn))
        ev("window.__karmaStage.fastForward(6)")
        end = ev("(()=>{const c=__karmaStage.controller;return {state:c.stateName,x:Math.round(c.pos.x),y:Math.round(c.pos.y),visible:c.object3D.visible}})()")
        res[nm] = {'frames': [{'t': t, **st} for t, st, _ in frames], 'end': end}
        print(vp, nm, [(t, st['state'], st['x'], st['y'], st['visible']) for t, st, _ in frames], 'end', end, flush=True)
        # labeled contact sheet with full-body padding (crop box fixed around the union of positions so limbs never clip)
        xs = [st['x'] for _, st, _ in frames]; hw = frames[0][1]['halfW']; chp = frames[0][1]['charH']; ys = [st['y'] for _, st, _ in frames]
        pad = 40; l = max(min(xs) - hw - pad, 0); r = min(max(xs) + hw + pad, w); t_ = max(min(ys) - chp - pad - 30, 0); b_ = min(max(ys) + pad, h)
        cw, chh = int(r - l), int(b_ - t_); sc = 260 / max(cw, 1)
        tw, th = int(cw * sc), int(chh * sc) + 34
        sh = Image.new('RGB', (tw * len(frames), th), 'white'); d = ImageDraw.Draw(sh)
        for k, (t, st, fn) in enumerate(frames):
            im = Image.open(fn).convert('RGB').crop((int(l), int(t_), int(r), int(b_))).resize((tw, int(chh * sc)))
            sh.paste(im, (k * tw, 34)); d.text((k * tw + 4, 2), f"{nm} t={t}s", fill='black'); d.text((k * tw + 4, 16), f"{st['state']} x={st['x']} dy={st['oy']}{'' if st['visible'] else ' HIDDEN'}", fill='red' if not st['visible'] else 'black')
        sh.save(f'{out}/sheet_{vp}_{i:02d}_{nm.replace(" ", "_")}.png'); sheets.append(f'{out}/sheet_{vp}_{i:02d}_{nm.replace(" ", "_")}.png')
    res['js_errors'] = errors[:5]
    json.dump(res, open(f'{out}/motion_page_result_{vp}_' + (os.environ.get('KARMA_MOTIONS','all').replace(',','-').replace(' ','_')) + '.json', 'w'), indent=1)
finally:
    ch.kill(); srv.kill()
