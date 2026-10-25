/* محرك ترجمة صفحات الحكايات: منطق فقط. النصوص تُسجَّل من assets/i18n/story-common.js ومن translations.js في كل حكاية. */
(function(){
'use strict';
var reg=window.StoryI18N=window.StoryI18N||{text:{},meta:{}};
var translations=reg.text;
var pageMeta=reg.meta;

/* ===== نصوص مشتركة كانت ناقصة: تعليقات الرسوم التوضيحية ونصوص مكتوبة داخل ملفات SVG =====
   تُسجَّل هنا دون استبدال أي ترجمة موجودة في ملف الحكاية نفسه. */
var sharedText={
 en:{
  "خالدون عبر التاريخ · رسم توضيحي":"Immortals Through History · Illustration",
  "قلب يمنح الأمل":"A Heart That Brings Hope",
  "العالم الذي قرأ القمر والصحراء":"The scientist who read the Moon and the desert",
  "ملكة صنعت أثرًا خالدًا":"A queen who left a lasting legacy",
  "قصائد وكتب وطرق بين المدن":"Poems, books and roads between cities",
  "رسم توضيحي — ليس صورة تاريخية أرشيفية":"Illustration — not a historical archival image",
  "غلاف توضيحي — ليس صورة تاريخية للشخصية":"Illustrated cover — not a historical image of the figure",
  "فتح مصر":"The Conquest of Egypt",
  "عمرو بن العاص":"Amr ibn al-As",
  "عمرو بن العاص — فتح مصر":"Amr ibn al-As — The Conquest of Egypt",
  "مجدي يعقوب":"Magdi Yacoub",
  "فاروق الباز":"Farouk El-Baz",
  "حتشبسوت: الفرعون الذهبي على عرش النيل":"Hatshepsut: The Golden Pharaoh on the Nile Throne",
  "أبو بكر الخوارزمي: حكاية شاعر رحّالة":"Abu Bakr al-Khwarizmi: The Journey of a Poet",
  "رسم توضيحي لقلب بشري وخط نبض ورموز طبية، وليس صورة فوتوغرافية أو تصويرًا طبيًا حقيقيًا.":"An illustration of a human heart, a pulse line and medical symbols; it is not a photograph or a real medical image.",
  "رسم توضيحي لسطح القمر والصحراء ومسارات الاستكشاف، وليس صورة أرشيفية.":"An illustration of the Moon’s surface, the desert and exploration routes; not an archival image.",
  "رسم توضيحي لأروقة العمارة الإسلامية بألوان خضراء وذهبية، وليس صورة أرشيفية.":"An illustration of Islamic architectural arcades in green and gold; not an archival image.",
  "رسم فني تخيلي مستوحى من معبد حتشبسوت والنقوش المصرية القديمة، وليس صورة أثرية.":"An imaginative artwork inspired by Hatshepsut’s temple and ancient Egyptian reliefs; not a photograph of an artefact.",
  "رسم توضيحي لمخطوطات وكتابة بالحبر وطريق سفر في العصر العباسي، وليس صورة أرشيفية.":"An illustration of manuscripts, ink writing and a travel road in the Abbasid era; not an archival image.",
  "رسم توضيحي محلي أُعد لصفحة الحكاية، وليس صورة أرشيفية.":"A local illustration prepared for the story page, not an archival image.",
  "للتفريق بين الرسم التوضيحي والصور الفوتوغرافية الموثقة، لا يُنسب هذا الرسم إلى مصدر تاريخي.":"To distinguish the illustration from documented photographs, it is not credited to a historical source.",
  "رسم توضيحي للحكاية، وليس صورة تاريخية أرشيفية":"Illustration for the story, not a historical archival image",
  "رسم توضيحي بديل للحكاية؛ راجع رابط المصدر للتفاصيل التاريخية":"Alternative illustration for the story; see the source link for historical details",
  "رابط المصدر":"Source link",
  "صورة أرشيفية":"Archival photograph",
  "صورة توضيحية":"Illustration",
  "Public Domain وفق بيانات سجل الأرشيف. يُنصح بمراجعة المصدر الأصلي قبل إعادة الاستخدام. ·":"Public Domain according to the archive record. Check the original source before reuse. ·"
 },
 fr:{
  "خالدون عبر التاريخ · رسم توضيحي":"Immortels à travers l’histoire · Illustration",
  "قلب يمنح الأمل":"Un cœur qui fait naître l’espoir",
  "العالم الذي قرأ القمر والصحراء":"Le scientifique qui a lu la Lune et le désert",
  "ملكة صنعت أثرًا خالدًا":"Une reine qui a laissé un héritage durable",
  "قصائد وكتب وطرق بين المدن":"Des poèmes, des livres et des routes entre les villes",
  "رسم توضيحي — ليس صورة تاريخية أرشيفية":"Illustration — pas une image d’archive historique",
  "غلاف توضيحي — ليس صورة تاريخية للشخصية":"Couverture illustrée — pas une image historique du personnage",
  "فتح مصر":"La conquête de l’Égypte",
  "عمرو بن العاص":"Amr ibn al-As",
  "عمرو بن العاص — فتح مصر":"Amr ibn al-As — La conquête de l’Égypte",
  "مجدي يعقوب":"Magdi Yacoub",
  "فاروق الباز":"Farouk El-Baz",
  "حتشبسوت: الفرعون الذهبي على عرش النيل":"Hatchepsout : le pharaon d’or sur le trône du Nil",
  "أبو بكر الخوارزمي: حكاية شاعر رحّالة":"Abou Bakr al-Khwarizmi : le voyage d’un poète",
  "رسم توضيحي لقلب بشري وخط نبض ورموز طبية، وليس صورة فوتوغرافية أو تصويرًا طبيًا حقيقيًا.":"Illustration d’un cœur humain, d’une ligne de pouls et de symboles médicaux ; ce n’est ni une photographie ni une image médicale réelle.",
  "رسم توضيحي لسطح القمر والصحراء ومسارات الاستكشاف، وليس صورة أرشيفية.":"Illustration de la surface lunaire, du désert et d’itinéraires d’exploration ; ce n’est pas une image d’archive.",
  "رسم توضيحي لأروقة العمارة الإسلامية بألوان خضراء وذهبية، وليس صورة أرشيفية.":"Illustration d’arcades de l’architecture islamique en vert et or ; ce n’est pas une image d’archive.",
  "رسم فني تخيلي مستوحى من معبد حتشبسوت والنقوش المصرية القديمة، وليس صورة أثرية.":"Œuvre imaginaire inspirée du temple d’Hatchepsout et des reliefs de l’Égypte ancienne ; ce n’est pas une image archéologique.",
  "رسم توضيحي لمخطوطات وكتابة بالحبر وطريق سفر في العصر العباسي، وليس صورة أرشيفية.":"Illustration de manuscrits, d’écriture à l’encre et d’une route de voyage à l’époque abbasside ; ce n’est pas une image d’archive.",
  "رسم توضيحي محلي أُعد لصفحة الحكاية، وليس صورة أرشيفية.":"Illustration réalisée pour la page de l’histoire, et non une image d’archive.",
  "للتفريق بين الرسم التوضيحي والصور الفوتوغرافية الموثقة، لا يُنسب هذا الرسم إلى مصدر تاريخي.":"Pour distinguer l’illustration des photographies documentées, elle n’est attribuée à aucune source historique.",
  "رسم توضيحي للحكاية، وليس صورة تاريخية أرشيفية":"Illustration de l’histoire, et non une image d’archive historique",
  "رسم توضيحي بديل للحكاية؛ راجع رابط المصدر للتفاصيل التاريخية":"Illustration de remplacement pour l’histoire ; consultez le lien vers la source pour les détails historiques",
  "رابط المصدر":"Lien vers la source",
  "صورة أرشيفية":"Photographie d’archives",
  "صورة توضيحية":"Illustration",
  "Public Domain وفق بيانات سجل الأرشيف. يُنصح بمراجعة المصدر الأصلي قبل إعادة الاستخدام. ·":"Domaine public selon la notice d’archive. Vérifiez la source originale avant toute réutilisation. ·"
 },
 it:{
  "خالدون عبر التاريخ · رسم توضيحي":"Immortali attraverso la storia · Illustrazione",
  "قلب يمنح الأمل":"Un cuore che fa nascere la speranza",
  "العالم الذي قرأ القمر والصحراء":"Lo scienziato che lesse la Luna e il deserto",
  "ملكة صنعت أثرًا خالدًا":"Una regina che lasciò un’eredità duratura",
  "قصائد وكتب وطرق بين المدن":"Poesie, libri e strade tra le città",
  "رسم توضيحي — ليس صورة تاريخية أرشيفية":"Illustrazione — non è un’immagine storica d’archivio",
  "غلاف توضيحي — ليس صورة تاريخية للشخصية":"Copertina illustrata — non è un’immagine storica del personaggio",
  "فتح مصر":"La conquista dell’Egitto",
  "عمرو بن العاص":"Amr ibn al-As",
  "عمرو بن العاص — فتح مصر":"Amr ibn al-As — La conquista dell’Egitto",
  "مجدي يعقوب":"Magdi Yacoub",
  "فاروق الباز":"Farouk El-Baz",
  "حتشبسوت: الفرعون الذهبي على عرش النيل":"Hatshepsut: il faraone d’oro sul trono del Nilo",
  "أبو بكر الخوارزمي: حكاية شاعر رحّالة":"Abu Bakr al-Khwarizmi: il viaggio di un poeta",
  "رسم توضيحي لقلب بشري وخط نبض ورموز طبية، وليس صورة فوتوغرافية أو تصويرًا طبيًا حقيقيًا.":"Illustrazione di un cuore umano, di una linea del battito e di simboli medici; non è una fotografia né un’immagine medica reale.",
  "رسم توضيحي لسطح القمر والصحراء ومسارات الاستكشاف، وليس صورة أرشيفية.":"Illustrazione della superficie lunare, del deserto e dei percorsi di esplorazione; non è un’immagine d’archivio.",
  "رسم توضيحي لأروقة العمارة الإسلامية بألوان خضراء وذهبية، وليس صورة أرشيفية.":"Illustrazione di portici dell’architettura islamica in verde e oro; non è un’immagine d’archivio.",
  "رسم فني تخيلي مستوحى من معبد حتشبسوت والنقوش المصرية القديمة، وليس صورة أثرية.":"Opera d’arte immaginaria ispirata al tempio di Hatshepsut e ai rilievi dell’antico Egitto; non è un’immagine archeologica.",
  "رسم توضيحي لمخطوطات وكتابة بالحبر وطريق سفر في العصر العباسي، وليس صورة أرشيفية.":"Illustrazione di manoscritti, scrittura a inchiostro e una strada di viaggio in età abbaside; non è un’immagine d’archivio.",
  "رسم توضيحي محلي أُعد لصفحة الحكاية، وليس صورة أرشيفية.":"Illustrazione realizzata per la pagina della storia, non un’immagine d’archivio.",
  "للتفريق بين الرسم التوضيحي والصور الفوتوغرافية الموثقة، لا يُنسب هذا الرسم إلى مصدر تاريخي.":"Per distinguere l’illustrazione dalle fotografie documentate, non è attribuita a una fonte storica.",
  "رسم توضيحي للحكاية، وليس صورة تاريخية أرشيفية":"Illustrazione della storia, non un’immagine storica d’archivio",
  "رسم توضيحي بديل للحكاية؛ راجع رابط المصدر للتفاصيل التاريخية":"Illustrazione sostitutiva per la storia; consulta il link alla fonte per i dettagli storici",
  "رابط المصدر":"Link alla fonte",
  "صورة أرشيفية":"Fotografia d’archivio",
  "صورة توضيحية":"Illustrazione",
  "Public Domain وفق بيانات سجل الأرشيف. يُنصح بمراجعة المصدر الأصلي قبل إعادة الاستخدام. ·":"Pubblico dominio secondo la scheda archivistica. Verificare la fonte originale prima del riutilizzo. ·"
 },
 de:{
  "خالدون عبر التاريخ · رسم توضيحي":"Unsterbliche durch die Geschichte · Illustration",
  "قلب يمنح الأمل":"Ein Herz, das Hoffnung schenkt",
  "العالم الذي قرأ القمر والصحراء":"Der Wissenschaftler, der den Mond und die Wüste las",
  "ملكة صنعت أثرًا خالدًا":"Eine Königin, die ein bleibendes Erbe schuf",
  "قصائد وكتب وطرق بين المدن":"Gedichte, Bücher und Wege zwischen den Städten",
  "رسم توضيحي — ليس صورة تاريخية أرشيفية":"Illustration – kein historisches Archivbild",
  "غلاف توضيحي — ليس صورة تاريخية للشخصية":"Illustriertes Cover – kein historisches Bild der Person",
  "فتح مصر":"Die Eroberung Ägyptens",
  "عمرو بن العاص":"Amr ibn al-As",
  "عمرو بن العاص — فتح مصر":"Amr ibn al-As — Die Eroberung Ägyptens",
  "مجدي يعقوب":"Magdi Yacoub",
  "فاروق الباز":"Farouk El-Baz",
  "حتشبسوت: الفرعون الذهبي على عرش النيل":"Hatschepsut: Der goldene Pharao auf dem Thron des Nils",
  "أبو بكر الخوارزمي: حكاية شاعر رحّالة":"Abu Bakr al-Chwarizmi: Die Reise eines Dichters",
  "رسم توضيحي لقلب بشري وخط نبض ورموز طبية، وليس صورة فوتوغرافية أو تصويرًا طبيًا حقيقيًا.":"Illustration eines menschlichen Herzens, einer Pulslinie und medizinischer Symbole; kein Foto und keine echte medizinische Aufnahme.",
  "رسم توضيحي لسطح القمر والصحراء ومسارات الاستكشاف، وليس صورة أرشيفية.":"Illustration der Mondoberfläche, der Wüste und von Erkundungsrouten; kein Archivbild.",
  "رسم توضيحي لأروقة العمارة الإسلامية بألوان خضراء وذهبية، وليس صورة أرشيفية.":"Illustration islamischer Arkaden in Grün und Gold; kein Archivbild.",
  "رسم فني تخيلي مستوحى من معبد حتشبسوت والنقوش المصرية القديمة، وليس صورة أثرية.":"Frei gestaltetes Kunstwerk nach dem Tempel der Hatschepsut und altägyptischen Reliefs; kein Foto eines Fundstücks.",
  "رسم توضيحي لمخطوطات وكتابة بالحبر وطريق سفر في العصر العباسي، وليس صورة أرشيفية.":"Illustration von Handschriften, Tintenschrift und einem Reiseweg in der Abbasidenzeit; kein Archivbild.",
  "رسم توضيحي محلي أُعد لصفحة الحكاية، وليس صورة أرشيفية.":"Für die Geschichtsseite angefertigte Illustration, kein Archivbild.",
  "للتفريق بين الرسم التوضيحي والصور الفوتوغرافية الموثقة، لا يُنسب هذا الرسم إلى مصدر تاريخي.":"Zur Unterscheidung von dokumentierten Fotografien wird diese Illustration keiner historischen Quelle zugeschrieben.",
  "رسم توضيحي للحكاية، وليس صورة تاريخية أرشيفية":"Illustration zur Geschichte, kein historisches Archivbild",
  "رسم توضيحي بديل للحكاية؛ راجع رابط المصدر للتفاصيل التاريخية":"Ersatzillustration zur Geschichte; Details zur Geschichte siehe Quellenlink",
  "رابط المصدر":"Quellenlink",
  "صورة أرشيفية":"Archivfoto",
  "صورة توضيحية":"Illustration",
  "Public Domain وفق بيانات سجل الأرشيف. يُنصح بمراجعة المصدر الأصلي قبل إعادة الاستخدام. ·":"Gemeinfrei laut Archivdatensatz. Vor einer Wiederverwendung die Originalquelle prüfen. ·"
 }
};

/* نصوص خاصة بحكاية واحدة لم تكن موجودة في ملف ترجمتها. */
var storyExtraText={
 "012":{
  en:{"· ناسا: Apollo 11 and Landing Site 2 in the Sea of Tranquility":"· NASA: Apollo 11 and Landing Site 2 in the Sea of Tranquility"},
  fr:{"· ناسا: Apollo 11 and Landing Site 2 in the Sea of Tranquility":"· NASA : Apollo 11 et le site d’alunissage 2 dans la mer de la Tranquillité"},
  it:{"· ناسا: Apollo 11 and Landing Site 2 in the Sea of Tranquility":"· NASA: Apollo 11 e il sito di allunaggio 2 nel Mare della Tranquillità"},
  de:{"· ناسا: Apollo 11 and Landing Site 2 in the Sea of Tranquility":"· NASA: Apollo 11 und Landeplatz 2 im Meer der Ruhe"}
 },
 "014":{
  en:{
   "صفحات من مجموعة رسائل أبي بكر الخوارزمي، في طبعة تاريخية تعود إلى عام 1880.":"Pages from the collected letters of Abu Bakr al-Khwarizmi, in a historical edition from 1880.",
   "صفحتان مختلفتان من الطبعة التاريخية نفسها، تعرضان نص الرسائل الأدبية المنسوبة إلى أبي بكر الخوارزمي.":"Two different pages from the same historical edition, showing the text of the literary letters attributed to Abu Bakr al-Khwarizmi.",
   "صفحتان متقابلتان من طبعة رسائل أبي بكر الخوارزمي الصادرة عام 1880.":"Two facing pages from the 1880 edition of the letters of Abu Bakr al-Khwarizmi.",
   "صفحتان إضافيتان من كتاب رسائل أبي بكر الخوارزمي في طبعة عام 1880.":"Two more pages from the 1880 edition of the book of letters of Abu Bakr al-Khwarizmi."
  },
  fr:{
   "صفحات من مجموعة رسائل أبي بكر الخوارزمي، في طبعة تاريخية تعود إلى عام 1880.":"Pages du recueil de lettres d’Abou Bakr al-Khwarizmi, dans une édition historique de 1880.",
   "صفحتان مختلفتان من الطبعة التاريخية نفسها، تعرضان نص الرسائل الأدبية المنسوبة إلى أبي بكر الخوارزمي.":"Deux autres pages de la même édition historique, présentant le texte des lettres littéraires attribuées à Abou Bakr al-Khwarizmi.",
   "صفحتان متقابلتان من طبعة رسائل أبي بكر الخوارزمي الصادرة عام 1880.":"Deux pages en regard de l’édition de 1880 des lettres d’Abou Bakr al-Khwarizmi.",
   "صفحتان إضافيتان من كتاب رسائل أبي بكر الخوارزمي في طبعة عام 1880.":"Deux autres pages du livre de lettres d’Abou Bakr al-Khwarizmi, édition de 1880."
  },
  it:{
   "صفحات من مجموعة رسائل أبي بكر الخوارزمي، في طبعة تاريخية تعود إلى عام 1880.":"Pagine della raccolta di lettere di Abu Bakr al-Khwarizmi, in un’edizione storica del 1880.",
   "صفحتان مختلفتان من الطبعة التاريخية نفسها، تعرضان نص الرسائل الأدبية المنسوبة إلى أبي بكر الخوارزمي.":"Due pagine diverse della stessa edizione storica, con il testo delle lettere letterarie attribuite ad Abu Bakr al-Khwarizmi.",
   "صفحتان متقابلتان من طبعة رسائل أبي بكر الخوارزمي الصادرة عام 1880.":"Due pagine affiancate dell’edizione del 1880 delle lettere di Abu Bakr al-Khwarizmi.",
   "صفحتان إضافيتان من كتاب رسائل أبي بكر الخوارزمي في طبعة عام 1880.":"Altre due pagine del libro di lettere di Abu Bakr al-Khwarizmi, edizione del 1880."
  },
  de:{
   "صفحات من مجموعة رسائل أبي بكر الخوارزمي، في طبعة تاريخية تعود إلى عام 1880.":"Seiten aus der Briefsammlung von Abu Bakr al-Chwarizmi in einer historischen Ausgabe von 1880.",
   "صفحتان مختلفتان من الطبعة التاريخية نفسها، تعرضان نص الرسائل الأدبية المنسوبة إلى أبي بكر الخوارزمي.":"Zwei weitere Seiten derselben historischen Ausgabe mit dem Text der literarischen Briefe, die Abu Bakr al-Chwarizmi zugeschrieben werden.",
   "صفحتان متقابلتان من طبعة رسائل أبي بكر الخوارزمي الصادرة عام 1880.":"Zwei gegenüberliegende Seiten der Ausgabe von 1880 der Briefe von Abu Bakr al-Chwarizmi.",
   "صفحتان إضافيتان من كتاب رسائل أبي بكر الخوارزمي في طبعة عام 1880.":"Zwei weitere Seiten aus dem Briefbuch von Abu Bakr al-Chwarizmi, Ausgabe von 1880."
  }
 },
 "015":{
  en:{
   "الدكتور مجدي يعقوب في صورة فوتوغرافية موثقة.":"Dr Magdi Yacoub in a documented photograph.",
   "CC BY-SA 3.0؛ مع الإسناد إلى المصور ورابط الرخصة.":"CC BY-SA 3.0; credit the photographer and link the licence.",
   "قلب ينبض بالحياة: رسم توضيحي للحكاية.":"A Heart That Brings Hope: an illustration for the story.",
   "صورة فوتوغرافية موثقة للدكتور مجدي يعقوب.":"Documented photograph of Dr Magdi Yacoub.",
   "رسم توضيحي رمزي لحكاية مجدي يعقوب، وليس صورة فوتوغرافية.":"Symbolic illustration for the story of Magdi Yacoub, not a photograph."
  },
  fr:{
   "الدكتور مجدي يعقوب في صورة فوتوغرافية موثقة.":"Le docteur Magdi Yacoub sur une photographie documentée.",
   "CC BY-SA 3.0؛ مع الإسناد إلى المصور ورابط الرخصة.":"CC BY-SA 3.0 ; mentionner le photographe et lier la licence.",
   "قلب ينبض بالحياة: رسم توضيحي للحكاية.":"Un cœur qui fait naître l’espoir : illustration de l’histoire.",
   "صورة فوتوغرافية موثقة للدكتور مجدي يعقوب.":"Photographie documentée du docteur Magdi Yacoub.",
   "رسم توضيحي رمزي لحكاية مجدي يعقوب، وليس صورة فوتوغرافية.":"Illustration symbolique de l’histoire de Magdi Yacoub, et non une photographie."
  },
  it:{
   "الدكتور مجدي يعقوب في صورة فوتوغرافية موثقة.":"Il dottor Magdi Yacoub in una fotografia documentata.",
   "CC BY-SA 3.0؛ مع الإسناد إلى المصور ورابط الرخصة.":"CC BY-SA 3.0; indicare il fotografo e collegare la licenza.",
   "قلب ينبض بالحياة: رسم توضيحي للحكاية.":"Un cuore che fa nascere la speranza: illustrazione della storia.",
   "صورة فوتوغرافية موثقة للدكتور مجدي يعقوب.":"Fotografia documentata del dottor Magdi Yacoub.",
   "رسم توضيحي رمزي لحكاية مجدي يعقوب، وليس صورة فوتوغرافية.":"Illustrazione simbolica della storia di Magdi Yacoub, non una fotografia."
  },
  de:{
   "الدكتور مجدي يعقوب في صورة فوتوغرافية موثقة.":"Dr. Magdi Yacoub auf einer dokumentierten Fotografie.",
   "CC BY-SA 3.0؛ مع الإسناد إلى المصور ورابط الرخصة.":"CC BY-SA 3.0; Fotograf nennen und Lizenz verlinken.",
   "قلب ينبض بالحياة: رسم توضيحي للحكاية.":"Ein Herz, das Hoffnung schenkt: Illustration zur Geschichte.",
   "صورة فوتوغرافية موثقة للدكتور مجدي يعقوب.":"Dokumentierte Fotografie von Dr. Magdi Yacoub.",
   "رسم توضيحي رمزي لحكاية مجدي يعقوب، وليس صورة فوتوغرافية.":"Symbolische Illustration zur Geschichte von Magdi Yacoub, kein Foto."
  }
 }
};
function registerText(table){
 Object.keys(table).forEach(function(lang){
  var target=translations[lang]=translations[lang]||{};
  Object.keys(table[lang]).forEach(function(key){
   if(typeof target[key]!=='string')target[key]=table[lang][key];
  });
 });
}
registerText(sharedText);
(function(){
 var slug=document.body&&document.body.getAttribute('data-story-slug');
 if(slug&&storyExtraText[slug])registerText(storyExtraText[slug]);
})();

/* Supports both shared dictionaries {Arabic: {en,fr,it,de}} and story-local
   language-first dictionaries {en: {Arabic: translation}, ...}. */
function findTranslation(source, lang){
 var normalized=String(source==null?'':source).replace(/\s+/g,' ').trim();
 var direct=translations[normalized]||translations[source];
 if(direct&&typeof direct==='object'&&direct[lang])return direct;
 var byLanguage={};
 Object.keys(translations).forEach(function(language){
  var dictionary=translations[language];
  if(dictionary&&typeof dictionary==='object'){
   var value=dictionary[normalized];
   if(typeof value==='string')byLanguage[language]=value;
  }
 });
 return Object.keys(byLanguage).length?byLanguage:null;
}
function applyPageMeta(){
 var slug=document.body.getAttribute('data-story-slug');
 var lang=(window.I18N&&window.I18N.lang())||'ar';
 var meta=pageMeta[slug]&&pageMeta[slug][lang];
 if(!meta)return;
 document.title=meta[0];
 [['meta[name="description"]',meta[1]],['meta[property="og:title"]',meta[0]],['meta[property="og:description"]',meta[1]]].forEach(function(pair){
  var node=document.querySelector(pair[0]);if(node)node.setAttribute('content',pair[1]);
 });
}
document.addEventListener('DOMContentLoaded',applyPageMeta);
document.addEventListener('site-language-change',applyPageMeta);
if(document.readyState!=='loading')applyPageMeta();

function applyTranslationNotice(lang){
 var existing=document.getElementById('ai-translation-notice');
 if(lang==='ar'){
  if(existing)existing.remove();
  return;
 }
 var copy={
  en:{
   title:'Translation notice',
   body:'This page was translated from Arabic with the assistance of artificial intelligence (AI). The translation is provided for general information and accessibility; it may contain errors or omissions. The original Arabic text is the reference version. Please consult the cited sources when checking historical details.'
  },
  fr:{
   title:'Avis de traduction',
   body:'Cette page a été traduite de l’arabe avec l’aide de l’intelligence artificielle (IA). Cette traduction est fournie à titre informatif et pour faciliter l’accès au contenu ; elle peut comporter des erreurs ou des omissions. Le texte arabe original fait foi. Veuillez consulter les sources citées pour vérifier les détails historiques.'
  },
  it:{
   title:'Avviso sulla traduzione',
   body:'Questa pagina è stata tradotta dall’arabo con l’aiuto dell’intelligenza artificiale (IA). La traduzione è fornita a scopo informativo e per facilitare l’accesso ai contenuti; potrebbe contenere errori o omissioni. Il testo originale in arabo è la versione di riferimento. Per verificare i dettagli storici, consulta le fonti citate.'
  },
  de:{
   title:'Hinweis zur Übersetzung',
   body:'Diese Seite wurde mit Unterstützung künstlicher Intelligenz (KI) aus dem Arabischen übersetzt. Die Übersetzung dient der allgemeinen Information und Barrierefreiheit; sie kann Fehler oder Auslassungen enthalten. Maßgeblich ist der arabische Originaltext. Bitte prüfe historische Einzelheiten anhand der angegebenen Quellen.'
  }
 };
 var text=copy[lang];
 if(!text)return;
 if(!existing){
  existing=document.createElement('aside');
  existing.id='ai-translation-notice';
  existing.setAttribute('role','note');
  existing.style.cssText='box-sizing:border-box;width:calc(100% - 32px);max-width:900px;margin:24px auto 30px;padding:16px 20px;border:1px solid rgba(227,189,120,.42);border-left:4px solid #e3bd78;border-radius:12px;background:linear-gradient(135deg,rgba(12,35,45,.96),rgba(3,13,19,.98));color:#d9e3e4;font:400 .88rem/1.8 Arial,sans-serif;direction:ltr;text-align:left;box-shadow:0 10px 28px rgba(0,0,0,.22);';
  var heading=document.createElement('strong');
  heading.style.cssText='display:block;margin-bottom:7px;font-weight:700;color:#e3bd78;font-size:.78rem;letter-spacing:.04em;text-transform:uppercase;';
  heading.setAttribute('data-notice-title','');
  var paragraph=document.createElement('p');
  paragraph.style.cssText='margin:0;color:#d9e3e4;';
  paragraph.setAttribute('data-notice-body','');
  existing.appendChild(heading);
  existing.appendChild(paragraph);
  var footer=document.querySelector('footer');
  if(footer&&footer.parentNode)footer.parentNode.insertBefore(existing,footer.nextSibling);
  else document.body.appendChild(existing);
 }
 existing.querySelector('[data-notice-title]').textContent=text.title;
 existing.querySelector('[data-notice-body]').textContent=text.body;
}
var original=new WeakMap();
function applyFooterText(lang){
 document.querySelectorAll('.author,footer').forEach(function(footer){
 Array.prototype.forEach.call(footer.childNodes,function(node){
  if(node.nodeType!==3)return;
  if(!node.__storyI18nOriginal)node.__storyI18nOriginal=node.nodeValue;
  var originalText=node.__storyI18nOriginal;
  var normalized=originalText.replace(/\s+/g,' ').trim();
  var item=findTranslation(originalText,lang);
  if(lang==='ar'){node.nodeValue=originalText;return;}
  if(!item||!item[lang])return;
  var leading=(originalText.match(/^\s*/)||[''])[0];
  var trailing=(originalText.match(/\s*$/)||[''])[0];
  node.nodeValue=leading+item[lang]+trailing;
 });
 });
}

/* ===== رسومات SVG التي تحمل نصًا عربيًا داخلها (تُعرض عبر <img>) =====
   النص داخل الصورة لا يصل إليه مترجم الصفحة، فنجلب ملف SVG وننقل نصوصه
   إلى اللغة الحالية ثم نعرضه كصورة مضمّنة. عند العودة للعربية يرجع الملف الأصلي. */
var svgCache={};
function currentLang(){
 return (window.I18N&&window.I18N.lang&&window.I18N.lang())||document.documentElement.lang||'ar';
}
function fetchSvg(url){
 if(!svgCache[url]){
  svgCache[url]=fetch(url,{credentials:'same-origin'}).then(function(r){return r.ok?r.text():null;}).catch(function(){return null;});
 }
 return svgCache[url];
}
function lookupText(source,lang){
 var normalized=String(source==null?'':source).replace(/\s+/g,' ').trim();
 var dictionary=translations[lang];
 return dictionary&&typeof dictionary[normalized]==='string'?dictionary[normalized]:null;
}
function localizeSvg(markup,lang){
 var doc;
 try{doc=new DOMParser().parseFromString(markup,'image/svg+xml');}catch(e){return null;}
 var root=doc&&doc.documentElement;
 if(!root||doc.getElementsByTagName('parsererror').length)return null;
 var box=(root.getAttribute('viewBox')||'').split(/[\s,]+/).map(Number);
 var width=box.length===4&&box[2]>0?box[2]:(parseFloat(root.getAttribute('width'))||1200);
 var changed=false;
 Array.prototype.forEach.call(root.querySelectorAll('text,title,desc'),function(node){
  var source=node.textContent;
  if(!/[\u0600-\u06FF]/.test(source))return;
  var translated=lookupText(source,lang);
  if(!translated)return;
  node.textContent=translated;
  changed=true;
  if(node.nodeName==='text'){
   var size=parseFloat(node.getAttribute('font-size'))||20;
   var available=width*0.9,estimated=translated.length*size*0.55;
   if(estimated>available)node.setAttribute('font-size',String(Math.floor(size*available/estimated*10)/10));
  }
 });
 return changed?new XMLSerializer().serializeToString(root):null;
}
function applySvgImage(img,lang){
 var current=img.getAttribute('src')||'';
 if(current.indexOf('data:image/svg+xml')===0){
  if(!img.__svgOriginal)return;
 }else if(/\.svg(\?|#|$)/i.test(current)){
  img.__svgOriginal=current;
  img.__svgLang=null;
 }else{
  return;
 }
 var originalSrc=img.__svgOriginal;
 if(lang==='ar'){
  if(img.getAttribute('src')!==originalSrc)img.setAttribute('src',originalSrc);
  img.__svgLang='ar';
  return;
 }
 if(img.__svgLang===lang)return;
 var url;
 try{url=new URL(originalSrc,document.baseURI);}catch(e){return;}
 if(url.origin!==location.origin)return;
 fetchSvg(url.href).then(function(markup){
  if(!markup||currentLang()!==lang)return;
  var localized=localizeSvg(markup,lang);
  if(!localized)return;
  img.__svgLang=lang;
  img.setAttribute('src','data:image/svg+xml;charset=utf-8,'+encodeURIComponent(localized));
 });
}
function applySvgImages(){
 var lang=currentLang();
 document.querySelectorAll('img').forEach(function(img){applySvgImage(img,lang);});
}
function watchSvgImages(){
 if(!window.MutationObserver||!document.body)return;
 new MutationObserver(function(records){
  records.forEach(function(record){
   var target=record.target;
   if(target&&target.tagName==='IMG'&&(target.getAttribute('src')||'').indexOf('data:')!==0)applySvgImage(target,currentLang());
  });
 }).observe(document.body,{subtree:true,attributes:true,attributeFilter:['src']});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',watchSvgImages);
else watchSvgImages();

function apply(){
 var lang=(window.I18N&&window.I18N.lang())||document.documentElement.lang||'ar';
 var digitMap={'٠':'0','١':'1','٢':'2','٣':'3','٤':'4','٥':'5','٦':'6','٧':'7','٨':'8','٩':'9','۰':'0','۱':'1','۲':'2','۳':'3','۴':'4','۵':'5','۶':'6','۷':'7','۸':'8','۹':'9'};
 function normalizeLocalizedText(){
  if(lang==='ar')return;
  var walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT,null,false),node;
  while((node=walker.nextNode())){
   if(!node.nodeValue||!/[٠-٩۰-۹]/.test(node.nodeValue))continue;
   var parent=node.parentElement;
   if(parent&&/^(SCRIPT|STYLE|NOSCRIPT|TEXTAREA|CODE|PRE)$/.test(parent.tagName))continue;
   node.nodeValue=node.nodeValue.replace(/[٠-٩۰-۹]/g,function(d){return digitMap[d]||d;});
  }
  document.querySelectorAll('[alt],[aria-label],[title]').forEach(function(el){
   ['alt','aria-label','title'].forEach(function(attr){
    if(el.hasAttribute(attr))el.setAttribute(attr,el.getAttribute(attr).replace(/[٠-٩۰-۹]/g,function(d){return digitMap[d]||d;}));
   });
  });
 }
 function translateRemainingTextNodes(){
  if(lang==='ar')return;
  var walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT,null,false),node;
  while((node=walker.nextNode())){
   var parent=node.parentElement;
   if(!parent||/^(SCRIPT|STYLE|NOSCRIPT|TEXTAREA|CODE|PRE)$/.test(parent.tagName))continue;
   if(!/[\u0600-\u06FF]/.test(node.nodeValue))continue;
   var source=node.nodeValue,normalized=source.replace(/\s+/g,' ').trim();
   var item=findTranslation(source,lang);
   if(item&&item[lang]){
    var leading=(source.match(/^\s*/)||[''])[0],trailing=(source.match(/\s*$/)||[''])[0];
    node.nodeValue=leading+item[lang]+trailing;
   }
  }
 }
 document.querySelectorAll('h1,h2,h3,h4,p,figcaption,li,a,summary,blockquote,dt,dd,caption,time,.kicker,.quote,.panel h4,.lesson h4,.event h4,.reaction-count-line,.author strong,footer strong,.timeline h4,.timeline p,.timeline li,.sources h3,.sources li,.sources a,.ending h2,.ending p,.ending li,.story-ending h2,.story-ending p,.story-ending li').forEach(function(el){
   if(!original.has(el)) original.set(el,el.textContent);
   var ar=original.get(el);
   if(el.querySelector && el.querySelector('a')) return;
   if(el.children && el.children.length && !el.matches('a,footer strong')) return;
   if(lang==='ar'){if(el.textContent!==ar)el.textContent=ar;return;}
   var normalized=ar.replace(/\s+/g,' ').trim();
   var item=findTranslation(ar,lang);
   if(item&&item[lang]){if(el.textContent!==item[lang])el.textContent=item[lang];}
 });
 applyFooterText(lang);
 applyTranslationNotice(lang);
 document.querySelectorAll('[alt],[aria-label],[title]').forEach(function(el){
  ['alt','aria-label','title'].forEach(function(attr){
   if(!el.hasAttribute(attr))return;
   var prop='__storyI18nOriginal_'+attr;
   if(!el[prop])el[prop]=el.getAttribute(attr);
   var source=el[prop];
   var normalized=source.replace(/\s+/g,' ').trim();
   var item=findTranslation(source,lang);
   if(lang==='ar'){el.setAttribute(attr,(item&&item.ar)||source);return;}
   if(item&&item[lang])el.setAttribute(attr,item[lang]);
  });
 });
 translateRemainingTextNodes();
 normalizeLocalizedText();
 applySvgImages();
}
document.addEventListener('DOMContentLoaded',apply);
document.addEventListener('site-language-change',apply);
if(document.readyState!=='loading')apply();
})();
