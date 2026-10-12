/* خالدون عبر التاريخ — ترجمات إضافية للصفحة الرئيسية (تُحمَّل بعد khaledoon.js) */
(function(){
var X=[
["حكايات أكتوبر 1973", "October 1973 Stories", "Récits d’octobre 1973", "Storie di ottobre 1973"],
["حكايات أبطال أكتوبر الأربع في الصفحة الأصلية، بنفس تصميمها وتنسيقها المعتمد.", "The four October heroes’ stories on the original page, with its approved design and layout.", "Les quatre histoires des héros d’octobre sur la page d’origine, avec son design et sa mise en page validés.", "Le quattro storie degli eroi di ottobre nella pagina originale, con il suo design e la sua impaginazione approvati."],
["اقرأ الحكايات الأربع ←", "Read the four stories →", "Lire les quatre histoires →", "Leggi le quattro storie →"],
["اكتشف الحكايات ←", "Discover the stories →", "Découvrir les histoires →", "Scopri le storie →"],
["من أقسام خالدون:", "From the sections of Immortals Through History:", "Parmi les rubriques d’Immortels à travers l’histoire :", "Dalle sezioni di Immortali attraverso la storia:"],
["افتح حكايات أكتوبر 1973 ←", "Open October 1973 Stories →", "Ouvrir Récits d’octobre 1973 →", "Apri Storie di ottobre 1973 →"],
["تُعدّ الحكايات بالاستناد إلى مصادر ومراجع يُشار إليها داخل كل حكاية، وتُراجع المعلومات قبل النشر قدر الإمكان. ويُقدَّم المحتوى لأغراض معرفية وتعليمية؛ ولا يعني نشره تبنّي الموقع لكل رأي أو تفسير وارد فيه. وتظل مسؤولية الآراء والمساهمات الشخصية المنسوبة إلى أصحابها، ويُرجى الرجوع إلى المصادر الأصلية للتحقق من التفاصيل.", "Stories are prepared based on sources and references cited within each story, and the information is reviewed before publication as far as possible. Content is offered for knowledge and educational purposes; publishing it does not mean the site endorses every opinion or interpretation in it. Responsibility for personal opinions and contributions remains with their authors, and readers are encouraged to consult the original sources to verify details.", "Les histoires sont élaborées à partir de sources et de références indiquées dans chaque histoire, et les informations sont vérifiées avant publication dans la mesure du possible. Le contenu est proposé à des fins de connaissance et d’éducation ; sa publication n’implique pas que le site adopte chaque opinion ou interprétation qu’il contient. La responsabilité des opinions et des contributions personnelles incombe à leurs auteurs, et il est recommandé de consulter les sources originales pour vérifier les détails.", "Le storie sono preparate sulla base di fonti e riferimenti indicati all’interno di ciascuna storia, e le informazioni vengono verificate prima della pubblicazione per quanto possibile. Il contenuto è offerto per scopi di conoscenza e istruzione; la sua pubblicazione non implica che il sito faccia propria ogni opinione o interpretazione in esso contenuta. La responsabilità delle opinioni e dei contributi personali resta ai rispettivi autori, e si invita a consultare le fonti originali per verificare i dettagli."]
];
var D={};X.forEach(function(r){D[r[0]]=r.slice(1)});
var LG=['ar','en','fr','it'];
function idx(){var s='ar';try{s=localStorage.getItem('kh-lang')||'ar'}catch(e){}var i=LG.indexOf(s);return i<0?0:i}
function apply(){
 var i=idx();if(!i)return;
 var w=document.createTreeWalker(document.body,4),n;
 while(n=w.nextNode()){
  var p=n.parentNode.nodeName;if(p==='SCRIPT'||p==='STYLE')continue;
  var o=n.__o!==undefined?n.__o:n.data,t=o.trim(),d=D[t];
  if(d){if(n.__o===undefined)n.__o=n.data;n.data=o.replace(t,d[i-1])}
 }
}
document.addEventListener('click',function(e){if(e.target.closest&&e.target.closest('.langs button'))apply()});
apply();
})();
