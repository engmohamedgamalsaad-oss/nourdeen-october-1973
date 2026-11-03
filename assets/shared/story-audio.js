(function () {
  'use strict';
  var story = window.__KH_STORY_PACKAGE;
  if (!story || !story.section || story.section === 'october') return;

  var copy = {
    ar: { title: 'استمع للحكاية', play: '▶ استمع للحكاية', pause: 'إيقاف مؤقت', resume: 'استكمال', stop: 'إيقاف', loading: 'جارٍ تجهيز الصوت…', fallback: 'الملفات الصوتية غير متاحة الآن؛ نستخدم صوت المتصفح إن كان مدعومًا.', noVoice: 'لا تتوفر ملفات صوتية أو أصوات قراءة في هذا المتصفح.', done: 'انتهت الحكاية الصوتية.', karma: 'كارما', narrator: 'الراوي', progress: 'المقطع' },
    en: { title: 'Listen to the story', play: '▶ Listen to the story', pause: 'Pause', resume: 'Resume', stop: 'Stop', loading: 'Preparing audio…', fallback: 'Audio files are unavailable; using the browser voice if supported.', noVoice: 'No audio files or speech voices are available in this browser.', done: 'The story has finished.', karma: 'Karma', narrator: 'Narrator', progress: 'Segment' },
    fr: { title: 'Écouter le récit', play: '▶ Écouter le récit', pause: 'Pause', resume: 'Reprendre', stop: 'Arrêter', loading: 'Préparation audio…', fallback: 'Fichiers audio indisponibles ; utilisation de la voix du navigateur si possible.', noVoice: 'Aucun fichier audio ni voix de lecture disponible dans ce navigateur.', done: 'Le récit est terminé.', karma: 'Karma', narrator: 'Narrateur', progress: 'Extrait' },
    it: { title: 'Ascolta il racconto', play: '▶ Ascolta il racconto', pause: 'Pausa', resume: 'Riprendi', stop: 'Ferma', loading: 'Preparazione audio…', fallback: 'File audio non disponibili; uso della voce del browser se supportata.', noVoice: 'Nessun file audio o voce disponibile in questo browser.', done: 'Il racconto è terminato.', karma: 'Karma', narrator: 'Narratore', progress: 'Segmento' },
    de: { title: 'Geschichte anhören', play: '▶ Geschichte anhören', pause: 'Pause', resume: 'Fortsetzen', stop: 'Stopp', loading: 'Audio wird vorbereitet…', fallback: 'Audiodateien sind nicht verfügbar; falls möglich wird die Browserstimme verwendet.', noVoice: 'In diesem Browser sind keine Audiodateien oder Vorlesestimmen verfügbar.', done: 'Die Geschichte ist zu Ende.', karma: 'Karma', narrator: 'Erzähler', progress: 'Abschnitt' }
  };
  var style = document.createElement('style');
  style.textContent = [
    '.kh-audio-player{margin:18px 0 24px;padding:18px;border:1px solid var(--line);border-radius:18px;background:color-mix(in srgb,var(--accent) 9%,var(--panel));color:var(--text)}',
    '.kh-audio-player h3{margin:0 0 12px;color:var(--accent);font:800 1.1rem Cairo,Arial,sans-serif}',
    '.kh-audio-controls{display:flex;flex-wrap:wrap;gap:8px}',
    '.kh-audio-controls button{min-height:42px;padding:8px 15px;border:1px solid var(--line);border-radius:999px;background:var(--panel);color:var(--text);font:700 .9rem Cairo,Arial,sans-serif;cursor:pointer}',
    '.kh-audio-controls #kh-audio-play{background:var(--accent);border-color:var(--accent);color:#171717}',
    '.kh-audio-controls button:disabled{opacity:.45;cursor:not-allowed}',
    '.kh-audio-status{margin:10px 0 0;color:var(--muted);font-size:.9rem;line-height:1.8}',
    '.kh-audio-progress{display:block;width:100%;height:5px;margin-top:12px;accent-color:var(--accent)}',
    '#blocks>.block.kh-audio-current{outline:2px solid var(--accent);outline-offset:3px}'
  ].join('');
  document.head.appendChild(style);

  var lang = document.documentElement.lang || 'ar';
  var ui = copy[lang] || copy.ar;
  var blocks = story.i18n && story.i18n[lang] && story.i18n[lang].blocks || [];
  var queue = [];
  var index = 0;
  var activeAudio = null;
  var activeUtterance = null;
  var mode = 'idle';
  var manifestUrl = null;
  var currentBlock = null;

  var host = document.createElement('section');
  host.className = 'kh-audio-player';
  host.id = 'kh-audio-player';
  host.innerHTML = '<h3 id="kh-audio-title"></h3><div class="kh-audio-controls"><button type="button" id="kh-audio-play"></button><button type="button" id="kh-audio-pause" disabled></button><button type="button" id="kh-audio-stop" disabled></button></div><progress class="kh-audio-progress" id="kh-audio-progress" max="1" value="0"></progress><p class="kh-audio-status" id="kh-audio-status" role="status" aria-live="polite"></p>';
  var blocksHost = document.getElementById('blocks');
  if (blocksHost && blocksHost.parentNode) blocksHost.parentNode.insertBefore(host, blocksHost);

  var playButton = document.getElementById('kh-audio-play');
  var pauseButton = document.getElementById('kh-audio-pause');
  var stopButton = document.getElementById('kh-audio-stop');
  var status = document.getElementById('kh-audio-status');
  var progress = document.getElementById('kh-audio-progress');

  function setLanguage() {
    lang = document.documentElement.lang || 'ar';
    ui = copy[lang] || copy.ar;
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
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    activeUtterance = null;
    mode = 'idle';
    index = 0;
    clearHighlight();
    pauseButton.disabled = true;
    stopButton.disabled = true;
    pauseButton.textContent = ui.pause;
    progress.value = 0;
  }

  function highlight(blockIndex) {
    clearHighlight();
    var cards = document.querySelectorAll('#blocks > .block');
    if (cards[blockIndex]) {
      currentBlock = cards[blockIndex];
      currentBlock.classList.add('kh-audio-current');
    }
  }

  function fallbackSpeak(segment, onEnd) {
    if (!('speechSynthesis' in window) || !('SpeechSynthesisUtterance' in window)) {
      status.textContent = ui.noVoice;
      mode = 'idle';
      pauseButton.disabled = true;
      stopButton.disabled = false;
      return;
    }
    var sourceBlock = blocks[segment.block_index] || {};
    var utterance = new SpeechSynthesisUtterance(sourceBlock.text || segment.text || '');
    var locales = { ar: 'ar-EG', en: 'en-US', fr: 'fr-FR', it: 'it-IT', de: 'de-DE' };
    utterance.lang = locales[lang] || 'ar-EG';
    utterance.rate = 0.96;
    utterance.pitch = segment.speaker === 'karma' ? 1.12 : 1;
    var voices = window.speechSynthesis.getVoices();
    var voice = voices.find(function (v) { return v.lang && v.lang.toLowerCase() === utterance.lang.toLowerCase(); }) ||
      voices.find(function (v) { return v.lang && v.lang.toLowerCase().indexOf(utterance.lang.slice(0, 2)) === 0; });
    if (voice) utterance.voice = voice;
    utterance.onend = onEnd;
    utterance.onerror = function () { status.textContent = ui.noVoice; mode = 'idle'; };
    activeUtterance = utterance;
    window.speechSynthesis.speak(utterance);
  }

  function playNext() {
    if (index >= queue.length) {
      mode = 'idle';
      clearHighlight();
      status.textContent = ui.done;
      pauseButton.disabled = true;
      stopButton.disabled = true;
      progress.value = queue.length ? queue.length : 0;
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
      if (mode === 'playing') playNext();
    }

    if (segment.url) {
      activeAudio = new Audio(segment.url);
      activeAudio.preload = 'auto';
      activeAudio.onended = advance;
      activeAudio.onerror = function () {
        var fallbackText = blocks[segment.block_index] && blocks[segment.block_index].text;
        if (fallbackText && 'speechSynthesis' in window) fallbackSpeak(segment, advance);
        else advance();
      };
      var pending = activeAudio.play();
      if (pending && typeof pending.catch === 'function') {
        pending.catch(function () {
          var fallbackText = blocks[segment.block_index] && blocks[segment.block_index].text;
          if (fallbackText && 'speechSynthesis' in window) fallbackSpeak(segment, advance);
          else { status.textContent = ui.noVoice; advance(); }
        });
      }
    } else {
      fallbackSpeak(segment, advance);
    }
  }

  function buildFallbackQueue() {
    queue = blocks.map(function (block, blockIndex) {
      return block && block.text && (block.speaker === 'karma' || block.speaker === 'narrator')
        ? { block_index: blockIndex, speaker: block.speaker, text: block.text }
        : null;
    }).filter(Boolean);
  }

  function loadManifest() {
    stop();
    setLanguage();
    if (story.section === 'october') return;
    manifestUrl = new URL('../../../assets/audio/' + encodeURIComponent(story.section) + '/' + encodeURIComponent(story.slug) + '/' + encodeURIComponent(lang) + '/manifest.json', location.href);
    status.textContent = ui.loading;
    fetch(manifestUrl.href, { cache: 'no-cache' }).then(function (response) {
      if (!response.ok) throw new Error('Audio manifest unavailable');
      return response.json();
    }).then(function (manifest) {
      if (!manifest || manifest.version !== 1 || !Array.isArray(manifest.segments)) throw new Error('Invalid audio manifest');
      queue = manifest.segments.map(function (segment) {
        return {
          block_index: segment.block_index,
          speaker: segment.speaker,
          url: new URL(segment.src, manifestUrl).href
        };
      });
      if (!queue.length) throw new Error('Empty audio manifest');
      status.textContent = '';
    }).catch(function () {
      buildFallbackQueue();
      status.textContent = queue.length ? ui.fallback : ui.noVoice;
    });
  }

  playButton.addEventListener('click', function () {
    if (mode === 'paused') {
      if (activeAudio) activeAudio.play();
      else if ('speechSynthesis' in window) window.speechSynthesis.resume();
      mode = 'playing';
      pauseButton.textContent = ui.pause;
      return;
    }
    if (mode === 'idle') {
      if (!queue.length) buildFallbackQueue();
      index = 0;
      if (queue.length) playNext();
      else status.textContent = ui.noVoice;
    }
  });
  pauseButton.addEventListener('click', function () {
    if (mode !== 'playing') return;
    if (activeAudio) activeAudio.pause();
    else if ('speechSynthesis' in window) window.speechSynthesis.pause();
    mode = 'paused';
    pauseButton.textContent = ui.resume;
  });
  stopButton.addEventListener('click', stop);
  document.addEventListener('site-language-change', loadManifest);
  setLanguage();
  loadManifest();
})();