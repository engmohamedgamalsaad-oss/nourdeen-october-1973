# سياق تطوير الكرة الأرضية Three.js — خالدون عبر التاريخ

> هذا الملف مرجع دائم لمهمة استبدال كرة Canvas 2D بكرة Three.js داخل قسم `#khWorld`.
> أرسله في بداية أي محادثة جديدة مع أي مساعد ذكي ليعرف من أين نكمل.
> آخر تحديث: 2026-10-30.

## المهمة

إضافة كرة أرضية Three.js ثلاثية الأبعاد داخل `#khWorld` بدلًا من (أو بجانب) كرة Canvas 2D الحالية، مع الحفاظ على:
- بنية DOM التي يعتمد عليها `khaledoon-explorer.js` و`khaledoon-map.js`.
- أحداث `kh:world-select`.
- فلترة الحكايات المخفية من `story_visibility`.
- ألوان الأقسام من `khaledoon_admin_config`.
- ترجمة الواجهة باللغات الخمس (ar/en/fr/it/de).
- سلوك `normalizePoint` الأصلي (رفض أي نقطة بلا `https` + `source_name` بالخمس لغات).

## الملفات الأساسية (روابط ثابتة)

- `khaledoon/assets/khaledoon-world.js` — https://raw.githubusercontent.com/engmohamedgamalsaad-oss/nourdeen-october-1973/main/khaledoon/assets/khaledoon-world.js
- `khaledoon/assets/khaledoon-world.css` — https://raw.githubusercontent.com/engmohamedgamalsaad-oss/nourdeen-october-1973/main/khaledoon/assets/khaledoon-world.css
- `khaledoon/assets/khaledoon-explorer.js` — https://raw.githubusercontent.com/engmohamedgamalsaad-oss/nourdeen-october-1973/main/khaledoon/assets/khaledoon-explorer.js
- `khaledoon/assets/khaledoon-map.js` — https://raw.githubusercontent.com/engmohamedgamalsaad-oss/nourdeen-october-1973/main/khaledoon/assets/khaledoon-map.js
- `khaledoon/assets/khaledoon-world-motion.js` — https://raw.githubusercontent.com/engmohamedgamalsaad-oss/nourdeen-october-1973/main/khaledoon/assets/khaledoon-world-motion.js
- `khaledoon/assets/geo/natural-earth-110m.json` — https://raw.githubusercontent.com/engmohamedgamalsaad-oss/nourdeen-october-1973/main/khaledoon/assets/geo/natural-earth-110m.json
- `stories/index.json` — https://raw.githubusercontent.com/engmohamedgamalsaad-oss/nourdeen-october-1973/main/stories/index.json
- `stories/places.json` — https://raw.githubusercontent.com/engmohamedgamalsaad-oss/nourdeen-october-1973/main/stories/places.json
- `index.html` — https://raw.githubusercontent.com/engmohamedgamalsaad-oss/nourdeen-october-1973/main/index.html
- `scripts/check-natural-earth-globe.js` — https://raw.githubusercontent.com/engmohamedgamalsaad-oss/nourdeen-october-1973/main/scripts/check-natural-earth-globe.js

## القرار المتخذ: مسار "أصغر تغيير آمن"

**رفض** استبدال `khaledoon-world.js` بالكامل. **قبول** تعديل 3 أسطر فقط في `khaledoon-world.js`:

1. **في أول `function draw()`**: أضف `if(window.__khUseThree){raf=0;return}`.
2. **في أول `function requestDraw()`**: أضف `if(window.__khUseThree)return;`.
3. **بعد آخر `requestDraw();`** (قبل `fetch('khaledoon/assets/geo/natural-earth-110m.json')`): أضف:
   ```js
   window.__khWorldApi={points:points,select:selectPoint,sectionColor:sectionColor,getZoom:function(){return zoom},redraw:requestDraw};
   ```

هذا يحفظ كل الرموز التي يفحصها CI نصيًا. لا تحذف أي رمز من khaledoon-world.js.

## قيود صارمة

1. لا تعديل على `touch-action:pan-y` في `.kh-world-canvas` (سطر محمي في CSS، يفحصه CI).
2. لا تعديل على `normalizePoint` — يبقى يشترط https + `source_name` بالخمس لغات. النقطة 001 مرفوضة لأنها بلا مصدر (سلوك مقصود).
3. لا تعديل على `window.__khHiddenP` — Three.js يستخدم `__khWorldApi.points` جاهزة، لا يحمّل بيانات.
4. إدراج canvas Three.js قبل canvas 2D في `.kh-world-stage` — لأن `khaledoon-explorer.js` يقرأ `document.querySelector('#khWorld canvas')` ويأخذ أول canvas. لو أُدرج بعده، سيأخذ المخفي.
5. `__khUseThree=true` قبل world.js في index.html (في `<script>` عادي وليس module).
6. `khaledoon-world-three.js` يُحمَّل بعد `khaledoon-world.js` في index.html.

## واجهة __khWorldApi

```js
window.__khWorldApi = {
  points: [],          // مصفوفة النقاط، تُملأ لاحقًا بعد fetch — اقرأ .length كل إطار
  select: fn,          // selectPoint: يستقبل {p: point, x: px, y: py}
  sectionColor: fn,    // (section) => '#hex'
  getZoom: fn,         // () => 0.78..1.2
  redraw: fn           // requestDraw: يوقظ الرسم 2D (للاستخدام عند فشل WebGL)
};
```

## توقيع selectPoint في khaledoon-world.js

```js
function selectPoint(q){ // q = {p: point, x: number, y: number}
  if(!q || !q.p || !q.p.story) return;
  selectedPoint = q.p;
  canvas.style.transformOrigin = Math.round(q.x)+'px '+Math.round(q.y)+'px';
  selectedCard.replaceChildren(buildStoryCard(q.p));
  selectedCard.hidden = false;
  selectedInfo.hidden = true; selectedLink.hidden = true; sourceLink.hidden = true;
  renderStoryList();
  requestDraw();
  document.dispatchEvent(new CustomEvent('kh:world-select',{detail:{storyId:String(q.p.story.id),lat:q.p.lat,lng:q.p.lng}}));
}
```

ملاحظة: selectedLink يبقى مخفيًا في world.js بعد الاختيار (لأنه لم يُحدَّث). هذا خلل قائم في khaledoon-explorer.js (يقرأ `#khWorld .kh-world-side > a.kh-world-chip:not([hidden])` لأخذ رقم الحكاية، وقد يأخذ sourceLink بدلًا من selectedLink). لا نصلحه الآن لأنه خارج نطاق المهمة.

## فحوصات CI المتأثرة

من `.github/workflows/home-language-check.yml`:

- `node --check khaledoon/assets/khaledoon-world.js` — يجب أن يبقى نحويًا.
- `node scripts/check-natural-earth-globe.js` — يفحص رموزًا نصية في `khaledoon-world.js` و`khaledoon-world.css`. سردها في الملف 01-rules-and-checks.txt.
- `node scripts/check-map-story-links.js` — يفحص تطابق index.json مع ملفات data.json.
- `node scripts/check-story-visibility-flow.js` — يفحص فلترة المخفي في الخريطة والبحث والمفضلة.

## حالة التنفيذ

- [x] تحديد المسار (أصغر تغيير آمن، 3 أسطر في world.js).
- [x] كتابة docs/globe-threejs-context.md (هذا الملف).
- [ ] كتابة khaledoon/assets/khaledoon-world-three.js.
- [ ] تعديل 3 أسطر في khaledoon-world.js.
- [ ] إضافة CSS في نهاية khaledoon-world.css.
- [ ] تعديل index.html (سطر __khUseThree + تحميل world-three.js).
- [ ] اختبار في متصفح (لم يُختبر بعد).
- [ ] تشغيل node --check + node scripts/check-natural-earth-globe.js (لم يُشغّلا بعد).

## ما لم يُختبر (تحفظ دائم)

- لم يُشغَّل الكود في متصفح — الكود مكتوب بعناية لكنه غير مختبر تشغيليًا.
- لم تُشغَّل فحوصات CI محليًا — node --check وcheck-natural-earth-globe.js يفترض أنهما يمران، لكن لم يُتحقق.
- سلوك touch-action:pan-y مع OrbitControls على هاتف غير مؤكد. OrbitControls يستمع إلى touchstart/touchmove وقد يمنع تمرير الصفحة عند السحب فوق الكرة. البديل عند التعارض: touch-action:none على canvas Three.js فقط.
- khaledoon-explorer.js يعترض النقر على `#khWorld a.btn.ghost` ويقرأ رقم الحكاية من `#khWorld .kh-world-side > a.kh-world-chip:not([hidden])`. قد يأخذ sourceLink بدلًا من selectedLink — خلل قائم، خارج نطاق المهمة.

## ملاحظات للشات القادم

- لا تعِد طلب قراءة الملفات: الروابط الخام أعلاه تعمل.
- لا تقترح استبدال khaledoon-world.js بالكامل: هذا مرفوض من صاحب المشروع، يخالف "أصغر تغيير آمن".
- لا تلمس normalizePoint: سلوكه مقصود (رفض النقاط بلا مصدر كامل).
- لا تلمس touch-action:pan-y في السطر المحمي.
- إدراج canvas Three.js قبل canvas 2D.
- __khUseThree=true قبل world.js.


## مراجعة فعلية للمستودع — 2026-10-29

تمت مقارنة هذا المرجع مع الملفات الحالية في الفرع `main`. هذا القسم يدوّن نتائج التحقق، ولا يعني أن Three.js قد نُفّذ أو نُشر.

### الحالة المؤكدة وقت المراجعة

- `khaledoon/assets/khaledoon-world.js` ما زال نسخة Canvas 2D الأصلية؛ لم تُضف إليه `__khWorldApi` ولم تُعدّل دالتا `draw()` و`requestDraw()`.
- `index.html` لا يحتوي حاليًا على `window.__khUseThree=true` ولا يحمل `khaledoon-world-three.js`.
- `khaledoon/assets/khaledoon-world-three.js` لم يكن موجودًا في `main` وقت المراجعة.
- CSS الحالي يحتفظ بقاعدة `.kh-world-canvas{...touch-action:pan-y...}` المحمية. لا تُعدّلها.
- `scripts/check-natural-earth-globe.js` يتحقق من وجود رموز محددة في ملفات Canvas الحالية، بما فيها `function loadSectionPalette` و`function loadHiddenStories` و`story_visibility?select=story_id` و`dispatchEvent(new CustomEvent('kh:world-select'`، ومن قاعدة CSS المحمية.
- `normalizePoint` الحالي يرفض النقاط التي لا تحتوي على رابط HTTPS ومصدر مترجم باللغات الخمس. لا تغيّر هذا السلوك.

### ملاحظات مراجعة على مسودة Three.js المقدمة

1. المسودة ترسم كرة بلون شبكي، وتضيف خطوط الحدود والمدن، لكنها لا ترسم مضلعات `g.land` نفسها؛ لذلك لن تظهر القارات كأشكال أرض فعلية كما تصف المهمة. يلزم تنفيذ بناء هندسة اليابسة من Polygon/MultiPolygon.
2. الاستيراد المباشر لـ `OrbitControls.js` من jsDelivr باستخدام `import(ORBIT_URL)` قد يفشل في المتصفح بسبب استيراده الداخلي من الاسم المجرد `three` دون import map. يجب اختيار طريقة تحميل متوافقة واختبارها فعليًا.
3. لا يجوز اعتبار `failWebGL` أو مسار الرجوع إلى Canvas 2D ناجحًا قبل اختبار فشل WebGL وفشل تحميل المكتبات في متصفح. يجب التأكد أيضًا من عدم بقاء `window.__khThreeGlobe` في حالة تمنع إعادة المحاولة عند فشل التهيئة.
4. فحص النقاط في `animate()` يقارن `api.points.length` مع `lastLen`، لكن `rebuildMarkers()` لا يحدّث `lastLen` عند اكتمال التحميل الأول؛ يجب جعل اكتشاف التغير وإعادة البناء واضحين ومن دون إعادة بناء مستمرة.
5. يجب مراجعة اتجاه الإحداثيات في `latLngToVec3` و`drawBorders` معًا؛ لا يكفي أن تكون الأرقام صحيحة، بل يجب أن تتطابق مواقع الحدود والمدن مع اتجاه الكرة والعلامات.
6. المقتطف المرسل لإضافات CSS كان مقطوعًا عند `curs`، لذا لا يُعامل كملف CSS مكتمل أو قابل للإضافة كما هو.

### قاعدة قبل التنفيذ

لا ترفع ملفات Three.js أو تعدّل `index.html` على أساس المسودة وحدها. أولًا أصلح النقاط أعلاه، ثم طبّق أصغر تغيير آمن على نسخة `main` التي تمت قراءتها، وبعدها شغّل فحوصات CI واختبر الصفحة في متصفح. سجّل النتائج الفعلية فقط؛ لا تكتب أن اختبارًا نجح ما لم يتم تشغيله.
