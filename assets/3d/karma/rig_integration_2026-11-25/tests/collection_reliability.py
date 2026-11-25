#!/usr/bin/env python3
"""(reliability) Drives a collection page in headless Chrome: clicks every motion button, fast-forwards the simulation, records state/visibility/in-view, saves a screenshot per motion.
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
    call('Page.addScriptToEvaluateOnNewDocument', {'source': "window.KARMA_THREE_BASE='http://localhost:8767/node_modules/three';"})
    call('Page.navigate', {'url': f'http://localhost:8767/{page}?karma=1&glb=/'+os.environ['KARMA_GLB_REL']+'&three=http://localhost:8767/node_modules/three'})
    for _ in range(60):
        time.sleep(1)
        if ev("!!window.__karmaStage") : break
    assert ev("!!window.__karmaStage"), 'stage did not start: ' + str(errors) + ' ' + str(ev("location.href+' | loader:'+!!document.querySelector('script[src*=karma-stage-loader]')+' | cards:'+document.querySelectorAll('.story-index-card').length"))
    ev("scrollTo({top:0,behavior:'instant'})")
    SEL = ".story-index-card"
    PROBE = """(()=>{const s=__karmaStage,c=s.controller;const k=document.querySelector('%s');const r=k&&k.getBoundingClientRect();const b={l:c.pos.x-c.halfW,r:c.pos.x+c.halfW,t:c.pos.y-c.charH,b:c.pos.y};
      const cards=[...document.querySelectorAll('%s')].map(e=>e.getBoundingClientRect());const ov=cards.filter(q=>q.width>0&&b.l<q.right-1&&b.r>q.left+1&&b.t<q.bottom-1&&b.b>q.top+1).length;
      return {action:c.actionName,visible:c.object3D.visible,x:Math.round(c.pos.x),y:Math.round(c.pos.y),inView:b.l>=-1&&b.r<=innerWidth+1&&b.b<=innerHeight&&b.t>=-1,onScreen:c.pos.x<innerWidth&&c.pos.y<=innerHeight,gutter:k&&k.parentElement.dataset.karmaGutter,cardW:r&&Math.round(r.width),overlapCards:ov,visits:s.state.visits,vw:innerWidth,sy:Math.round(scrollY)}})()""" % (SEL, SEL)
    def settle_run(label, secs=12):
        secs = min(secs, int(os.environ.get('KARMA_SECS', 99)))
        rows = []
        for k in range(secs):
            (time.sleep(1) if os.environ.get("KARMA_LIVE") else ev("window.__karmaStage.fastForward(1)")); rows.append(ev(PROBE)); rows[-1]['dbg'] = ev('window.__karmaStage.debug()') if os.environ.get('KARMA_TRACE') else None
        vis = sum(1 for r in rows if r['visible'] and r['onScreen']); hid = sum(1 for r in rows if not r['visible'])
        res[label] = {'seconds': secs, 'visible_and_on_screen': vis, 'hidden': hid, 'offscreen': sum(1 for r in rows if not r['onScreen']), 'max_overlap_when_visible': max([r['overlapCards'] for r in rows if r['visible']] or [0]), 'final': rows[-1], 'trace': [r['dbg'] for r in rows] if os.environ.get('KARMA_TRACE') else None, 'timeline': ''.join('V' if (r['visible'] and r['onScreen']) else 'h' for r in rows), 'actions': sorted({r['action'] for r in rows})}
        print(label, json.dumps(res[label]), flush=True)
    def shot(name):
        d = call('Page.captureScreenshot', {'format': 'png'})['result']['data']; open(f'{out}/{name}.png', 'wb').write(base64.b64decode(d))
    time.sleep(2); settle_run('1_entry_at_top_no_scroll', 10); shot('rel_1_entry')
    ev("(document.querySelector('%s')||document.body).scrollIntoView({block:'start',behavior:'instant'});scrollBy({top:-90,behavior:'instant'})" % SEL); time.sleep(2.5); settle_run('2_scrolled_to_cards', 12); shot('rel_2_cards')
    ev("scrollTo({top:300,behavior:'instant'})"); time.sleep(2.5); settle_run('3_scrolled_to_slideshow', 10); shot('rel_3_slideshow')
    ev("scrollTo({top:document.body.scrollHeight,behavior:'instant'})"); time.sleep(2.5); settle_run('4_scrolled_to_bottom', 10); shot('rel_4_bottom')
    for (nm, w2, h2, m2) in [('5_resize_360x740', 360, 740, True), ('6_resize_768x1024', 768, 1024, True), ('7_resize_1440x900', 1440, 900, False), ('8_resize_back_390x844', 390, 844, True)]:
        call('Emulation.setDeviceMetricsOverride', {'width': w2, 'height': h2, 'deviceScaleFactor': 1, 'mobile': m2}); time.sleep(1.2)
        ev("(document.querySelector('%s')||document.body).scrollIntoView({block:'start',behavior:'instant'});scrollBy({top:-90,behavior:'instant'})" % SEL); time.sleep(2.5); settle_run(nm, 12); shot('rel_' + nm)
    res['js_errors'] = errors[:5]
    json.dump(res, open(f'{out}/collection_reliability_{vp}.json', 'w'), indent=1)
finally:
    ch.kill(); srv.kill()
