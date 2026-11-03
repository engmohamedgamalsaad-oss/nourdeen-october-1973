(function () {
  'use strict';
  var story = window.__KH_STORY_PACKAGE;
  if (!story || story.section !== 'science' || story.slug !== 'magdi-yacoub') return;

  var copy = {
    ar: { title: 'استمع للحكاية', play: '▶ استمع للحكاية', pause: 'إيقاف مؤقت', resume: 'استكمال', stop: 'إيقاف', loading: 'جارٍ تجهيز الصوت…', noVoice: 'التسجيلات الصوتية المختارة غير متاحة حاليًا.', done: 'انتهت الحكاية الصوتية.', karma: 'كارما', narrator: 'الراوي', progress: 'المقطع', open: 'فتح أدوات الصوت', close: 'إغلاق أدوات الصوت' },
    en: { title: 'Listen to the story', play: '▶ Listen to the story', pause: 'Pause', resume: 'Resume', stop: 'Stop', loading: 'Preparing audio…', noVoice: 'The selected audio recordings are currently unavailable.', done: 'The story has finished.', karma: 'Karma', narrator: 'Narrator', progress: 'Segment', open: 'Open audio controls', close: 'Close audio controls' },
    fr: { title: 'Écouter le récit', play: '▶ Écouter le récit', pause: 'Pause', resume: 'Reprendre', stop: 'Arrêter', loading: 'Préparation audio…', noVoice: 'Les enregistrements audio sélectionnés sont actuellement indisponibles.', done: 'Le récit est terminé.', karma: 'Karma', narrator: 'Narrateur', progress: 'Extrait', open: 'Ouvrir les commandes audio', close: 'Fermer les commandes audio' },
    it: { title: 'Ascolta il racconto', play: '▶ Ascolta il racconto', pause: 'Pausa', resume: 'Riprendi', stop: 'Ferma', loading: 'Preparazione audio…', noVoice: 'Le registrazioni audio selezionate non sono attualmente disponibili.', done: 'Il racconto è terminato.', karma: 'Karma', narrator: 'Narratore', progress: 'Segmento', open: 'Apri i controlli audio', close: 'Chiudi i controlli audio' },
    de: { title: 'Geschichte anhören', play: '▶ Geschichte anhören', pause: 'Pause', resume: 'Fortsetzen', stop: 'Stopp', loading: 'Audio wird vorbereitet…', noVoice: 'Die ausgewählten Audioaufnahmen sind derzeit nicht verfügbar.', done: 'Die Geschichte ist zu Ende.', karma: 'Karma', narrator: 'Erzähler', progress: 'Abschnitt', open: 'Audiosteuerung öffnen', close: 'Audiosteuerung schließen' }
  };
  var style = document.createElement('style');
  style.textContent = [
    '.kh-audio-player{position:fixed;right:max(12px,env(safe-area-inset-right));bottom:max(12px,env(safe-area-inset-bottom));z-index:9999;width:48px;height:48px;box-sizing:border-box;margin:0;padding:0;border:0;background:transparent;color:var(--text);isolation:isolate}',
    '.kh-audio-toggle{display:flex;width:48px;height:48px;align-items:center;justify-content:center;border:1px solid var(--line);border-radius:50%;background:var(--panel);color:var(--accent);box-shadow:0 8px 24px rgba(0,0,0,.24);cursor:pointer}',
    '.kh-audio-toggle svg{width:22px;height:22px;display:block}',
    '.kh-audio-panel{display:none;width:min(238px,calc(100vw - 24px));box-sizing:border-box;padding:11px 12px;border:1px solid var(--line);border-radius:16px;background:var(--panel);color:var(--text);box-shadow:0 12px 34px rgba(0,0,0,.25)}',
    '.kh-audio-player.is-expanded{width:min(238px,calc(100vw - 24px));height:auto}',
    '.kh-audio-player.is-expanded .kh-audio-toggle{display:none}',
    '.kh-audio-player.is-expanded .kh-audio-panel{display:block}',
    '.kh-audio-panel-head{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px}',
    '.kh-audio-player h3{margin:0;color:var(--accent);font:800 .9rem Cairo,Arial,sans-serif}',
    '.kh-audio-close{width:28px;height:28px;flex:0 0 28px;border:1px solid var(--line);border-radius:50%;background:transparent;color:var(--text);font-size:17px;line-height:1;cursor:pointer}',
    '.kh-audio-controls{display:flex;flex-wrap:wrap;gap:6px}',
    '.kh-audio-controls button{min-height:32px;padding:4px 8px;border:1px solid var(--line);border-radius:999px;background:var(--panel);color:var(--text);font:700 .78rem Cairo,Arial,sans-serif;cursor:pointer}',
    '.kh-audio-controls #kh-audio-play{background:var(--accent);border-color:var(--accent);color:#171717}',
    '.kh-audio-controls button:disabled{opacity:.45;cursor:not-allowed}',
    '.kh-audio-status{margin:6px 0 0;color:var(--muted);font-size:.72rem;line-height:1.45;max-height:2.5em;overflow:hidden}',
    '.kh-audio-volume{display:flex;align-items:center;gap:7px;margin-top:6px;color:var(--muted);font:600 .72rem Cairo,Arial,sans-serif}',
    '.kh-audio-volume input{flex:1;min-width:65px;accent-color:var(--accent);cursor:pointer}',
    '.kh-audio-progress{display:block;width:100%;height:4px;margin-top:8px;accent-color:var(--accent)}',
    '@media(max-width:480px){.kh-audio-player{right:10px;bottom:max(10px,env(safe-area-inset-bottom))}.kh-audio-toggle{width:46px;height:46px}.kh-audio-player.is-expanded{width:min(232px,calc(100vw - 20px))}.kh-audio-panel{width:100%;padding:9px}.kh-audio-controls button{min-height:31px;padding:4px 7px;font-size:.74rem}}',
    '#blocks>.block.kh-audio-current{outline:1px solid color-mix(in srgb,var(--accent) 70%,transparent);outline-offset:3px;background:color-mix(in srgb,var(--accent) 12%,var(--panel));box-shadow:0 8px 24px color-mix(in srgb,var(--accent) 12%,transparent);transition:background .35s ease,box-shadow .35s ease,outline-color .35s ease;scroll-margin-block:18vh}',
    '@media(prefers-reduced-motion:reduce){#blocks>.block.kh-audio-current{transition:none!important}}'
  ].join('');
  document.head.appendChild(style);

  var lang = document.documentElement.lang || 'ar';
  var ui = copy[lang] || copy.ar;
  var blocks = story.i18n && story.i18n[lang] && story.i18n[lang].blocks || [];
  var approvedVoices = { karma: '592625f68416462f8b6161ddf5fdbffb', narrator: 'a02a8220d6014812aa5ff73434c54cc0' };
  var queue = [];
  var index = 0;
  var activeAudio = null;
  var mode = 'idle';
  var manifestUrl = null;
  var currentBlock = null;
  var expanded = false;

  var host = document.createElement('section');
  host.className = 'kh-audio-player';
  host.id = 'kh-audio-player';
  host.innerHTML = '<button type="button" class="kh-audio-toggle" id="kh-audio-toggle" aria-label="Open audio controls" aria-expanded="false"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4V5Z"></path><path d="M15.5 8.5a5 5 0 0 1 0 7"></path><path d="M18.5 5.5a9 9 0 0 1 0 13"></path></svg></button><div class="kh-audio-panel"><div class="kh-audio-panel-head"><h3 id="kh-audio-title"></h3><button type="button" class="kh-audio-close" id="kh-audio-close" aria-label="Close audio controls">×</button></div><div class="kh-audio-controls"><button type="button" id="kh-audio-play"></button><button type="button" id="kh-audio-pause" disabled></button><button type="button" id="kh-audio-stop" disabled></button></div><label class="kh-audio-volume"><span id="kh-audio-volume-label">' + (lang === 'ar' ? 'مستوى الصوت' : 'Volume') + '</span><input id="kh-audio-volume-input" type="range" min="0" max="1" step="0.05" value="1" aria-label="Volume"></label><progress class="kh-audio-progress" id="kh-audio-progress" max="1" value="0"></progress><p class="kh-audio-status" id="kh-audio-status" role="status" aria-live="polite"></p></div>';
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

  function setExpanded(value) {
    expanded = !!value;
    host.classList.toggle('is-expanded', expanded);
    toggleButton.setAttribute('aria-expanded', expanded ? 'true' : 'false');
    toggleButton.setAttribute('aria-label', expanded ? ui.close : ui.open);
    closeButton.setAttribute('aria-label', ui.close);
  }

  function setLanguage() {
    lang = document.documentElement.lang || 'ar';
    ui = copy[lang] || copy.ar;
    host.dir = lang === 'ar' ? 'rtl' : 'ltr';
    document.getElementById('kh-audio-volume-label').textContent = lang === 'ar' ? 'مستوى الصوت' : 'Volume';
    blocks = story.i18n && story.i18n[lang] && story.i18n[lang].blocks || [];
    document.getElementById('kh-audio-title').textContent = ui.title;
    playButton.textContent = ui.play;
    pauseButton.textContent = ui.pause;
    stopButton.textContent = ui.stop;
    status.textContent = '';
    progress.value = 0;
  }

  function clearHighlight() {
    if (currentBlock) currentBlock.classList.remove('kh-audio-current');
    currentBlock = null;
  }

  function stop() {
    if (activeAudio) {
      activeAudio.pause();
      activeAudio.removeAttribute('src');
      activeAudio.load();
      activeAudio = null;
    }
    mode = 'idle';
    index = 0;
    clearHighlight();
    pauseButton.disabled = true;
    stopButton.disabled = true;
    pauseButton.textContent = ui.pause;
    progress.value = 0;
    setExpanded(false);
  }

  function highlight(blockIndex) {
    clearHighlight();
    var cards = document.querySelectorAll('#blocks > .block');
    if (cards[blockIndex]) {
      currentBlock = cards[blockIndex];
      currentBlock.classList.add('kh-audio-current');
      var reducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      currentBlock.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'center' });
    }
  }

  function playNext() {
    if (index >= queue.length) {
      mode = 'idle';
      clearHighlight();
      status.textContent = ui.done;
      pauseButton.disabled = true;
      stopButton.disabled = true;
      progress.value = queue.length ? queue.length : 0;
      setExpanded(false);
      return;
    }
    var segment = queue[index];
    var total = queue.length;
    progress.max = total;
    progress.value = index;
    status.textContent = ui.progress + ' ' + (index + 1) + ' / ' + total + ' — ' + (segment.speaker === 'karma' ? ui.karma : ui.narrator);
    highlight(segment.block_index);
    mode = 'playing';
    pauseButton.disabled = false;
    stopButton.disabled = false;

    function advance() {
      index += 1;
      if (mode === 'playing') window.setTimeout(playNext, 350);
    }

    if (!segment.url) {
      mode = 'idle';
      status.textContent = ui.noVoice;
      pauseButton.disabled = true;
      stopButton.disabled = false;
      return;
    }
    activeAudio = new Audio(segment.url);
    activeAudio.volume = Number(volumeControl.value);
    activeAudio.preload = 'auto';
    activeAudio.onended = advance;
    activeAudio.onerror = function () {
      activeAudio = null;
      mode = 'idle';
      status.textContent = ui.noVoice;
      pauseButton.disabled = true;
      stopButton.disabled = false;
    };
    var pending = activeAudio.play();
    if (pending && typeof pending.catch === 'function') {
      pending.catch(function () {
        activeAudio = null;
        mode = 'idle';
        status.textContent = ui.noVoice;
        pauseButton.disabled = true;
        stopButton.disabled = false;
      });
    }
  }

  function loadManifest() {
    stop();
    setLanguage();
    if (lang !== 'ar') { host.hidden = true; queue = []; return; }
    host.hidden = false;
    manifestUrl = new URL('../../../assets/audio/' + encodeURIComponent(story.section) + '/' + encodeURIComponent(story.slug) + '/' + encodeURIComponent(lang) + '/manifest.json', location.href);
    status.textContent = ui.loading;
    fetch(manifestUrl.href, { cache: 'no-cache' }).then(function (response) {
      if (!response.ok) throw new Error('Audio manifest unavailable');
      return response.json();
    }).then(function (manifest) {
      if (!manifest || manifest.version !== 1 || !Array.isArray(manifest.segments)) throw new Error('Invalid audio manifest');
      if (manifest.segments.some(function (segment) { return !approvedVoices[segment.speaker] || segment.voice !== approvedVoices[segment.speaker]; })) throw new Error('Audio manifest does not match the approved pilot voices');
      queue = manifest.segments.map(function (segment) {
        return {
          block_index: segment.block_index,
          speaker: segment.speaker,
          text: segment.text || '',
          url: new URL(segment.src + '?v=' + encodeURIComponent(String(segment.hash || manifest.generated_at || manifest.version)), manifestUrl).href
        };
      });
      if (!queue.length) throw new Error('Empty audio manifest');
      status.textContent = '';
    }).catch(function () {
      queue = [];
      status.textContent = ui.noVoice;
    });
  }

  toggleButton.addEventListener('click', function () { setExpanded(!expanded); });
  closeButton.addEventListener('click', function () { setExpanded(false); });
  document.addEventListener('click', function (event) {
    if (expanded && !host.contains(event.target)) setExpanded(false);
  });
  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape' && expanded) setExpanded(false);
  });
  playButton.addEventListener('click', function () {
    setExpanded(true);
    if (mode === 'paused') {
      if (activeAudio) activeAudio.play();
      mode = 'playing';
      pauseButton.textContent = ui.pause;
      return;
    }
    if (mode === 'idle') {
      index = 0;
      if (queue.length) playNext();
      else status.textContent = ui.noVoice;
    }
  });
  pauseButton.addEventListener('click', function () {
    if (mode !== 'playing') return;
    if (activeAudio) activeAudio.pause();
    mode = 'paused';
    pauseButton.textContent = ui.resume;
    setExpanded(false);
  });
  stopButton.addEventListener('click', stop);
  volumeControl.addEventListener('input', function () {
    var value = Number(volumeControl.value);
    if (activeAudio) activeAudio.volume = value;
  });
  document.addEventListener('site-language-change', loadManifest);
  setLanguage();
  loadManifest();
})();