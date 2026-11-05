(function () {
  'use strict';
  var story = window.__KH_STORY_PACKAGE;
  if (!story || story.section !== 'science' || story.slug !== 'magdi-yacoub') return;

  var copy = {
    ar: { title: 'استمع للحكاية', play: 'تشغيل', pause: 'إيقاف مؤقت', resume: 'استكمال', stop: 'إيقاف', loading: 'جارٍ تجهيز الصوت…', noVoice: 'التسجيلات الصوتية المختارة غير متاحة حاليًا.', done: 'انتهت الحكاية الصوتية.', karma: 'كارما', narrator: 'الراوي', progress: 'المقطع', open: 'فتح أدوات الصوت', close: 'إغلاق أدوات الصوت', volume: 'مستوى الصوت' },
    en: { title: 'Listen to the story', play: 'Play', pause: 'Pause', resume: 'Resume', stop: 'Stop', loading: 'Preparing audio…', noVoice: 'The selected audio recordings are currently unavailable.', done: 'The story has finished.', karma: 'Karma', narrator: 'Narrator', progress: 'Segment', open: 'Open audio controls', close: 'Close audio controls', volume: 'Volume' },
    fr: { title: 'Écouter le récit', play: 'Lecture', pause: 'Pause', resume: 'Reprendre', stop: 'Arrêter', loading: 'Préparation audio…', noVoice: 'Les enregistrements audio sélectionnés sont actuellement indisponibles.', done: 'Le récit est terminé.', karma: 'Karma', narrator: 'Narrateur', progress: 'Extrait', open: 'Ouvrir les commandes audio', close: 'Fermer les commandes audio', volume: 'Volume' },
    it: { title: 'Ascolta il racconto', play: 'Riproduci', pause: 'Pausa', resume: 'Riprendi', stop: 'Ferma', loading: 'Preparazione audio…', noVoice: 'Le registrazioni audio selezionate non sono attualmente disponibili.', done: 'Il racconto è terminato.', karma: 'Karma', narrator: 'Narratore', progress: 'Segmento', open: 'Apri i controlli audio', close: 'Chiudi i controlli audio', volume: 'Volume' },
    de: { title: 'Geschichte anhören', play: 'Abspielen', pause: 'Pause', resume: 'Fortsetzen', stop: 'Stopp', loading: 'Audio wird vorbereitet…', noVoice: 'Die ausgewählten Audioaufnahmen sind derzeit nicht verfügbar.', done: 'Die Geschichte ist zu Ende.', karma: 'Karma', narrator: 'Erzähler', progress: 'Abschnitt', open: 'Audiosteuerung öffnen', close: 'Audiosteuerung schließen', volume: 'Lautstärke' }
  };

  /* ---------- Styles ---------- */
  // النص الحالي (المقطع الذي يُقرأ الآن): غيّر اللون أو سمك الـ stroke من هنا فقط.
  var INK = '#blocks>.block.kh-audio-current :is(p,.block-heading,.block-timeline span,.block-timeline b)';
  var style = document.createElement('style');
  style.textContent = [
    /* الدائرة المطوية */
    '.kh-audio-player{position:fixed;right:max(12px,env(safe-area-inset-right));bottom:max(12px,env(safe-area-inset-bottom));z-index:9999;width:48px;height:48px;box-sizing:border-box;margin:0;padding:0;border:0;background:transparent;color:var(--text);isolation:isolate}',
    '.kh-audio-toggle{display:flex;width:48px;height:48px;align-items:center;justify-content:center;border:1.5px solid color-mix(in srgb,var(--accent) 70%,transparent);border-radius:50%;background:var(--panel);color:var(--accent);box-shadow:0 8px 24px rgba(0,0,0,.28),0 0 16px color-mix(in srgb,var(--accent) 30%,transparent);cursor:pointer;-webkit-tap-highlight-color:transparent}',
    '.kh-audio-toggle svg{width:22px;height:22px;display:block}',
    /* المستطيل: عريض وقصير، بإطار وتوهّج بلون القسم ليبان عن الصفحة */
    '.kh-audio-panel{display:none;width:100%;box-sizing:border-box;padding:8px 10px 9px;border:1.5px solid color-mix(in srgb,var(--accent) 75%,transparent);border-radius:14px;background:color-mix(in srgb,var(--accent) 9%,var(--panel));color:var(--text);box-shadow:0 0 0 3px color-mix(in srgb,var(--accent) 16%,transparent),0 14px 36px rgba(0,0,0,.4),0 0 22px color-mix(in srgb,var(--accent) 30%,transparent);-webkit-backdrop-filter:blur(12px);backdrop-filter:blur(12px)}',
    '.kh-audio-player.is-expanded{width:min(560px,calc(100vw - 24px));height:auto}',
    '.kh-audio-player.is-expanded .kh-audio-toggle{display:none}',
    '.kh-audio-player.is-expanded .kh-audio-panel{display:block;animation:khAudioIn .3s ease-out}',
    '@keyframes khAudioIn{from{opacity:0;transform:translateY(18px) scale(.97)}to{opacity:1;transform:none}}',
    /* حلقة نابضة حول المستطيل (أو الدائرة) أثناء التشغيل */
    '.kh-audio-player.is-playing::before{content:"";position:absolute;inset:-3px;z-index:-1;border-radius:17px;pointer-events:none;box-shadow:0 0 0 2px color-mix(in srgb,var(--accent) 65%,transparent),0 0 28px color-mix(in srgb,var(--accent) 65%,transparent);animation:khAudioPulse 1.8s ease-in-out infinite}',
    '.kh-audio-player.is-playing:not(.is-expanded)::before{border-radius:50%}',
    '@keyframes khAudioPulse{0%,100%{opacity:.3;transform:scale(1)}50%{opacity:1;transform:scale(1.025)}}',
    '@media(max-width:640px){.kh-audio-player.is-expanded{left:max(10px,env(safe-area-inset-left));right:max(10px,env(safe-area-inset-right));bottom:max(10px,env(safe-area-inset-bottom));width:auto}.kh-audio-toggle{width:46px;height:46px}}',
    '.kh-audio-row{display:flex;align-items:center;gap:10px}',
    '.kh-audio-controls{display:flex;flex:0 0 auto;gap:6px}',
    '.kh-audio-controls button{display:inline-flex;align-items:center;justify-content:center;gap:6px;min-width:40px;height:38px;padding:0 11px;border:1px solid var(--line);border-radius:999px;background:var(--panel);color:var(--text);font:700 .78rem Cairo,Arial,sans-serif;cursor:pointer;-webkit-tap-highlight-color:transparent}',
    '.kh-audio-controls button svg{width:16px;height:16px;flex:0 0 16px;display:block}',
    '.kh-audio-label{display:none;white-space:nowrap}',
    '@media(min-width:641px){.kh-audio-label{display:inline}}',
    '.kh-audio-controls #kh-audio-play{background:var(--accent);border-color:var(--accent);color:#171717}',
    '.kh-audio-controls button:disabled{opacity:.4;cursor:not-allowed}',
    '.kh-audio-volume{display:flex;flex:1 1 auto;min-width:0;align-items:center;gap:7px;margin:0;color:var(--muted)}',
    '.kh-audio-volume svg{width:18px;height:18px;flex:0 0 18px;display:block}',
    '.kh-audio-volume input{flex:1 1 auto;width:100%;min-width:0;height:28px;margin:0;accent-color:var(--accent);cursor:pointer}',
    '.kh-audio-close{display:flex;width:34px;height:34px;flex:0 0 34px;align-items:center;justify-content:center;padding:0;border:1px solid var(--line);border-radius:50%;background:transparent;color:var(--text);font-size:19px;line-height:1;cursor:pointer;-webkit-tap-highlight-color:transparent}',
    '.kh-audio-status{margin:4px 0 0;overflow:hidden;color:var(--muted);font:600 .72rem/1.4 Cairo,Arial,sans-serif;text-overflow:ellipsis;white-space:nowrap}',
    '.kh-audio-status:empty{display:none}',
    '.kh-audio-progress{display:block;width:100%;height:4px;margin:6px 0 0;accent-color:var(--accent)}',
    'body.kh-audio-open{padding-bottom:calc(104px + env(safe-area-inset-bottom))}',
    /* المقطع الجاري قراءته: إطار + لون + stroke على شكل الكتابة */
    '#blocks>.block.kh-audio-current{outline:1px solid color-mix(in srgb,var(--accent) 70%,transparent);outline-offset:3px;background:color-mix(in srgb,var(--accent) 12%,var(--panel));box-shadow:0 8px 24px color-mix(in srgb,var(--accent) 12%,transparent);transition:background .35s ease,box-shadow .35s ease,outline-color .35s ease}',
    INK + '{--kh-audio-ink:var(--accent);color:var(--kh-audio-ink);-webkit-text-stroke:.4px var(--kh-audio-ink);paint-order:stroke fill;text-shadow:0 0 12px color-mix(in srgb,var(--kh-audio-ink) 40%,transparent)}',
    ':root[data-theme="light"] ' + INK + '{--kh-audio-ink:color-mix(in srgb,var(--accent) 40%,#000)}',
    '@media(prefers-reduced-motion:reduce){#blocks>.block.kh-audio-current{transition:none!important}.kh-audio-player.is-playing::before,.kh-audio-player.is-expanded .kh-audio-panel{animation:none!important}}'
  ].join('');
  document.head.appendChild(style);

  /* ---------- State ---------- */
  var lang = document.documentElement.lang || 'ar';
  var ui = copy[lang] || copy.ar;
  var approvedVoices = { karma: '592625f68416462f8b6161ddf5fdbffb', narrator: 'a02a8220d6014812aa5ff73434c54cc0' };
  var queue = [];
  var index = 0;
  var audio = null;          // عنصر صوت واحد يُعاد استخدامه (أضمن على الموبايل)
  var mode = 'idle';         // idle | playing | paused
  var manifestUrl = null;
  var manifestState = 'loading'; // loading | ready | failed
  var manifestRun = 0;
  var currentBlock = null;
  var expanded = false;
  var runId = 0;             // يتغير عند الإيقاف لإبطال أي مؤقتات/أحداث قديمة
  var gapTimer = null;       // الفاصل القصير بين المقاطع
  var pendingNext = false;   // الإيقاف المؤقت وقع داخل الفاصل بين مقطعين

  var ICON_VOLUME = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4V5Z"></path><path d="M15.5 8.5a5 5 0 0 1 0 7"></path><path d="M18.5 5.5a9 9 0 0 1 0 13"></path></svg>';
  var ICON_PLAY = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 4.5v15a1 1 0 0 0 1.5.86l12-7.5a1 1 0 0 0 0-1.72l-12-7.5A1 1 0 0 0 7 4.5Z"></path></svg>';
  var ICON_PAUSE = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="4.5" width="4.2" height="15" rx="1.2"></rect><rect x="13.8" y="4.5" width="4.2" height="15" rx="1.2"></rect></svg>';
  var ICON_STOP = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="5.5" y="5.5" width="13" height="13" rx="2"></rect></svg>';

  var host = document.createElement('section');
  host.className = 'kh-audio-player';
  host.id = 'kh-audio-player';
  host.innerHTML =
    '<button type="button" class="kh-audio-toggle" id="kh-audio-toggle" aria-expanded="false">' + ICON_VOLUME + '</button>' +
    '<div class="kh-audio-panel">' +
      '<div class="kh-audio-row">' +
        '<div class="kh-audio-controls">' +
          '<button type="button" id="kh-audio-play">' + ICON_PLAY + '<span class="kh-audio-label"></span></button>' +
          '<button type="button" id="kh-audio-pause" disabled>' + ICON_PAUSE + '<span class="kh-audio-label"></span></button>' +
          '<button type="button" id="kh-audio-stop" disabled>' + ICON_STOP + '<span class="kh-audio-label"></span></button>' +
        '</div>' +
        '<label class="kh-audio-volume">' + ICON_VOLUME + '<input id="kh-audio-volume-input" type="range" min="0" max="1" step="0.05" value="1"></label>' +
        '<button type="button" class="kh-audio-close" id="kh-audio-close">×</button>' +
      '</div>' +
      '<p class="kh-audio-status" id="kh-audio-status" role="status" aria-live="polite"></p>' +
      '<progress class="kh-audio-progress" id="kh-audio-progress" max="1" value="0"></progress>' +
    '</div>';
  var blocksHost = document.getElementById('blocks');
  if (blocksHost && blocksHost.parentNode) blocksHost.parentNode.insertBefore(host, blocksHost);

  var playButton = document.getElementById('kh-audio-play');
  var pauseButton = document.getElementById('kh-audio-pause');
  var stopButton = document.getElementById('kh-audio-stop');
  var status = document.getElementById('kh-audio-status');
  var progress = document.getElementById('kh-audio-progress');
  var volumeControl = document.getElementById('kh-audio-volume-input');
  var toggleButton = document.getElementById('kh-audio-toggle');
  var closeButton = document.getElementById('kh-audio-close');

  function setButton(button, label, disabled) {
    button.disabled = !!disabled;
    button.setAttribute('aria-label', label);
    button.title = label;
    button.querySelector('.kh-audio-label').textContent = label;
  }

  // حالة الأزرار حسب الوضع: idle / playing / paused
  function syncButtons() {
    setButton(playButton, mode === 'paused' ? ui.resume : ui.play, mode === 'playing');
    setButton(pauseButton, ui.pause, mode !== 'playing');
    setButton(stopButton, ui.stop, mode === 'idle');
    host.classList.toggle('is-playing', mode === 'playing');
  }

  function setExpanded(value) {
    expanded = !!value;
    host.classList.toggle('is-expanded', expanded);
    document.body.classList.toggle('kh-audio-open', expanded);
    toggleButton.setAttribute('aria-expanded', expanded ? 'true' : 'false');
    toggleButton.setAttribute('aria-label', expanded ? ui.close : ui.open);
    toggleButton.title = expanded ? ui.close : ui.open;
    closeButton.setAttribute('aria-label', ui.close);
    closeButton.title = ui.close;
  }

  function setLanguage() {
    lang = document.documentElement.lang || 'ar';
    ui = copy[lang] || copy.ar;
    host.dir = lang === 'ar' ? 'rtl' : 'ltr';
    host.setAttribute('aria-label', ui.title);
    volumeControl.setAttribute('aria-label', ui.volume);
    status.textContent = '';
    progress.value = 0;
    syncButtons();
    setExpanded(expanded);
  }

  function clearHighlight() {
    if (currentBlock) currentBlock.classList.remove('kh-audio-current');
    currentBlock = null;
  }

  function reducedMotion() {
    return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }

  // يرفع الفقرة لأعلى الشاشة (تحت الهيدر) حتى لا تختفي تحت مستطيل الصوت
  function scrollToBlock(el) {
    if (!el) return;
    var header = document.querySelector('header');
    var headerBottom = header ? Math.max(0, header.getBoundingClientRect().bottom) : 0;
    var top = window.pageYOffset + el.getBoundingClientRect().top - headerBottom - 14;
    window.scrollTo({ top: Math.max(0, top), behavior: reducedMotion() ? 'auto' : 'smooth' });
  }

  function highlight(blockIndex) {
    clearHighlight();
    var cards = document.querySelectorAll('#blocks > .block');
    if (cards[blockIndex]) {
      currentBlock = cards[blockIndex];
      currentBlock.classList.add('kh-audio-current');
      scrollToBlock(currentBlock);
    }
  }

  function resetAudio() {
    if (!audio) return;
    audio.onended = null;
    audio.onerror = null;
    audio.ontimeupdate = null;
    try { audio.pause(); audio.removeAttribute('src'); audio.load(); } catch (e) {}
  }

  function stop() {
    runId += 1;
    if (gapTimer) { window.clearTimeout(gapTimer); gapTimer = null; }
    pendingNext = false;
    resetAudio();
    mode = 'idle';
    index = 0;
    clearHighlight();
    progress.value = 0;
    status.textContent = '';
    syncButtons();
    setExpanded(false);
  }

  function fail() {
    runId += 1;
    if (gapTimer) { window.clearTimeout(gapTimer); gapTimer = null; }
    pendingNext = false;
    resetAudio();
    mode = 'idle';
    clearHighlight();
    status.textContent = ui.noVoice;
    syncButtons();
  }

  function finish() {
    runId += 1;
    if (gapTimer) { window.clearTimeout(gapTimer); gapTimer = null; }
    pendingNext = false;
    resetAudio();
    mode = 'idle';
    index = 0;
    clearHighlight();
    status.textContent = ui.done;
    progress.max = queue.length || 1;
    progress.value = queue.length;
    syncButtons();
  }

  function playSegment() {
    if (index >= queue.length) { finish(); return; }
    var myRun = runId;
    var segment = queue[index];
    var total = queue.length;
    progress.max = total;
    progress.value = index;
    status.textContent = ui.progress + ' ' + (index + 1) + ' / ' + total + ' · ' + (segment.speaker === 'karma' ? ui.karma : ui.narrator);
    highlight(segment.block_index);
    mode = 'playing';
    syncButtons();

    if (!segment.url) { fail(); return; }

    if (!audio) audio = new Audio();
    var a = audio;
    a.onended = null;
    a.onerror = null;
    a.ontimeupdate = null;
    a.preload = 'auto';
    a.src = segment.url;
    a.volume = Number(volumeControl.value);
    a.onended = function () {
      if (myRun !== runId || mode !== 'playing') return;
      index += 1;
      if (index >= queue.length) { finish(); return; }
      gapTimer = window.setTimeout(function () {
        gapTimer = null;
        if (myRun !== runId) return;
        if (mode === 'playing') playSegment();
        else pendingNext = true;
      }, 350);
    };
    a.onerror = function () { if (myRun === runId) fail(); };
    a.ontimeupdate = function () {
      if (myRun === runId && a.duration && isFinite(a.duration)) progress.value = index + a.currentTime / a.duration;
    };
    var pending = a.play();
    if (pending && typeof pending.catch === 'function') {
      pending.catch(function (error) {
        if (myRun !== runId || mode !== 'playing') return;
        if (error && error.name === 'AbortError') return;
        fail();
      });
    }
  }

  function startPlayback() {
    if (manifestState === 'loading') { status.textContent = ui.loading; return; }
    if (manifestState === 'failed' || !queue.length) { status.textContent = ui.noVoice; return; }
    index = 0;
    playSegment();
  }

  function pausePlayback() {
    if (mode !== 'playing') return;
    if (gapTimer) {
      window.clearTimeout(gapTimer);
      gapTimer = null;
      pendingNext = true;
    } else if (audio) {
      audio.pause();
    }
    mode = 'paused';
    syncButtons();
  }

  function resumePlayback() {
    if (mode !== 'paused') return;
    mode = 'playing';
    syncButtons();
    scrollToBlock(currentBlock);
    if (pendingNext || !audio || !audio.getAttribute('src')) {
      pendingNext = false;
      playSegment();
      return;
    }
    var myRun = runId;
    var pending = audio.play();
    if (pending && typeof pending.catch === 'function') {
      pending.catch(function (error) {
        if (myRun !== runId || mode !== 'playing') return;
        if (error && error.name === 'AbortError') return;
        fail();
      });
    }
  }

  function loadManifest() {
    stop();
    setLanguage();
    var thisLoad = ++manifestRun;
    if (lang !== 'ar') { host.hidden = true; queue = []; manifestState = 'failed'; return; }
    host.hidden = false;
    manifestState = 'loading';
    manifestUrl = new URL('../../../assets/audio/' + encodeURIComponent(story.section) + '/' + encodeURIComponent(story.slug) + '/' + encodeURIComponent(lang) + '/manifest.json', location.href);
    status.textContent = ui.loading;
    fetch(manifestUrl.href, { cache: 'no-cache' }).then(function (response) {
      if (!response.ok) throw new Error('Audio manifest unavailable');
      return response.json();
    }).then(function (manifest) {
      if (!manifest || manifest.version !== 1 || !Array.isArray(manifest.segments)) throw new Error('Invalid audio manifest');
      if (manifest.segments.some(function (segment) { return !approvedVoices[segment.speaker] || segment.voice !== approvedVoices[segment.speaker]; })) throw new Error('Audio manifest does not match the approved pilot voices');
      var nextQueue = manifest.segments.map(function (segment) {
        return {
          block_index: segment.block_index,
          speaker: segment.speaker,
          text: segment.text || '',
          url: new URL(segment.src + '?v=' + encodeURIComponent(String(segment.audio_revision || segment.audio_sha256 || segment.hash || manifest.generated_at || manifest.version)), manifestUrl).href
        };
      });
      if (!nextQueue.length) throw new Error('Empty audio manifest');
      if (thisLoad !== manifestRun) return;
      queue = nextQueue;
      manifestState = 'ready';
      if (mode === 'idle') status.textContent = '';
    }).catch(function () {
      if (thisLoad !== manifestRun) return;
      queue = [];
      manifestState = 'failed';
      status.textContent = ui.noVoice;
    });
  }

  /* ---------- Events ---------- */
  toggleButton.addEventListener('click', function () { setExpanded(!expanded); });
  closeButton.addEventListener('click', function () { setExpanded(false); });
  document.addEventListener('click', function (event) {
    // أثناء التشغيل أو الإيقاف المؤقت يبقى المستطيل ظاهرًا؛ الإغلاق يتم بزر ×
    if (expanded && mode === 'idle' && !host.contains(event.target)) setExpanded(false);
  });
  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape' && expanded) setExpanded(false);
  });
  playButton.addEventListener('click', function () {
    setExpanded(true);
    if (mode === 'paused') resumePlayback();
    else if (mode === 'idle') startPlayback();
  });
  pauseButton.addEventListener('click', pausePlayback);
  stopButton.addEventListener('click', stop);
  volumeControl.addEventListener('input', function () {
    if (audio) audio.volume = Number(volumeControl.value);
  });
  document.addEventListener('site-language-change', loadManifest);
  setLanguage();
  loadManifest();
})();
