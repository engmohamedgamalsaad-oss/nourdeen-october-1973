(function(){
  if(!window.I18N)return;
  window.I18N.register('ar',{c1:'الصفحة الرئيسية',c2:'حكايات أكتوبر'});
  window.I18N.register('en',{c1:'Home',c2:'October Stories'});
  window.I18N.register('fr',{c1:'Accueil',c2:'Récits d’octobre'});
  window.I18N.register('it',{c1:'Home',c2:'Racconti d’ottobre'});
  window.I18N.register('de',{c1:'Startseite',c2:'Oktober-Geschichten'});
  (function(){
    var IDX={en:0,fr:1,it:2,de:3};
    var AR_TITLE='رجال خالدون عبر التاريخ | حكايات أكتوبر 1973';
    var ARIA={
      'معرض الوسائط':['Media gallery','Galerie multimédia','Galleria multimediale','Mediengalerie'],
      'هل تعلم':['Did you know?','Le saviez-vous ?','Lo sapevi?','Schon gewusst?'],
      'السابق':['Previous','Précédent','Precedente','Zurück'],
      'التالي':['Next','Suivant','Successivo','Weiter'],
      'اختيار الشريحة':['Choose a slide','Choisir une diapositive','Scegli una diapositiva','Folie auswählen']
    };
    function patch(){
      var I=window.I18N,i=I&&IDX[I.lang()];
      if(i===undefined)return;
      if(document.title===AR_TITLE&&I.t('k1')!=='k1'&&I.t('k2')!=='k2')document.title=I.t('k1')+' | '+I.t('k2');
      var nodes=document.querySelectorAll('[aria-label]');
      for(var n=0;n<nodes.length;n++){
        var v=ARIA[nodes[n].getAttribute('aria-label')];
        if(v)nodes[n].setAttribute('aria-label',v[i]);
      }
    }
    document.addEventListener('site-language-change',patch);
  })();
  window.I18N.apply();
})();