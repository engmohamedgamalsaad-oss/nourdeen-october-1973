/* خالدون عبر التاريخ — المصدر الموحد للغة.

   اختيار اللغة موحّد بين الصفحة الرئيسية والأقسام والحكايات والصفحات الداخلية؛
   أي اختيار يُحفظ ويُطبّق على بقية الصفحات. هذا الملف يعرّف اللغات المدعومة
   ومفتاح التخزين، ويجب أن يُحمَّل أول سكربت في <head> قبل أي سكربت ترجمة.

   يطبّق اللغة المحفوظة (lang/dir) ويرحّل المفتاح القديم فقط. تبقى مبدّلات اللغة
   ظاهرة وقابلة للاستخدام في كل صفحة، ويُزال ?lang= من الرابط بعد حفظ الاختيار.

   لإضافة لغة جديدة لاحقًا: أضفها إلى SUPPORTED هنا (وإلى rtl إن كانت RTL)، ثم أضف
   ترجمتها واستكمل تغطيتها قبل تفعيلها. */
(function () {
  'use strict';
  if (window.KH_LANG) return;   /* لو حُمّل الملف مرتين، يعمل مرة واحدة فقط */

  var SUPPORTED = ['ar', 'en', 'fr', 'it', 'de'];
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
    locked: false,
    isSupported: isSupported,
    dir: function (value) { return RTL.indexOf(value) >= 0 ? 'rtl' : 'ltr'; }
  };
  try {
    Object.defineProperty(window, 'KH_LANG', { value: Object.freeze(api), writable: false, configurable: false });
  } catch (e) { window.KH_LANG = api; }

  /* إزالة ?lang= فقط من الرابط بعد قراءة اللغة وحفظها، مع بقاء باقي المعاملات والـ hash كما هي */
  try {
    var url = new URL(location.href);
    if (url.searchParams.has('lang')) {
      url.searchParams.delete('lang');
      history.replaceState(history.state, '', url.pathname + url.search + url.hash);
    }
  } catch (e) {}
})();
