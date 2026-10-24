/* Extra translations for story 006 (hero portrait caption and alt). Arabic remains the source text. */
(function(){
"use strict";
var S=window.StoryI18N=window.StoryI18N||{text:{},meta:{}};
var extra={
"en":{"صورة تاريخية منشورة عام 1882 · ملكية عامة · المصدر في قسم الصورة أدناه":"Historical portrait published in 1882 · Public domain · Source credited in the image section below","صورة تاريخية لأحمد عرابي باشا":"Historical portrait of Ahmed Urabi Pasha"},
"fr":{"صورة تاريخية منشورة عام 1882 · ملكية عامة · المصدر في قسم الصورة أدناه":"Portrait historique publié en 1882 · Domaine public · Source indiquée dans la section de l’image plus bas","صورة تاريخية لأحمد عرابي باشا":"Portrait historique d’Ahmed Urabi Pacha"},
"it":{"صورة تاريخية منشورة عام 1882 · ملكية عامة · المصدر في قسم الصورة أدناه":"Ritratto storico pubblicato nel 1882 · Pubblico dominio · Fonte indicata nella sezione dell’immagine più in basso","صورة تاريخية لأحمد عرابي باشا":"Ritratto storico di Ahmed Urabi Pascià"},
"de":{"صورة تاريخية منشورة عام 1882 · ملكية عامة · المصدر في قسم الصورة أدناه":"Historisches Porträt, 1882 veröffentlicht · Gemeinfrei · Quelle im Bildabschnitt weiter unten","صورة تاريخية لأحمد عرابي باشا":"Historisches Porträt von Ahmed Urabi Pascha"}
};
Object.keys(extra).forEach(function(lang){S.text[lang]=S.text[lang]||{};Object.assign(S.text[lang],extra[lang]);});
})();
