#!/usr/bin/env python3
"""Real-browser test of the Karma stage on the real site page (headless Chrome via CDP, software GL).
Usage: python3 browser_stage.py <repo_root> <glb path relative to repo root> <out_dir> [page=index.html]
Serves the repo root on :8766 (needs node_modules/three at the repo root: npm i three@0.170.0).
For each viewport (desktop 1440x900, phone 390x844 touch): loads page?karma=1, samples the character every 0.5 s for a while while the page scrolls,
checks numerically: canvas present, GLB loaded, character box inside viewport, no overlap with any story card, no JS errors; saves screenshots.
A failing GLB URL must leave the page intact (checked with a bad URL)."""
import subprocess, sys, time, json, base64, urllib.request, websocket, os
root, glb, out = sys.argv[1], sys.argv[2], sys.argv[3]; page = sys.argv[4] if len(sys.argv) > 4 else 'index.html'
CARDSEL = os.environ.get('KARMA_CARDS', '.gate')
os.makedirs(out, exist_ok=True); N = int(os.environ.get('KARMA_SAMPLES', '30'))
srv = subprocess.Popen(['python3', '-m', 'http.server', '8766'], cwd=root, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
ch = subprocess.Popen(['google-chrome', '--headless=new', '--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--remote-debugging-port=9334', '--window-size=1440,900', '--user-data-dir=/tmp/cdpprof2', 'about:blank'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
results = {}
try:
    tabs = None
    for _ in range(30):
        time.sleep(1)
        try: tabs = json.load(urllib.request.urlopen('http://127.0.0.1:9334/json')); break
        except Exception: pass
    assert tabs, 'chrome did not start'
    ws = websocket.create_connection([t for t in tabs if t['type'] == 'page'][0]['webSocketDebuggerUrl'], timeout=180, suppress_origin=True)
    n = [0]; errors = []; loaded = {}
    def call(m, p=None):
        n[0] += 1; ws.send(json.dumps({'id': n[0], 'method': m, 'params': p or {}}))
        while True:
            r = json.loads(ws.recv())
            if r.get('method') == 'Runtime.exceptionThrown': errors.append(r['params']['exceptionDetails'].get('exception', {}).get('description', 'exception')[:200])
            if r.get('method') == 'Network.responseReceived':
                rp = r['params']['response']
                if rp['url'].split('?')[0].endswith('.js') and 'localhost:8766' in rp['url'] and 'node_modules' not in rp['url']: loaded[rp['url']] = {'requestId': r['params']['requestId'], 'status': rp['status'], 'fromDiskCache': rp.get('fromDiskCache'), 'fromServiceWorker': rp.get('fromServiceWorker')}
            if r.get('id') == n[0]: return r
    def ev(expr): return call('Runtime.evaluate', {'expression': expr, 'returnByValue': True, 'awaitPromise': True})['result']['result'].get('value')
    call('Runtime.enable'); call('Page.enable'); call('Network.enable'); call('Network.setCacheDisabled', {'cacheDisabled': True})
    SAMPLE = """(()=>{const s=window.__karmaStage; if(!s) return null; const c=s.controller; const cards=[...document.querySelectorAll('__SEL__, .kh-sp, h1, h2, h3, .lead, .eyebrow, .heading p, .hero p, .hero img, footer, header')].map(e=>e.getBoundingClientRect());
      const b={l:c.pos.x-c.halfW,r:c.pos.x+c.halfW,t:c.pos.y-c.charH,b:c.pos.y};
      const rb=s.bounds&&s.bounds(); const fb=s.fastBounds&&s.fastBounds(); const pen=(k)=>rb?Math.min(Math.min(rb.r,k.right)-Math.max(rb.l,k.left),Math.min(rb.b,k.bottom)-Math.max(rb.t,k.top)):0; const rpen=rb?Math.max(0,...cards.filter(k=>k.width>0).map(pen)):0;
      const ov=cards.filter(k=>k.width>0&&b.l<k.right-1&&b.r>k.left+1&&b.t<k.bottom-1&&b.b>k.top+1).length;
      return {state:c.stateName,x:c.pos.x,y:c.pos.y,vw:innerWidth,vh:innerHeight,halfW:c.halfW,charH:c.charH,overlap:ov,fb:fb&&{l:Math.round(fb.l),r:Math.round(fb.r),t:Math.round(fb.t),b:Math.round(fb.b)},dbg:(s.debug?JSON.stringify(s.debug()).slice(0,260):null),rendered_pen_px:Math.round(rpen*10)/10,rb:rb&&{l:Math.round(rb.l),r:Math.round(rb.r),t:Math.round(rb.t),b:Math.round(rb.b)},visible:c.object3D.visible,overlap_visible:c.object3D.visible?ov:0,inView:(b.l>=-1&&b.r<=innerWidth+1&&b.b<=innerHeight+3),scrollY:scrollY,visits:s.state.visits,lastError:s.state.lastError};})()"""
    for name, w, h, mob in [v for v in [('desktop', 1440, 900, False), ('phone', 390, 844, True)] if os.environ.get('KARMA_ONLY', v[0]) == v[0]]:
        for variant in ('good', 'badglb'):
            errors.clear()
            call('Emulation.setDeviceMetricsOverride', {'width': w, 'height': h, 'deviceScaleFactor': 1, 'mobile': mob})
            call('Emulation.setTouchEmulationEnabled', {'enabled': mob})
            g = ('/' + glb) if variant == 'good' else '/does/not/exist.glb'
            call('Page.addScriptToEvaluateOnNewDocument', {'source': "window.KARMA_THREE_BASE='http://localhost:8766/node_modules/three';"})
            call('Page.navigate', {'url': f'http://localhost:8766/{page}?karma=1&glb={g}'})
            t0 = time.time(); samples = []; shots = 0
            for i in range(N if variant == 'good' else 6):
                time.sleep(0.4 if variant == 'good' else 1.0)
                if variant == 'good': ev("window.__karmaStage ? window.__karmaStage.fastForward(1.0) : 0")
                if variant == 'good' and i == 1 and CARDSEL != '.gate' and not os.environ.get('KARMA_NOSCROLL'): ev("(document.querySelector('"+CARDSEL+"')||document.body).scrollIntoView({block:'start'});scrollBy(0,-90)")
                if variant == 'good' and i == N//2 and not os.environ.get('KARMA_NOSCROLL'): ev("window.scrollTo(0, document.body.scrollHeight*0.45)")
                if variant == 'good' and i == (N*3)//4 and not os.environ.get('KARMA_NOSCROLL'): ev("window.scrollTo(0, 0)")
                s = ev(SAMPLE.replace('__SEL__', CARDSEL))
                if s: samples.append(s)
                if variant == 'good' and i in [int(v) for v in os.environ.get('KARMA_SHOTS', '4,9,%d,%d,%d' % (N//2-1, N//2+6, N-2)).split(',')]:
                    d = call('Page.captureScreenshot', {'format': 'png'})['result']['data']; open(f'{out}/{name}_{variant}_{i:02d}s.png', 'wb').write(base64.b64decode(d)); shots += 1
            page_ok = ev("document.querySelectorAll('"+CARDSEL+"').length")
            canvas = ev("!!document.getElementById('karma-stage')")
            results[f'{name}_{variant}'] = {'samples': len(samples), 'trace': [{k: x.get(k) for k in ('state','x','y','visible','overlap','rendered_pen_px','rb','fb','scrollY','dbg')} for x in samples], 'states': sorted({s['state'] for s in samples}), 'max_rendered_penetration_px_visible': max([s['rendered_pen_px'] for s in samples if s['visible']] or [0]), 'max_rendered_penetration_px_all': max([s['rendered_pen_px'] for s in samples] or [0]), 'rendered_pen_gt3_visible_samples': sum(1 for s in samples if s['visible'] and s['rendered_pen_px']>3), 'max_VISIBLE_overlap': max([s['overlap_visible'] for s in samples] or [0]), 'hidden_samples': sum(1 for s in samples if not s['visible']), 'visible_samples': sum(1 for s in samples if s['visible']), 'max_overlap_all_states': max([s['overlap'] for s in samples] or [0]),
                'max_overlap_while_stationary': max([s['overlap'] for s in samples if s['state'] not in ('walk',)] or [0]),
                'samples_overlapping_while_walking': sum(1 for s in samples if s['state'] == 'walk' and s['overlap']),
                'in_view_after_arrival': all(s['inView'] for s in samples[[i for i, x in enumerate(samples) if x['state'] != 'walk' and x['x'] < x['vw']][0]:]) if any(x['state'] != 'walk' and x['x'] < x['vw'] for x in samples) else None,
                'visits': samples[-1]['visits'] if samples else None, 'lastError': samples[-1]['lastError'] if samples else None, 'state_extra': ev('JSON.stringify({rw: window.__karmaStage && window.__karmaStage.state.restWalk, rr: window.__karmaStage && window.__karmaStage.state.restRects, fpMs: window.__karmaStage && window.__karmaStage.state.fpMs, fpCalls: window.__karmaStage && window.__karmaStage.state.fpCalls})'), 'canvas_present_at_end': canvas, 'gate_cards_still_in_page': page_ok, 'js_errors': list(errors)[:5], 'final': samples[-1] if samples else None}
            print(name, variant, json.dumps(results[f'{name}_{variant}'])[:600], flush=True)
    import hashlib; hs = {}
    for u, m in loaded.items():
        try:
            gb = call('Network.getResponseBody', {'requestId': m['requestId']})['result']; body = gb['body']; m['sha256_served_body'] = hashlib.sha256((base64.b64decode(body) if gb.get('base64Encoded') else body.encode()).decode('utf8', 'replace').encode()).hexdigest()[:16]
        except Exception as ex: m['sha256_served_body'] = 'unavailable: ' + str(ex)[:60]
        fp = os.path.join(root, u.split('localhost:8766/')[1].split('?')[0])
        if os.path.exists(fp): hs[u] = dict(m, sha256_on_disk=hashlib.sha256(open(fp, 'rb').read()).hexdigest()[:16])
    try: rev = subprocess.check_output(['git', '-C', root, 'rev-parse', '--short', 'HEAD']).decode().strip() + ('+dirty' if subprocess.check_output(['git', '-C', root, 'status', '--porcelain', '--untracked-files=no']).strip() else '')
    except Exception: rev = None
    results['_run'] = {'git_head': rev, 'cache_disabled': True, 'loaded_js': hs, 'any_from_cache': any(v.get('fromDiskCache') for v in hs.values())}
    json.dump(results, open(f'{out}/browser_stage_result_' + os.environ.get('KARMA_ONLY', 'all') + '.json', 'w'), indent=1)
finally:
    ch.kill(); srv.kill()
