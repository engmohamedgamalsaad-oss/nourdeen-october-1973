/* خالدون عبر التاريخ — المصدر الموحد للغة.

   اللغة تُختار من الصفحة الرئيسية فقط، وباقي الصفحات (الأقسام والحكايات والصفحات
   الداخلية) تلتزم بها. هذا الملف هو المكان الوحيد الذي تُعرَّف فيه اللغات المدعومة
   ومفتاح التخزين، ويجب أن يُحمَّل أول سكربت في <head> قبل أي سكربت ترجمة.

   وضعان للتشغيل:
   - الصفحة الرئيسية:  <script src="assets/shared/home-language-only.js" data-role="home">
     يطبّق اللغة المحفوظة (lang/dir) ويرحّل المفتاح القديم فقط، ولا يخفي مبدّل اللغة.
   - أي صفحة أخرى (الافتراضي): يطبّق اللغة المحفوظة، ويخفي مبدّلات اللغة الداخلية،
     وينظّف ?lang= من الرابط، ويقفل تغيير اللغة (KH_LANG.locked) حتى لا يتجاوزها
     أي سكربت ترجمة قديم.

   لإضافة لغة جديدة لاحقًا: أضفها إلى SUPPORTED هنا (وإلى rtl إن كانت RTL)، ثم أضف
   ترجمتها واستكمل تغطيتها. لا تُضَف إلى القائمة قبل اكتمال الترجمة (الألمانية: معطّلة). */
(function () {
  'use strict';
  if (window.KH_LANG) return;   /* لو حُمّل الملف مرتين، يعمل مرة واحدة فقط */

  var SUPPORTED = ['ar', 'en', 'fr', 'it'];   /* الألمانية (de) غير مفعّلة عمدًا */
  var RTL = ['ar'];
  var FALLBACK = 'ar';
  var KEY = 'kh-lang';                        /* المفتاح الموحد */
  var LEGACY_KEYS = ['lang'];                 /* مفاتيح قديمة: تُقرأ وتُرحَّل ولا تُحذف */

  var script = document.currentScript;
  var isHome = !!(script && script.getAttribute('data-role') === 'home');

  function isSupported(value) { return SUPPORTED.indexOf(value) >= 0; }
  function normalize(value) { return String(value == null ? '' : value).toLowerCase(); }
  function read(key) { try { return normalize(localStorage.getItem(key)); } catch (e) { return ''; } }

  /* أول قيمة صالحة: المفتاح الموحد ثم القديمة. القيمة غير المدعومة تُتجاهل دون مسحها. */
  var lang = FALLBACK;
  var source = '';
  var keys = [KEY].concat(LEGACY_KEYS);
  for (var i = 0; i < keys.length; i++) {
    var candidate = read(keys[i]);
    if (isSupported(candidate)) { lang = candidate; source = keys[i]; break; }
  }

  /* ترحيل: إذا جاء الاختيار من مفتاح قديم فقط، انسخه إلى المفتاح الموحد
     حتى يراه كل من يقرأ kh-lang وحده (ومنهم الصفحة الرئيسية). */
  if (source && source !== KEY) {
    try { localStorage.setItem(KEY, lang); } catch (e) {}
  }

  var root = document.documentElement;
  root.lang = lang;
  root.dir = RTL.indexOf(lang) >= 0 ? 'rtl' : 'ltr';

  var api = {
    supported: Object.freeze(SUPPORTED.slice()),
    rtl: Object.freeze(RTL.slice()),
    fallback: FALLBACK,
    key: KEY,
    legacyKeys: Object.freeze(LEGACY_KEYS.slice()),
    current: lang,
    locked: !isHome,
    isSupported: isSupported,
    dir: function (value) { return RTL.indexOf(value) >= 0 ? 'rtl' : 'ltr'; }
  };
  try {
    Object.defineProperty(window, 'KH_LANG', { value: Object.freeze(api), writable: false, configurable: false });
  } catch (e) { window.KH_LANG = api; }

  if (isHome) return;   /* الرئيسية: تبقى قائمة اللغات ظاهرة، ولا يُنظَّف الرابط */

  /* الصفحات الداخلية: إخفاء مبدّلات اللغة (محددات خاصة بمبدّلات اللغة فقط) */
  var style = document.createElement('style');
  style.setAttribute('data-home-language-only', 'true');
  style.textContent =
    'html body .lang-switch,html body .topbar .lang-switch,html body .language-switch,' +
    'html body .langs,html body [data-lang-switch],html body .language-selector,' +
    'html body .lang-selector{display:none!important;visibility:hidden!important;pointer-events:none!important}';
  (document.head || root).appendChild(style);

  /* إزالة ?lang= فقط من الرابط، مع بقاء باقي المعاملات والـ hash كما هي */
  try {
    var url = new URL(location.href);
    if (url.searchParams.has('lang')) {
      url.searchParams.delete('lang');
      history.replaceState(history.state, '', url.pathname + url.search + url.hash);
    }
  } catch (e) {}
})();
