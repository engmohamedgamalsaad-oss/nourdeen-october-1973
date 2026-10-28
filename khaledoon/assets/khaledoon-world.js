/* Khaledoon cinematic world explorer — original implementation, inspired by the visual direction of the reference site, not copied from its bundled code. */
(function(){
  'use strict';
  if(window.__khWorldExplorer) return;
  window.__khWorldExplorer=true;
  var langs=['ar','en','fr','it','de'];
  var copy={
    ar:{kicker:'حكايات تتجاوز الحدود',title:'اكتشف العالم من خلال حكاياته',lead:'كرة تفاعلية تربط الأماكن التاريخية بالحكايات المنشورة. هذا تمثيل فني مبسط وليس خريطة جغرافية دقيقة؛ ولا تظهر النقاط إلا عند توفر مصدر موثق للمكان.',hint:'اسحب الكرة لتدويرها',map:'افتح خريطة الشخصيات',loading:'نجهّز الكرة الأرضية…',empty:'لا توجد أماكن بمصادر موثقة مكتملة لعرضها الآن.',stories:'حكايات مرتبطة بالمواقع',placesCount:'مكان له مصدر',source:'المصدر',approximate:'الموقع تقريبي وفق المصدر',reduced:'الحركة التلقائية متوقفة حسب إعدادات جهازك.'},
    en:{kicker:'Stories beyond borders',title:'Explore the world through its stories',lead:'An artistic, simplified globe connecting historical places to published stories, not a geographically precise map. Markers appear only when a documented source is available.',hint:'Drag to rotate the globe',map:'Open the story map',loading:'Preparing the globe…',empty:'No places with complete documented sources are available yet.',stories:'Stories linked to places',placesCount:'sourced places',source:'Source',approximate:'Approximate location according to the source',reduced:'Automatic motion is paused by your device settings.'},
    fr:{kicker:'Des récits sans frontières',title:'Explorez le monde à travers ses récits',lead:'Un globe artistique simplifié relie les lieux historiques aux récits publiés ; ce n’est pas une carte géographique précise. Les repères exigent une source documentée.',hint:'Faites glisser pour tourner le globe',map:'Ouvrir la carte des récits',loading:'Préparation du globe…',empty:'Aucun lieu avec une source documentée complète n’est disponible.',stories:'Récits liés aux lieux',placesCount:'lieux sourcés',source:'Source',approximate:'Emplacement approximatif selon la source',reduced:'Le mouvement automatique est désactivé par les réglages de votre appareil.'},
    it:{kicker:'Storie senza confini',title:'Esplora il mondo attraverso le sue storie',lead:'Un globo artistico semplificato collega i luoghi storici alle storie pubblicate; non è una mappa geograficamente precisa. I punti richiedono una fonte documentata.',hint:'Trascina per ruotare il globo',map:'Apri la mappa delle storie',loading:'Preparazione del globo…',empty:'Non sono disponibili luoghi con fonti documentate complete.',stories:'Storie collegate ai luoghi',placesCount:'luoghi con fonte',source:'Fonte',approximate:'Posizione approssimativa secondo la fonte',reduced:'Il movimento automatico è disattivato dalle impostazioni del dispositivo.'},
    de:{kicker:'Geschichten ohne Grenzen',title:'Entdecke die Welt durch ihre Geschichten',lead:'Ein künstlerisch vereinfachter Globus verbindet historische Orte mit veröffentlichten Geschichten; er ist keine geografisch genaue Karte. Markierungen erfordern eine dokumentierte Quelle.',hint:'Zum Drehen den Globus ziehen',map:'Geschichtenkarte öffnen',loading:'Globus wird vorbereitet…',empty:'Es sind keine Orte mit vollständigen dokumentierten Quellen verfügbar.',stories:'Mit Orten verbundene Geschichten',placesCount:'Orte mit Quelle',source:'Quelle',approximate:'Ungefährer Standort laut Quelle',reduced:'Die automatische Bewegung ist durch deine Geräteeinstellungen deaktiviert.'}
  };
  var points=[],rot=0,tilt=-.16,drag=false,lastX=0,lastY=0,startX=0,startY=0,raf=0,hitTargets=[],selectedPoint=null,inView=true,pageVisible=!document.hidden;
  function lang(){var l=(document.documentElement.lang||'ar').slice(0,2).toLowerCase();return langs.indexOf(l)>=0?l:'ar'}
  function t(k){return (copy[lang()]||copy.ar)[k]}
  function el(tag,cls,txt){var n=document.createElement(tag);if(cls)n.className=cls;if(txt!=null)n.textContent=txt;return n}
  var hero=document.querySelector('main .hero');
  if(!hero)return;
  var section=el('section','kh-world section');
  section.id='khWorld';
  var wrap=el('div','wrap');
  var head=el('div','kh-world-head');
  var heading=el('div');
  var kicker=el('div','kicker'); kicker.dataset.worldText='kicker';
  var title=el('h2'); title.dataset.worldText='title';
  heading.append(kicker,title);
  var lead=el('p');lead.dataset.worldText='lead';
  head.append(heading,lead);
  var stage=el('div','kh-world-stage');
  var canvas=el('canvas','kh-world-canvas');
  canvas.setAttribute('role','img');
  canvas.setAttribute('aria-label','Interactive globe of verified story locations');
  canvas.tabIndex=0;
  var side=el('div','kh-world-side');
  var hint=el('p','kh-world-hint');hint.dataset.worldText='hint';
  var status=el('p','kh-world-status');status.dataset.worldText='loading';
  var listTitle=el('h3');listTitle.dataset.worldText='stories';
  var list=el('div','kh-world-list');
  var selectedInfo=el('p','kh-world-status');selectedInfo.hidden=true;
  var selectedLink=el('a','kh-world-chip');selectedLink.hidden=true;
  var sourceLink=el('a','kh-world-chip');sourceLink.hidden=true;sourceLink.target='_blank';sourceLink.rel='noopener noreferrer';
  var link=el('a','btn ghost');link.href='index.html#khMap';link.dataset.worldText='map';
  side.append(hint,status,listTitle,list,selectedInfo,selectedLink,sourceLink,link);
  stage.append(canvas,side);
  wrap.append(head,stage);
  section.append(wrap);
  hero.insertAdjacentElement('afterend',section);
  function labels(){
    section.querySelectorAll('[data-world-text]').forEach(function(n){n.textContent=t(n.dataset.worldText)});
    canvas.setAttribute('aria-label',t('title')+'. '+t('hint'));
    section.dir=document.documentElement.dir||'rtl';
    if(points.length){status.textContent=points.length+' '+t('placesCount');renderStoryList()}
  }
  labels();
  var observer=new MutationObserver(labels);
  observer.observe(document.documentElement,{attributes:true,attributeFilter:['lang','dir']});
  var ctx=canvas.getContext('2d');
  if(!ctx){status.textContent=t('empty');return}
  var motionQuery=window.matchMedia?window.matchMedia('(prefers-reduced-motion: reduce)'):null;
  var reduced=!!(motionQuery&&motionQuery.matches);
  function canAnimate(){return !reduced&&inView&&pageVisible}
  function syncAnimation(){if(!canAnimate()&&!drag&&raf){cancelAnimationFrame(raf);raf=0}else if(canAnimate())requestDraw()}
  if('IntersectionObserver' in window){var worldVisibility=new IntersectionObserver(function(entries){inView=!!(entries[0]&&entries[0].isIntersecting);syncAnimation()},{threshold:0.01});worldVisibility.observe(section)}
  document.addEventListener('visibilitychange',function(){pageVisible=!document.hidden;syncAnimation()});
  if(motionQuery){var onMotionChange=function(e){reduced=e.matches;if(reduced)hint.textContent=t('reduced');else hint.textContent=t('hint');syncAnimation()};if(motionQuery.addEventListener)motionQuery.addEventListener('change',onMotionChange);else if(motionQuery.addListener)motionQuery.addListener(onMotionChange)}
  function safeStoryPath(s){
    var p=String(s&&s.path||'');
    if(/^stories\/[a-z0-9-]+\/[0-9]{3}\/$/.test(p))return p;
    var sec=String(s&&s.section||''),id=String(s&&s.id||'').padStart(3,'0');
    return /^[a-z0-9-]+$/.test(sec)&&/^\d{3}$/.test(id)?'stories/'+sec+'/'+id+'/':'stories/';
  }
  function localized(s,key){var l=lang();return (s.i18n&&s.i18n[l]&&s.i18n[l][key])||s[l]||s[key]||''}
  function localizedPlace(p){var l=lang(),v=p&&p.place;return typeof v==='string'?v:(v&&v[l])||(v&&v.ar)||''}
  function selectPoint(q){
    if(!q||!q.p||!q.p.story)return;
    selectedPoint=q.p;var story=q.p.story;
    var placeText=localizedPlace(q.p);
    if(q.p.approximate)placeText += (placeText?' — ':'')+t('approximate');
    selectedInfo.textContent=[placeText,localized(story,'person')||localized(story,'title')||story.id].filter(Boolean).join(' — ');
    selectedInfo.hidden=false;selectedLink.textContent=localized(story,'title')||localized(story,'person')||story.id;
    selectedLink.href=safeStoryPath(story);selectedLink.hidden=false;
    sourceLink.textContent=t('source')+': '+localized(q.p.source_name,'label');
    sourceLink.href=q.p.source_url;sourceLink.hidden=false;
    renderStoryList();
  }
  function draw(){
    raf=0;
    var rect=canvas.getBoundingClientRect(),dpr=Math.min(window.devicePixelRatio||1,2);
    var w=Math.max(260,rect.width),h=Math.max(250,Math.min(480,rect.height||360));
    if(canvas.width!==Math.round(w*dpr)||canvas.height!==Math.round(h*dpr)){canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr)}
    ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);
    var r=Math.min(w*.38,h*.43),cx=w*.48,cy=h*.5;
    var glow=ctx.createRadialGradient(cx-r*.22,cy-r*.25,r*.05,cx,cy,r*1.25);
    glow.addColorStop(0,'rgba(42,139,155,.25)');glow.addColorStop(.7,'rgba(7,36,52,.12)');glow.addColorStop(1,'rgba(5,15,29,0)');
    ctx.fillStyle=glow;ctx.fillRect(0,0,w,h);
    var sphere=ctx.createRadialGradient(cx-r*.36,cy-r*.38,r*.05,cx+r*.2,cy+r*.12,r*1.3);
    sphere.addColorStop(0,'#2b7380');sphere.addColorStop(.48,'#123d52');sphere.addColorStop(.82,'#09243a');sphere.addColorStop(1,'#050e20');
    ctx.beginPath();ctx.arc(cx,cy,r,0,Math.PI*2);ctx.fillStyle=sphere;ctx.fill();
    ctx.save();ctx.beginPath();ctx.arc(cx,cy,r-.5,0,Math.PI*2);ctx.clip();
    ctx.strokeStyle='rgba(177,222,220,.22)';ctx.lineWidth=.8;
    for(var lat=-60;lat<=60;lat+=30){
      ctx.beginPath();var yy=cy-Math.sin(lat*Math.PI/180)*r;
      var ww=Math.cos(lat*Math.PI/180)*r;
      ctx.ellipse(cx,yy,ww,Math.max(2,r*.025),0,0,Math.PI*2);ctx.stroke();
    }
    for(var lon=-60;lon<=60;lon+=30){ctx.beginPath();ctx.ellipse(cx,cy,Math.max(2,r*Math.cos(lon*Math.PI/180)),r,0,0,Math.PI*2);ctx.stroke()}
    var projected=[];
    points.forEach(function(p,i){
      var la=p.lat*Math.PI/180,lo=p.lng*Math.PI/180+rot;
      var x=Math.cos(la)*Math.sin(lo),y=Math.sin(la)*Math.cos(tilt)-Math.cos(la)*Math.cos(lo)*Math.sin(tilt),z=Math.sin(la)*Math.sin(tilt)+Math.cos(la)*Math.cos(lo)*Math.cos(tilt);
      if(z>-.05)projected.push({x:cx+x*r,y:cy-y*r,z:z,p:p,i:i});
    });
    hitTargets=projected.map(function(q){return {x:q.x,y:q.y,r:Math.max(10,2.8+Math.max(0,q.z)*2.3),p:q.p,z:q.z}});
    projected.forEach(function(q){
      var rr=2.8+Math.max(0,q.z)*2.3;
      ctx.beginPath();ctx.arc(q.x,q.y,rr*2.8,0,Math.PI*2);ctx.fillStyle='rgba(240,200,120,.10)';ctx.fill();
      ctx.beginPath();ctx.arc(q.x,q.y,rr,0,Math.PI*2);ctx.fillStyle=(selectedPoint&&selectedPoint.story===q.p.story)?'#fff4c6':'#f3cf85';ctx.fill();
      ctx.strokeStyle='rgba(255,245,220,.9)';ctx.lineWidth=1;ctx.stroke();
    });
    ctx.restore();
    ctx.beginPath();ctx.arc(cx,cy,r+1,0,Math.PI*2);ctx.strokeStyle='rgba(240,200,120,.55)';ctx.lineWidth=1;ctx.stroke();
    ctx.beginPath();ctx.ellipse(cx,cy,r*1.18,r*.2,-.35,0,Math.PI*2);ctx.strokeStyle='rgba(240,200,120,.28)';ctx.stroke();
    ctx.beginPath();ctx.ellipse(cx,cy,r*1.11,r*.16,-.35,0,Math.PI*2);ctx.strokeStyle='rgba(240,200,120,.14)';ctx.stroke();
    if(!drag&&!reduced)rot+=.0017;
    if(canAnimate()||drag)raf=requestAnimationFrame(draw);
  }
  function requestDraw(){if(!raf)raf=requestAnimationFrame(draw)}
  requestDraw();
  function renderStoryList(){
    list.replaceChildren();
    points.slice(0,8).forEach(function(p){
      var a=el('a','kh-world-chip',localized(p.story,'person')||localized(p.story,'title')||p.story.id);
      if(selectedPoint&&selectedPoint.story===p.story)a.setAttribute('aria-current','true');
      a.href=safeStoryPath(p.story);list.appendChild(a);
    });
  }
  function normalizePoint(p,s){
    var lat=Number(p&&p.lat),lng=Number(p&&p.lng);
    var sourceUrl=String(p&&p.source_url||'');
    var sourceNames=p&&p.source_name;
    if(!Number.isFinite(lat)||!Number.isFinite(lng)||Math.abs(lat)>90||Math.abs(lng)>180)return null;
    if(!/^https:\/\//i.test(sourceUrl)||!sourceNames||!langs.every(function(l){return typeof sourceNames[l]==='string'&&sourceNames[l].trim()}))return null;
    return {lat:lat,lng:lng,story:s,place:p.place||null,place_label:p.place_label||'',approximate:p.approximate===true,source_url:sourceUrl,source_name:sourceNames};
  }
  Promise.all([
    fetch('stories/index.json',{cache:'no-cache'}).then(function(r){if(!r.ok)throw 0;return r.json()}),
    fetch('stories/places.json',{cache:'no-cache'}).then(function(r){if(!r.ok)throw 0;return r.json()})
  ]).then(function(data){
    var stories=Array.isArray(data[0])?data[0]:[],places=data[1]||{};
    stories.forEach(function(s){
      if(!s||s.published===false)return;
      var p=normalizePoint(places[String(s.id)],s);
      if(p)points.push(p)
    });
    if(!points.length){status.textContent=t('empty');return}
    status.textContent=points.length+' '+t('placesCount');
    renderStoryList();requestDraw();
  }).catch(function(){status.textContent=t('empty')});
  function pos(e){return e.clientX}
  canvas.addEventListener('pointerdown',function(e){drag=true;lastX=startX=pos(e);lastY=startY=e.clientY;canvas.setPointerCapture&&canvas.setPointerCapture(e.pointerId);canvas.classList.add('is-dragging')});
  canvas.addEventListener('pointermove',function(e){if(!drag)return;rot+=(pos(e)-lastX)*.006;tilt=Math.max(-.9,Math.min(.9,tilt+(e.clientY-lastY)*.004));lastX=pos(e);lastY=e.clientY;requestDraw()});
  function endDrag(e){var moved=Math.hypot(pos(e)-startX,e.clientY-startY);drag=false;canvas.classList.remove('is-dragging');if(e.type==='pointerup'&&moved<7){var rect=canvas.getBoundingClientRect(),x=e.clientX-rect.left,y=e.clientY-rect.top,best=null,bestD=Infinity;hitTargets.forEach(function(q){var d=Math.hypot(q.x-x,q.y-y);if(d<=q.r&&d<bestD){best=q;bestD=d}});if(best)selectPoint(best)}requestDraw()}
  canvas.addEventListener('pointerup',endDrag);canvas.addEventListener('pointercancel',endDrag);
  canvas.addEventListener('keydown',function(e){if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].indexOf(e.key)<0)return;e.preventDefault();if(e.key==='ArrowLeft')rot-=.12;if(e.key==='ArrowRight')rot+=.12;if(e.key==='ArrowUp')tilt=Math.max(-.9,tilt-.08);if(e.key==='ArrowDown')tilt=Math.min(.9,tilt+.08);requestDraw()});
  window.addEventListener('resize',requestDraw,{passive:true});
  if(reduced){hint.textContent=t('reduced');}
})();
