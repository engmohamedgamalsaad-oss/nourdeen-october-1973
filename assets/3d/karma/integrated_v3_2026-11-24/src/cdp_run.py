# usage: cdp_run.py "page.html?query" out.png [log.txt]  (serves cwd on :8765, drives headless Chrome via CDP, waits for title 'done')
import subprocess,sys,time,json,base64,urllib.request,websocket,os,signal
url,out=sys.argv[1],sys.argv[2];log=sys.argv[3] if len(sys.argv)>3 else None
srv=subprocess.Popen(['python3','-m','http.server','8765'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
ch=subprocess.Popen(['google-chrome','--headless=new','--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--remote-debugging-port=9333','--window-size=1600,900','--user-data-dir=/tmp/cdpprof','about:blank'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
try:
    time.sleep(3)
    tabs=json.load(urllib.request.urlopen('http://127.0.0.1:9333/json'))
    ws=websocket.create_connection([t for t in tabs if t['type']=='page'][0]['webSocketDebuggerUrl'],timeout=120,suppress_origin=True)
    i=[0]
    def call(m,p=None):
        i[0]+=1;ws.send(json.dumps({'id':i[0],'method':m,'params':p or {}}))
        while True:
            r=json.loads(ws.recv())
            if r.get('id')==i[0]:return r
    call('Page.navigate',{'url':'http://localhost:8765/'+url})
    for _ in range(240):
        v=call('Runtime.evaluate',{'expression':"document.title"})['result']['result'].get('value')
        if v=='done':break
        time.sleep(0.5)
    else: raise SystemExit('timeout')
    d=call('Runtime.evaluate',{'expression':"document.getElementById('png')?document.getElementById('png').value:''"})['result']['result']['value']
    print('len',len(d),d[:60])
    open(out,'wb').write(base64.b64decode(d.split(',',1)[1]))
    if log:
        l=call('Runtime.evaluate',{'expression':"(document.getElementById('log')||{}).textContent||''"})['result']['result']['value'];open(log,'w').write(l)
finally:
    ch.kill();srv.kill()
