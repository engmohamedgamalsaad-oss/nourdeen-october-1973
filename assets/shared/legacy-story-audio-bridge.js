/* Connect legacy October story pages to the shared public audio player without changing their layout or story content. */
(function () {
  'use strict';
  var slug = document.body && document.body.dataset.storySlug;
  if (!slug || !/^\d{3}$/.test(slug)) return;
  var packageUrl = new URL('../../../rebuild/october-audio-packages/' + encodeURIComponent(slug) + '/story.json', document.baseURI);
  fetch(packageUrl.href, { cache: 'no-cache' })
    .then(function (response) {
      if (!response.ok) throw new Error('HTTP ' + response.status);
      return response.json();
    })
    .then(function (story) {
      if (!story || story.format !== 'KHALEDOON_STORY' || story.section !== 'october' ||
          story.slug !== slug || !story.i18n ||
          !['ar', 'en'].every(function (lang) {
            return story.i18n[lang] && Array.isArray(story.i18n[lang].blocks);
          })) throw new Error('October audio package does not match this story.');
      window.__KH_STORY_PACKAGE = story;
      if (document.getElementById('kh-story-audio-script')) return;
      var script = document.createElement('script');
      script.id = 'kh-story-audio-script';
      script.src = new URL('../../../assets/shared/story-audio.js?v=20261121-ar-en-audio-1', document.baseURI).href;
      script.async = true;
      script.onerror = function () {
        console.error('[Khaledoon audio] Unable to load the shared public audio player.');
      };
      document.body.appendChild(script);
    })
    .catch(function (error) {
      console.error('[Khaledoon audio] October story audio package is unavailable:', error);
    });
})();
