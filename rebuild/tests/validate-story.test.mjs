import test from 'node:test';
import assert from 'node:assert/strict';
import { validateStory } from '../validate-story.mjs';
const langs=['ar','en','fr','it','de'];
const image=()=>({url:'https://example.org/image.jpg',kind:'photograph',source_name:'Archive',source_url:'https://example.org/source',rights:'CC BY 4.0',i18n:Object.fromEntries(langs.map(l=>[l,{alt:'alt '+l,caption:'caption '+l,source_name:'source '+l,rights:'rights '+l}]))});
function fixture(){
 const i18n=Object.fromEntries(langs.map(l=>[l,{title:'title '+l,subtitle:'subtitle '+l,summary:'summary '+l,blocks:[{type:'paragraph',speaker:'karma',text:'opening '+l},{type:'paragraph',speaker:'narrator',text:'story '+l,image_after:'photo-one'},{type:'did_you_know',speaker:'narrator',text:'fact '+l}]}]));
 const quiz=Array.from({length:5},(_,i)=>({id:'question-'+(i+1),correct_option:1,i18n:Object.fromEntries(langs.map(l=>[l,{question:'question '+l,options:['one','two','three','four'].map(x=>x+' '+l),explanation:'why '+l}]))}));
 return {format:'KHALEDOON_STORY_V2',slug:'sample-story',section:'october',design:{variant:'military-history',accent:'#d6ad55'},original_body:'Submitted original',i18n,cover:image(),images:[{...image(),id:'photo-one'},{...image(),id:'photo-two'}],sources:[{title:'Reference',organization:'Archive',url:'https://example.org/reference'}],quiz};
}
test('accepts complete five-language package',()=>assert.deepEqual(validateStory(fixture()),[]));
test('rejects missing translations and image rights',()=>{const s=fixture();delete s.i18n.de;delete s.images[0].i18n.fr.rights;delete s.quiz[0].i18n.it.explanation;const e=validateStory(s);assert(e.some(x=>x.includes('i18n.de')));assert(e.some(x=>x.includes('images[0].i18n.fr.rights')));assert(e.some(x=>x.includes('quiz[0].i18n.it.explanation')));});
test('rejects unsafe paths, invalid source URL, and quiz count',()=>{const s=fixture();s.cover={...image(),url:undefined,path:'../private.jpg'};s.sources[0].url='javascript:alert(1)';s.cover.source_url='javascript:alert(1)';s.quiz.pop();const e=validateStory(s);assert(e.some(x=>x.includes('unsafe local path')));assert(e.some(x=>x.includes('cover: source_url')));assert(e.some(x=>x.includes('sources[0].url')));assert(e.some(x=>x.includes('exactly 5')));});
test('rejects duplicate quiz IDs and malformed design color',()=>{const s=fixture();s.quiz[1].id=s.quiz[0].id;s.design.accent='gold';const e=validateStory(s);assert(e.some(x=>x.includes('duplicated')));assert(e.some(x=>x.includes('six-digit hex')));});

test('rejects duplicate image IDs and broken inline image references',()=>{const s=fixture();s.images[1].id='photo-one';s.i18n.en.blocks[1].image_after='missing-image';const e=validateStory(s);assert(e.some(x=>x.includes('images[1].id duplicated')));assert(e.some(x=>x.includes('references missing image')));});
