/* Applies the AI-paste toggle/lock fix to khaledoon/admin.html.
   Run from repo root: node scripts/apply-ai-paste-lock.cjs
   Every replacement must match exactly once, otherwise nothing is written. Idempotent. */
const fs = require('fs');
const vm = require('vm');
const FILE = 'khaledoon/admin.html';
let html = fs.readFileSync(FILE, 'utf8');

if (html.includes('aiLockById')) {
  console.log('Already applied; nothing to do.');
  process.exit(0);
}

const edits = [
  ['var openIds={};', 'var openIds={};var aiLockById={};'],
  [
    "cachedAiPackage=localStorage.getItem(aiPasteStorageKey)||localStorage.getItem('kh-story-ai-paste-last')||''}catch(ignoreAiCache){}",
    "cachedAiPackage=localStorage.getItem(aiPasteStorageKey)||''}catch(ignoreAiCache){}var aiLockKey=String(it.id||'new');aiPasteLocked=Object.prototype.hasOwnProperty.call(aiLockById,aiLockKey)?!!aiLockById[aiLockKey]:!!savedAiPackage;"
  ],
  [
    'if(savedAiPackage){aiPaste.value=String(savedAiPackage)}else if(cachedAiPackage){',
    'if(savedAiPackage&&(aiPasteLocked||!cachedAiPackage)){aiPaste.value=String(savedAiPackage)}else if(cachedAiPackage){'
  ],
  [
    "var aiImport=el('button','btn primary','تعديل');",
    "aiPaste.readOnly=aiPasteLocked;var aiImport=el('button','btn primary','تعديل');"
  ],
  [
    'if(aiPasteLocked){aiPasteLocked=false;aiPaste.readOnly=false;',
    'if(aiPasteLocked){aiPasteLocked=false;aiLockById[aiLockKey]=false;aiPaste.readOnly=false;'
  ],
  [
    'aiPaste.value=raw;aiPasteLocked=true;aiPaste.readOnly=true;',
    'aiPaste.value=raw;aiPasteLocked=true;aiLockById[String(it.id)]=true;aiPaste.readOnly=true;'
  ]
];

for (const [oldStr, newStr] of edits) {
  const n = html.split(oldStr).length - 1;
  if (n !== 1) {
    console.error('Expected exactly 1 match, found ' + n + ' for: ' + oldStr.slice(0, 80));
    process.exit(1);
  }
  html = html.replace(oldStr, () => newStr);
}

/* Syntax check of the big inline script before writing. */
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
const main = scripts.sort((a, b) => b.length - a.length)[0];
try { new vm.Script(main); } catch (e) { console.error('Syntax error after patch: ' + e.message); process.exit(1); }

fs.writeFileSync(FILE, html);
console.log('Patched ' + FILE);
