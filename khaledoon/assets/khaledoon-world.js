/* Khaledoon cinematic world explorer — original implementation, inspired by the visual direction of the reference site, not copied from its bundled code. */
(function(){
  'use strict';
  if(window.__khWorldExplorer) return;
  window.__khWorldExplorer=true;
  var langs=['ar','en','fr','it','de'];
  var copy={
    ar:{kicker:'حكايات تتجاوز الحدود',title:'اكتشف العالم من خلال حكاياته',lead:'كرة ثلاثية الأبعاد بطابع سينمائي، تعتمد على قارات وحدود ومدن حقيقية من Natural Earth، وترتبط بالحكايات المنشورة ذات المواقع الموثقة.',hint:'اسحب الكرة لتدويرها',map:'افتح خريطة الشخصيات',loading:'نجهّز الكرة الأرضية…',empty:'لا توجد أماكن بمصادر موثقة مكتملة لعرضها الآن.',stories:'حكايات مرتبطة بالمواقع',placesCount:'مكان له مصدر',source:'المصدر',approximate:'الموقع تقريبي ويحتاج إلى مراجعة',reduced:'الحركة التلقائية متوقفة حسب إعدادات جهازك.',attribution:'بيانات الخريطة: Natural Earth'},
    en:{kicker:'Stories beyond borders',title:'Explore the world through its stories',lead:'A cinematic 3D globe using real Natural Earth land, borders and major-city coordinates, connected to published stories with documented locations.',hint:'Drag to rotate the globe',map:'Open the story map',loading:'Preparing the globe…',empty:'No places with complete documented sources are available yet.',stories:'Stories linked to places',placesCount:'sourced places',source:'Source',approximate:'Approximate location; verification needed',reduced:'Automatic motion is paused by your device settings.',attribution:'Map data: Natural Earth'},
    fr:{kicker:'Des récits sans frontières',title:'Explorez le monde à travers ses récits',lead:'Un globe 3D cinématographique fondé sur les terres, frontières et grandes villes de Natural Earth, relié aux récits publiés et à leurs lieux documentés.',hint:'Faites glisser pour tourner le globe',map:'Ouvrir la carte des récits',loading:'Préparation du globe…',empty:'Aucun lieu avec une source documentée complète n’est disponible.',stories:'Récits liés aux lieux',placesCount:'lieux sourcés',source:'Source',approximate:'Emplacement approximatif à vérifier',reduced:'Le mouvement automatique est désactivé par les réglages de votre appareil.',attribution:'Données cartographiques : Natural Earth'},
    it:{kicker:'Storie senza confini',title:'Esplora il mondo attraverso le sue storie',lead:'Un globo 3D cinematografico basato su terre, confini e grandi città di Natural Earth, collegato ai racconti pubblicati e ai luoghi documentati.',hint:'Trascina per ruotare il globo',map:'Apri la mappa delle storie',loading:'Preparazione del globo…',empty:'Non sono disponibili luoghi con fonti documentate complete.',stories:'Storie collegate ai luoghi',placesCount:'luoghi con fonte',source:'Fonte',approximate:'Posizione approssimativa da verificare',reduced:'Il movimento automatico è disattivato dalle impostazioni del dispositivo.',attribution:'Dati cartografici: Natural Earth'},
    de:{kicker:'Geschichten ohne Grenzen',title:'Entdecke die Welt durch ihre Geschichten',lead:'Ein filmisch gestalteter 3D-Globus mit echten Landflächen, Grenzen und Großstädten aus Natural Earth, verknüpft mit veröffentlichten Geschichten und belegten Orten.',hint:'Zum Drehen den Globus ziehen',map:'Geschichtenkarte öffnen',loading:'Globus wird vorbereitet…',empty:'Es sind keine Orte mit vollständigen dokumentierten Quellen verfügbar.',stories:'Mit Orten verbundene Geschichten',placesCount:'Orte mit Quelle',source:'Quelle',approximate:'Ungefähre Lage; noch zu überprüfen',reduced:'Die automatische Bewegung ist durch deine Geräteeinstellungen deaktiviert.',attribution:'Kartendaten: Natural Earth'}
  };
  var points=[],rot=0,tilt=-.16,drag=false,lastX=0,lastY=0,startX=0,startY=0,raf=0,hitTargets=[],selectedPoint=null,inView=true,pageVisible=!document.hidden;
  /* Geographic shapes are loaded from the bundled, public-domain Natural Earth dataset. */
  var geography=null;
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
  var selectedCard=el('div','kh-world-story-card');selectedCard.hidden=true;selectedCard.setAttribute('aria-live','polite');
  var link=el('a','btn ghost');link.href='index.html#khMap';link.dataset.worldText='map';
  var attribution=el('a','kh-world-attribution');attribution.href='https://www.naturalearthdata.com/';attribution.target='_blank';attribution.rel='noopener noreferrer';attribution.dataset.worldText='attribution';
  side.append(hint,status,listTitle,list,selectedCard,selectedInfo,selectedLink,sourceLink,link,attribution);
  stage.append(canvas,side);
  wrap.append(head,stage);
  section.append(wrap);
  hero.insertAdjacentElement('afterend',section);
  function labels(){
    section.querySelectorAll('[data-world-text]').forEach(function(n){n.textContent=t(n.dataset.worldText)});
    canvas.setAttribute('aria-label',t('title')+'. '+t('hint'));
    section.dir=document.documentElement.dir||'rtl';
    if(points.length){status.textContent=points.length+' '+t('placesCount');renderStoryList()}if(selectedPoint&&!selectedCard.hidden)selectedCard.replaceChildren(buildStoryCard(selectedPoint))
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
  /* Defaults mirror khaledoon-map.js; the admin-configured section colors override them when available. */
  var sectionPalette={october:'#f0c878',history:'#d4b7ff',science:'#8ad9e8',women:'#d78bb2',people:'#e2b36d',curriculum:'#f5b37e',islamic:'#78c59a',readers:'#b8874b'};
  var sectionAliases={knowledge:'women',learning:'women',fame:'people'};
  function canonicalSection(sectionId){return sectionAliases[sectionId]||sectionId}
  function sectionColor(sectionId){return sectionPalette[canonicalSection(sectionId)]||'#b8874b'}
  function loadSectionPalette(){
    var api='https://ypwprddkscnfblhftkeb.supabase.co',anon='sb_publishable_JJnVwx8HQAJNxSok32L-qg_83fXk5Qn';
    return fetch(api+'/rest/v1/khaledoon_admin_config?config_key=eq.sections&select=config_value&limit=1',{headers:{apikey:anon,Authorization:'Bearer '+anon},cache:'no-store'})
      .then(function(r){return r.ok?r.json():[]})
      .then(function(rows){
        var value=rows&&rows[0]&&rows[0].config_value,colors=value&&value.colors||{};
        Object.keys(colors).forEach(function(id){var c=colors[id]&&colors[id].outer;if(/^#[0-9a-f]{6}$/i.test(c||''))sectionPalette[canonicalSection(id)]=c});
        requestDraw();
        if(selectedPoint&&!selectedCard.hidden)selectedCard.replaceChildren(buildStoryCard(selectedPoint));
      }).catch(function(){});
  }
  function localizedValue(value){return typeof value==='string'?value:(value&&value[lang()])||(value&&value.ar)||''}
  var cityNames={
    'Cairo':{ar:'القاهرة',en:'Cairo',fr:'Le Caire',it:'Il Cairo',de:'Kairo'},
    'London':{ar:'لندن',en:'London',fr:'Londres',it:'Londra',de:'London'},
    'Paris':{ar:'باريس',en:'Paris',fr:'Paris',it:'Parigi',de:'Paris'},
    'New York':{ar:'نيويورك',en:'New York',fr:'New York',it:'New York',de:'New York'},
    'Tokyo':{ar:'طوكيو',en:'Tokyo',fr:'Tokyo',it:'Tokyo',de:'Tokio'},
    'New Delhi':{ar:'نيودلهي',en:'New Delhi',fr:'New Delhi',it:'Nuova Delhi',de:'Neu-Delhi'},
    'Beijing':{ar:'بكين',en:'Beijing',fr:'Pékin',it:'Pechino',de:'Peking'},
    'Moscow':{ar:'موسكو',en:'Moscow',fr:'Moscou',it:'Mosca',de:'Moskau'},
    'Istanbul':{ar:'إسطنبول',en:'Istanbul',fr:'Istanbul',it:'Istanbul',de:'Istanbul'},
    'Rome':{ar:'روما',en:'Rome',fr:'Rome',it:'Roma',de:'Rom'},
    'Sydney':{ar:'سيدني',en:'Sydney',fr:'Sydney',it:'Sydney',de:'Sydney'},
    'Mexico City':{ar:'مكسيكو سيتي',en:'Mexico City',fr:'Mexico',it:'Città del Messico',de:'Mexiko-Stadt'},
    'Rio de Janeiro':{ar:'ريو دي جانيرو',en:'Rio de Janeiro',fr:'Rio de Janeiro',it:'Rio de Janeiro',de:'Rio de Janeiro'},
    'Sao Paulo':{ar:'ساو باولو',en:'São Paulo',fr:'São Paulo',it:'San Paolo',de:'São Paulo'},
    'Seoul':{ar:'سيول',en:'Seoul',fr:'Séoul',it:'Seul',de:'Seoul'},
    'Berlin':{ar:'برلين',en:'Berlin',fr:'Berlin',it:'Berlino',de:'Berlin'},
    'Madrid':{ar:'مدريد',en:'Madrid',fr:'Madrid',it:'Madrid',de:'Madrid'},
    'Mumbai':{ar:'مومباي',en:'Mumbai',fr:'Mumbai',it:'Mumbai',de:'Mumbai'},
    'Jakarta':{ar:'جاكرتا',en:'Jakarta',fr:'Jakarta',it:'Giacarta',de:'Jakarta'},
    'Lagos':{ar:'لاغوس',en:'Lagos',fr:'Lagos',it:'Lagos',de:'Lagos'},
    'Buenos Aires':{ar:'بوينس آيرس',en:'Buenos Aires',fr:'Buenos Aires',it:'Buenos Aires',de:'Buenos Aires'},
    'Alexandria':{ar:'الإسكندرية',en:'Alexandria',fr:'Alexandrie',it:'Alessandria',de:'Alexandria'}
  };
  function cityLabel(name){var value=cityNames[name];return value&&(value[lang()]||value.en)||''}
  function loadHiddenStories(){
    if(!window.__khHiddenP){
      var api='https://ypwprddkscnfblhftkeb.supabase.co',anon='sb_publishable_JJnVwx8HQAJNxSok32L-qg_83fXk5Qn';
      var request=fetch(api+'/rest/v1/story_visibility?select=story_id',{headers:{apikey:anon,Authorization:'Bearer '+anon},cache:'no-store'})
        .then(function(r){return r.ok?r.json():[]})
        .then(function(rows){return Array.isArray(rows)?rows.map(function(x){return String(x.story_id)}):[]})
        .catch(function(){return []});
      window.__khHiddenP=Promise.race([request,new Promise(function(resolve){window.setTimeout(function(){resolve([])},1800)})]);
    }
    return window.__khHiddenP;
  }
  loadSectionPalette();
  function buildStoryCard(p){
    var story=p.story,catNames={ar:{october:'حكايات أكتوبر 1973',history:'التاريخ والحضارات',science:'العلم والعلماء',women:'نساء خالدات',people:'أعلام الأدب والفنون والرياضة',curriculum:'شخصيات المناهج المصرية',islamic:'شخصيات إسلامية',readers:'اقتراحات القراء'},en:{october:'October 1973 Stories',history:'History and Civilizations',science:'Science and Scientists',women:'Women Who Made History',people:'Figures in Literature, Arts and Sport',curriculum:'Egyptian Curriculum Figures',islamic:'Islamic Figures',readers:'Reader Suggestions'},fr:{october:'Récits d’octobre 1973',history:'Histoire et civilisations',science:'Sciences et scientifiques',women:'Femmes qui ont marqué l’histoire',people:'Figures de la littérature, des arts et du sport',curriculum:'Figures des programmes égyptiens',islamic:'Figures de l’islam',readers:'Suggestions des lecteurs'},it:{october:'Storie dell’ottobre 1973',history:'Storia e civiltà',science:'Scienza e scienziati',women:'Donne che hanno fatto la storia',people:'Protagonisti della letteratura, delle arti e dello sport',curriculum:'Personaggi dei programmi egiziani',islamic:'Figure islamiche',readers:'Suggerimenti dei lettori'},de:{october:'Geschichten zum Oktober 1973',history:'Geschichte und Zivilisationen',science:'Wissenschaft und Forschende',women:'Frauen, die Geschichte schrieben',people:'Persönlichkeiten aus Literatur, Kunst und Sport',curriculum:'Figuren der ägyptischen Lehrpläne',islamic:'Persönlichkeiten des Islam',readers:'Leservorschläge'}};
    var l=lang(),sec=canonicalSection(story.section||''),category=(catNames[l]||catNames.ar)[sec]||(catNames.ar[sec]||t('stories')),color=sectionColor(sec);
    var card=el('div','khm-card');card.dir=document.documentElement.dir||'rtl';
    var ph=el('div','khm-ph');ph.style.setProperty('--c',color);
    var photo=String(p.photo||'');
    if(photo&&!/^javascript:/i.test(photo)){
      var img=el('img');img.alt=localized(story,'person')||localized(story,'title')||'';img.loading='lazy';img.src=photo;
      img.addEventListener('error',function(){ph.replaceChildren(el('span','kh-world-avatar',Array.from(img.alt||'★')[0]||'★'))});
      ph.appendChild(img);
    }else{ph.appendChild(el('span','kh-world-avatar',Array.from(localized(story,'person')||'★')[0]||'★'))}
    card.appendChild(ph);
    card.appendChild(el('div','khm-name',localized(story,'person')||localized(story,'title')||category));
    var place=localizedPlace(p),label=localizedValue(p.place_label);
    if(place)card.appendChild(el('div','khm-place',(label||'')+place));
    var sourceUrl=String(p.source_url||'');
    if(/^https:\/\//i.test(sourceUrl)){var src=el('a','khm-source',t('source')+': '+localizedValue(p.source_name));src.href=sourceUrl;src.target='_blank';src.rel='noopener noreferrer';card.appendChild(src)}
    if(p.approximate)card.appendChild(el('div','khm-approx',t('approximate')));
    var sec=el('div','khm-story',category);sec.style.setProperty('--c',color);card.appendChild(sec);
    var go=el('a','khm-go',localized(story,'title')||t('stories'));go.href=safeStoryPath(story);card.appendChild(go);
    card.style.setProperty('--c',color);
    return card;
  }
  function selectPoint(q){
    if(!q||!q.p||!q.p.story)return;
    selectedPoint=q.p;canvas.style.transformOrigin=Math.round(q.x)+'px '+Math.round(q.y)+'px';
    selectedCard.replaceChildren(buildStoryCard(q.p));selectedCard.hidden=false;
    selectedInfo.hidden=true;selectedLink.hidden=true;sourceLink.hidden=true;
    renderStoryList();requestDraw();
    document.dispatchEvent(new CustomEvent('kh:world-select',{detail:{storyId:String(q.p.story.id),lat:q.p.lat,lng:q.p.lng}}));
  }
  function draw(){
    raf=0;
    var rect=canvas.getBoundingClientRect(),dpr=Math.min(window.devicePixelRatio||1,2);
    var w=Math.max(260,rect.width),h=Math.max(250,Math.min(480,rect.height||360));
    if(canvas.width!==Math.round(w*dpr)||canvas.height!==Math.round(h*dpr)){canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr)}
    ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);
    var r=Math.min(w*.40,h*.45),cx=w*.49,cy=h*.5;
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
    function geo3(coord){
      var gla=Number(coord[1])*Math.PI/180,glo=Number(coord[0])*Math.PI/180+rot;
      var x=Math.cos(gla)*Math.sin(glo);
      var y=Math.sin(gla)*Math.cos(tilt)-Math.cos(gla)*Math.cos(glo)*Math.sin(tilt);
      var z=Math.sin(gla)*Math.sin(tilt)+Math.cos(gla)*Math.cos(glo)*Math.cos(tilt);
      return {x:x,y:y,z:z};
    }
    function denseRing(ring){
      var out=[];
      for(var ri=0;ri<ring.length;ri++){
        var a=ring[ri],b=ring[(ri+1)%ring.length];
        if(ri===0)out.push(a);
        var dl=b[0]-a[0];if(dl>180)dl-=360;else if(dl< -180)dl+=360;
        var steps=Math.max(1,Math.ceil(Math.max(Math.abs(dl),Math.abs(b[1]-a[1]))/3));
        for(var st=1;st<steps;st++)out.push([a[0]+dl*st/steps,a[1]+(b[1]-a[1])*st/steps]);
        out.push([a[0]+dl,b[1]]);
      }
      return out;
    }
    function drawLandRing(ring){
      if(!ring||ring.length<3)return;
      var pts=denseRing(ring).map(geo3),clipped=[];
      for(var pi=0;pi<pts.length;pi++){
        var prev=pts[(pi+pts.length-1)%pts.length],cur=pts[pi],pin=prev.z>=0,cin=cur.z>=0;
        if(pin!==cin){
          var tt=prev.z/(prev.z-cur.z),ix=prev.x+(cur.x-prev.x)*tt,iy=prev.y+(cur.y-prev.y)*tt,ilen=Math.hypot(ix,iy)||1;
          clipped.push({x:ix/ilen,y:iy/ilen,z:0});
        }
        if(cin)clipped.push(cur);
      }
      if(clipped.length<3)return;
      ctx.beginPath();ctx.moveTo(cx+clipped[0].x*r,cy-clipped[0].y*r);
      for(var ci=1;ci<clipped.length;ci++)ctx.lineTo(cx+clipped[ci].x*r,cy-clipped[ci].y*r);
      ctx.closePath();ctx.fillStyle='rgba(117,205,190,.72)';ctx.fill();
      ctx.strokeStyle='rgba(176,232,219,.24)';ctx.lineWidth=.45;ctx.stroke();
    }
    function drawBorder(coords){
      if(!coords||coords.length<2)return;
      var line=[];
      for(var bi=0;bi<coords.length;bi++){
        var cur=geo3(coords[bi]),prev=bi?geo3(coords[bi-1]):null;
        if(prev&&Math.abs(coords[bi][0]-coords[bi-1][0])>180){if(line.length>1){ctx.beginPath();ctx.moveTo(line[0].x,line[0].y);for(var li=1;li<line.length;li++)ctx.lineTo(line[li].x,line[li].y);ctx.stroke()}line=[]}
        if(prev&&prev.z>=0&&cur.z<0){var tt=prev.z/(prev.z-cur.z),ix=prev.x+(cur.x-prev.x)*tt,iy=prev.y+(cur.y-prev.y)*tt,ilen=Math.hypot(ix,iy)||1;line.push({x:cx+ix/ilen*r,y:cy-iy/ilen*r})}
        if(cur.z>=0)line.push({x:cx+cur.x*r,y:cy-cur.y*r});
        else if(line.length>1){ctx.beginPath();ctx.moveTo(line[0].x,line[0].y);for(var li2=1;li2<line.length;li2++)ctx.lineTo(line[li2].x,line[li2].y);ctx.stroke();line=[]}
      }
      if(line.length>1){ctx.beginPath();ctx.moveTo(line[0].x,line[0].y);for(var lj=1;lj<line.length;lj++)ctx.lineTo(line[lj].x,line[lj].y);ctx.stroke()}
    }
    if(geography&&Array.isArray(geography.land)){
      ctx.save();ctx.fillStyle='rgba(117,205,190,.72)';
      geography.land.forEach(function(g){
        if(g.type==='Polygon')drawLandRing(g.coordinates[0]);
        else if(g.type==='MultiPolygon')g.coordinates.forEach(function(poly){if(poly[0])drawLandRing(poly[0])});
      });
      ctx.restore();
    }
    if(geography&&Array.isArray(geography.borders)){
      ctx.save();ctx.strokeStyle='rgba(214,231,220,.32)';ctx.lineWidth=.55;
      geography.borders.forEach(function(g){
        var lines=g.type==='LineString'?[g.coordinates]:g.type==='MultiLineString'?g.coordinates:[];
        lines.forEach(drawBorder);
      });
      ctx.restore();
    }
    if(geography&&Array.isArray(geography.cities)){
      geography.cities.forEach(function(city){
        var q=geo3([city.lng,city.lat]);if(q.z<=.02)return;
        var rr=city.population>=5000000?1.7:1.1;
        ctx.beginPath();ctx.arc(cx+q.x*r,cy-q.y*r,rr,0,Math.PI*2);
        ctx.fillStyle='rgba(230,241,238,.72)';ctx.fill();
        var label=city.label&&r>150&&q.z>.32?cityLabel(city.name):'';
        if(label){ctx.font='10px Cairo, sans-serif';ctx.textAlign='left';ctx.textBaseline='middle';ctx.fillStyle='rgba(238,246,243,.88)';ctx.fillText(label,cx+q.x*r+4,cy-q.y*r-4,72)}
      });
    }
    var projected=[];
    points.forEach(function(p,i){
      var la=p.lat*Math.PI/180,lo=p.lng*Math.PI/180+rot;
      var x=Math.cos(la)*Math.sin(lo),y=Math.sin(la)*Math.cos(tilt)-Math.cos(la)*Math.cos(lo)*Math.sin(tilt),z=Math.sin(la)*Math.sin(tilt)+Math.cos(la)*Math.cos(lo)*Math.cos(tilt);
      if(z>-.05)projected.push({x:cx+x*r,y:cy-y*r,z:z,p:p,i:i});
    });
    hitTargets=projected.map(function(q){return {x:q.x,y:q.y,r:Math.max(10,2.8+Math.max(0,q.z)*2.3),p:q.p,z:q.z}});
    /* Story markers remain independent: no decorative lines imply unverified historical routes. */
    projected.forEach(function(q){
      var rr=2.8+Math.max(0,q.z)*2.3;
      var chosen=!!(selectedPoint&&selectedPoint.story===q.p.story);
      var markColor=sectionColor(q.p.story.section);
      ctx.beginPath();ctx.arc(q.x,q.y,rr*(chosen?4.1:2.8),0,Math.PI*2);ctx.fillStyle=chosen?'rgba(255,244,198,.22)':markColor+'2e';ctx.fill();
      ctx.beginPath();ctx.arc(q.x,q.y,rr,0,Math.PI*2);ctx.fillStyle=chosen?'#fff4c6':markColor;ctx.fill();
      ctx.strokeStyle='rgba(255,245,220,.9)';ctx.lineWidth=1;ctx.stroke();
    });
    ctx.restore();
    ctx.beginPath();ctx.arc(cx,cy,r+1,0,Math.PI*2);ctx.strokeStyle='rgba(240,200,120,.55)';ctx.lineWidth=1;ctx.stroke();
    ctx.beginPath();ctx.ellipse(cx,cy,r*1.18,r*.2,-.35,0,Math.PI*2);ctx.strokeStyle='rgba(240,200,120,.28)';ctx.stroke();
    ctx.beginPath();ctx.ellipse(cx,cy,r*1.11,r*.16,-.35,0,Math.PI*2);ctx.strokeStyle='rgba(240,200,120,.14)';ctx.stroke();
    if(!drag&&!reduced)rot+=.00055;
    if(canAnimate()||drag)raf=requestAnimationFrame(draw);
  }
  function requestDraw(){if(!raf)raf=requestAnimationFrame(draw)}
  /* Explicit globe-to-map handoff: animate the globe out, reveal the map, and respect reduced-motion preferences. */
  link.addEventListener('click',function(e){
    var target=document.getElementById('khMap');
    if(!target)return;
    e.preventDefault();
    section.classList.add('kh-world-leaving');
    canvas.classList.add('kh-world-zooming');
    if(selectedPoint)document.dispatchEvent(new CustomEvent('kh:world-select',{detail:{storyId:String(selectedPoint.story.id),lat:selectedPoint.lat,lng:selectedPoint.lng}}));
    target.classList.remove('kh-map-arrived');
    target.classList.add('kh-map-arriving');
    target.scrollIntoView({behavior:reduced?'auto':'smooth',block:'start'});
    window.setTimeout(function(){
      target.classList.remove('kh-map-arriving');
      target.classList.add('kh-map-arrived');
      section.classList.remove('kh-world-leaving');
      canvas.classList.remove('kh-world-zooming');
    },reduced?0:680);
  });
  requestDraw();
  fetch('khaledoon/assets/geo/natural-earth-110m.json',{cache:'force-cache'}).then(function(r){if(!r.ok)throw new Error('Natural Earth data unavailable');return r.json()}).then(function(g){if(g&&Array.isArray(g.land)&&Array.isArray(g.borders)&&Array.isArray(g.cities)){geography=g;requestDraw()}}).catch(function(){if(!points.length)status.textContent=t('empty')});
  function renderStoryList(){
    list.replaceChildren();
    points.slice(0,8).forEach(function(p){
      var labels={ar:{october:'حكايات أكتوبر 1973',history:'التاريخ والحضارات',science:'العلم والعلماء',women:'نساء خالدات',people:'أعلام الأدب والفنون والرياضة',curriculum:'شخصيات المناهج المصرية',islamic:'شخصيات إسلامية',readers:'اقتراحات القراء'},en:{october:'October 1973 Stories',history:'History and Civilizations',science:'Science and Scientists',women:'Women Who Made History',people:'Figures in Literature, Arts and Sport',curriculum:'Egyptian Curriculum Figures',islamic:'Islamic Figures',readers:'Reader Suggestions'},fr:{october:'Récits d’octobre 1973',history:'Histoire et civilisations',science:'Sciences et scientifiques',women:'Femmes qui ont marqué l’histoire',people:'Figures de la littérature, des arts et du sport',curriculum:'Figures des programmes égyptiens',islamic:'Figures de l’islam',readers:'Suggestions des lecteurs'},it:{october:'Storie dell’ottobre 1973',history:'Storia e civiltà',science:'Scienza e scienziati',women:'Donne che hanno fatto la storia',people:'Protagonisti della letteratura, delle arti e dello sport',curriculum:'Personaggi dei programmi egiziani',islamic:'Figure islamiche',readers:'Suggerimenti dei lettori'},de:{october:'Geschichten zum Oktober 1973',history:'Geschichte und Zivilisationen',science:'Wissenschaft und Forschende',women:'Frauen, die Geschichte schrieben',people:'Persönlichkeiten aus Literatur, Kunst und Sport',curriculum:'Figuren der ägyptischen Lehrpläne',islamic:'Persönlichkeiten des Islam',readers:'Leservorschläge'}};var section=canonicalSection(p.story.section),category=(labels[lang()]||labels.ar)[section]||(labels.ar[section]||t('stories')),storyLabel=localized(p.story,'person')||localized(p.story,'title')||category;var a=el('a','kh-world-chip',storyLabel);a.title=category;a.style.setProperty('--section-color',sectionColor(section));
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
    return {lat:lat,lng:lng,story:s,place:p.place||null,place_label:p.place_label||'',approximate:p.approximate===true,source_url:sourceUrl,source_name:sourceNames,photo:p.photo||s.photo||'',credit:p.credit||''};
  }
  Promise.all([
    fetch('stories/index.json',{cache:'no-cache'}).then(function(r){if(!r.ok)throw 0;return r.json()}),
    fetch('stories/places.json',{cache:'no-cache'}).then(function(r){if(!r.ok)throw 0;return r.json()}),
    loadHiddenStories()
  ]).then(function(data){
    var stories=Array.isArray(data[0])?data[0]:[],places=data[1]||{},hidden=data[2]||[];
    stories.forEach(function(s){
      if(!s||s.published===false||!s.title||hidden.indexOf(String(s.id))>=0)return;
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
