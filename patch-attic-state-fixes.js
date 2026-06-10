const fs = require('fs');
const file = 'index.html';
let html = fs.readFileSync(file, 'utf8');

const cssMarker = '/* Archives transition force-close patch */';
if (!html.includes(cssMarker)) {
  const css = `
${cssMarker}
body.mode-to-attic #invWrap,
body.mode-attic #invWrap,
body.mode-to-table #invWrap,
body.mode-table-return #invWrap{
  transform:translateY(calc(-1 * var(--inv-h)))!important;
  pointer-events:none!important;
  z-index:150!important;
}
body.mode-to-attic #invTab,
body.mode-attic #invTab,
body.mode-to-table #invTab,
body.mode-table-return #invTab{
  pointer-events:none!important;
}
`;
  html = html.replace('</style>', css + '\n</style>');
}

// Close Archives at the actual start of every reading. This is source-level so it
// does not depend on wrapper timing.
const startNeedle = 'function startReading(){\n  state.deck=shuffle(buildDeck());';
const startReplacement = "function startReading(){\n  if(window.tlrCloseArchives)window.tlrCloseArchives();\n  state.deck=shuffle(buildDeck());";
if (html.includes(startNeedle) && !html.includes('if(window.tlrCloseArchives)window.tlrCloseArchives();\n  state.deck=shuffle(buildDeck());')) {
  html = html.replace(startNeedle, startReplacement);
}

// Make the attic transition close Archives from inside the transition functions.
const enterNeedle = "function enter(candles,shouldReset){\n    inAttic=true;";
const enterReplacement = "function enter(candles,shouldReset){\n    if(window.tlrCloseArchives)window.tlrCloseArchives();\n    inAttic=true;";
if (html.includes(enterNeedle)) html = html.replace(enterNeedle, enterReplacement);

const leaveNeedle = "function leave(){\n    if(!inAttic)return;inAttic=false;";
const leaveReplacement = "function leave(){\n    if(window.tlrCloseArchives)window.tlrCloseArchives();\n    if(!inAttic)return;inAttic=false;";
if (html.includes(leaveNeedle)) html = html.replace(leaveNeedle, leaveReplacement);

// Add helpers for found attic items, item type lookup, and the delayed Archives tutorial hint.
// The old tutorial used tlr_tut_inv_* keys. Those are now suppressed and the moved hint
// uses tlr_tut_archives_after_attic instead.
const helperNeedle = "  function candlesFromScore(score){if(score>=1000)return 7;";
const helpers = "  function suppressOldArchivesTutorial(){try{['tlr_tut_inv_open','tlr_tut_inv_name','tlr_tut_inv_detail'].forEach(function(k){localStorage.setItem(k,'1')})}catch(e){}}\n  suppressOldArchivesTutorial();\n  function foundItems(){try{return JSON.parse(localStorage.getItem('tlr_attic_found_items')||'[]')}catch(e){return []}}\n  function atticItemType(o){try{const items=[...(typeof INV_ITEMS!=='undefined'?INV_ITEMS:[]),...(typeof INV_FRAGMENTS!=='undefined'?Object.values(INV_FRAGMENTS):[])];const hit=items.find(function(item){return item&&item.id===o.itemId});return (hit&&(hit.type||hit.kind||hit.category))||o.itemType||'Item';}catch(e){return o.itemType||'Item'}}\n  function showArchivesHintAfterAttic(){let should=false;try{should=localStorage.getItem('tlr_pending_archives_hint_after_attic')==='1'&&!localStorage.getItem('tlr_tut_archives_after_attic');localStorage.removeItem('tlr_pending_archives_hint_after_attic');if(should){localStorage.setItem('tlr_tut_archives_after_attic','1');suppressOldArchivesTutorial();}}catch(e){}if(!should)return;const root=document.getElementById('invWrap')||document.body;document.querySelectorAll('.inv-tut.archives-return-hint').forEach(function(el){el.remove()});const h=document.createElement('div');h.className='inv-tut archives-return-hint';h.innerHTML='Your discovery was added to the <b>Archives</b>. Pull this tab open to inspect it.';root.appendChild(h);setTimeout(function(){h.remove()},6800)}\n  function candlesFromScore(score){if(score>=1000)return 7;";
if (html.includes(helperNeedle) && !html.includes('function atticItemType(o)')) {
  html = html.replace(helperNeedle, helpers);
}

const foundOnlyNeedle = "  function foundItems(){try{return JSON.parse(localStorage.getItem('tlr_attic_found_items')||'[]')}catch(e){return []}}\n  function candlesFromScore(score){if(score>=1000)return 7;";
if (html.includes(foundOnlyNeedle) && !html.includes('function atticItemType(o)')) {
  html = html.replace(foundOnlyNeedle, helpers);
}

// Upgrade the previous version of this helper if it already exists from an earlier patch run.
if (html.includes("function showArchivesHintAfterAttic(){let should=false;try{should=localStorage.getItem('tlr_pending_archives_hint_after_attic')==='1'&&!localStorage.getItem('tlr_tut_inv_open');")) {
  html = html.replace(
    "function showArchivesHintAfterAttic(){let should=false;try{should=localStorage.getItem('tlr_pending_archives_hint_after_attic')==='1'&&!localStorage.getItem('tlr_tut_inv_open');localStorage.removeItem('tlr_pending_archives_hint_after_attic');if(should)localStorage.setItem('tlr_tut_inv_open','1');}",
    "function showArchivesHintAfterAttic(){let should=false;try{should=localStorage.getItem('tlr_pending_archives_hint_after_attic')==='1'&&!localStorage.getItem('tlr_tut_archives_after_attic');localStorage.removeItem('tlr_pending_archives_hint_after_attic');if(should){localStorage.setItem('tlr_tut_archives_after_attic','1');suppressOldArchivesTutorial();}}"
  );
}
if (html.includes('function foundItems(){try{return JSON.parse(localStorage.getItem')) && !html.includes('function suppressOldArchivesTutorial(){')) {
  html = html.replace(
    '  function foundItems(){try{return JSON.parse(localStorage.getItem',
    "  function suppressOldArchivesTutorial(){try{['tlr_tut_inv_open','tlr_tut_inv_name','tlr_tut_inv_detail'].forEach(function(k){localStorage.setItem(k,'1')})}catch(e){}}\n  suppressOldArchivesTutorial();\n  function foundItems(){try{return JSON.parse(localStorage.getItem"
  );
}

// Found attic items should stay visible in their opened state, but become inactive.
// Replace the older behavior that removed found props from the scene.
const oldRemoveFound = "Object.keys(objects).forEach(function(k){const o=objects[k];if(foundItems().includes(o.itemId))return;const done=!!searched[o.id];const el=document.createElement('div');";
const keepFound = "Object.keys(objects).forEach(function(k){const o=objects[k];const alreadyFound=foundItems().includes(o.itemId);const done=!!searched[o.id]||alreadyFound;const el=document.createElement('div');";
if (html.includes(oldRemoveFound)) html = html.replace(oldRemoveFound, keepFound);

const oldBaseRender = "Object.keys(objects).forEach(function(k){const o=objects[k];const done=!!searched[o.id];const el=document.createElement('div');";
if (html.includes(oldBaseRender)) html = html.replace(oldBaseRender, keepFound);

// Disable click handlers on opened/found props.
const oldClickAttach = "el.addEventListener('click',function(e){e.stopPropagation();rummage(o.id,el);});root.appendChild(el);";
const newClickAttach = "if(!done)el.addEventListener('click',function(e){e.stopPropagation();rummage(o.id,el);});else el.style.pointerEvents='none';root.appendChild(el);";
if (html.includes(oldClickAttach)) html = html.replace(oldClickAttach, newClickAttach);

// Discovery pickup should show the archive item type, not the specific item title.
const showPickupTitle = "p.innerHTML='<img src=\"'+o.thumb+'\" alt=\"\"><b>'+o.itemTitle+'</b><span>Take</span>';";
const showPickupType = "p.innerHTML='<img src=\"'+o.thumb+'\" alt=\"\"><b>'+atticItemType(o)+'</b><span>Take</span>';";
if (html.includes(showPickupTitle)) html = html.replace(showPickupTitle, showPickupType);

const findTitleWhisper = "whisper('You find '+o.itemTitle+'.');";
const findTypeWhisper = "whisper('Found: '+atticItemType(o)+'.');";
if (html.includes(findTitleWhisper)) html = html.replace(findTitleWhisper, findTypeWhisper);

// If the player takes an item, immediately re-render props so it remains as its opened, inactive sprite.
// Also arm the Archives tutorial hint for the return to the table, but only the first time.
const takeNeedle = "saveFound(o.itemId);if(typeof renderInventory==='function')renderInventory();whisper('You take '+o.itemTitle+' back to the table.');";
const takeReplacement = "saveFound(o.itemId);try{if(!localStorage.getItem('tlr_tut_archives_after_attic'))localStorage.setItem('tlr_pending_archives_hint_after_attic','1')}catch(e){}renderObjects();if(typeof renderInventory==='function')renderInventory();whisper('You take the '+atticItemType(o)+' back to the table.');";
if (html.includes(takeNeedle)) {
  html = html.replace(takeNeedle, takeReplacement);
}

const takeNeedleRendered = "saveFound(o.itemId);renderObjects();if(typeof renderInventory==='function')renderInventory();whisper('You take '+o.itemTitle+' back to the table.');";
if (html.includes(takeNeedleRendered)) {
  html = html.replace(takeNeedleRendered, takeReplacement);
}
const takeNeedleOldPending = "saveFound(o.itemId);try{if(!localStorage.getItem('tlr_tut_inv_open'))localStorage.setItem('tlr_pending_archives_hint_after_attic','1')}catch(e){}renderObjects();if(typeof renderInventory==='function')renderInventory();whisper('You take the '+atticItemType(o)+' back to the table.');";
if (html.includes(takeNeedleOldPending)) {
  html = html.replace(takeNeedleOldPending, takeReplacement);
}

// Fire the Archives hint only after the attic return finishes, not during the initial table tutorial.
const leaveReturnNeedle = "setTimeout(function(){if(resetOnLeave&&typeof resetSession==='function'){resetOnLeave=false;resetSession();}document.body.classList.remove('mode-to-table');document.body.classList.add('mode-reading','mode-table-return');},720);";
const leaveReturnReplacement = "setTimeout(function(){if(resetOnLeave&&typeof resetSession==='function'){resetOnLeave=false;resetSession();}document.body.classList.remove('mode-to-table');document.body.classList.add('mode-reading','mode-table-return');setTimeout(showArchivesHintAfterAttic,520);},720);";
if (html.includes(leaveReturnNeedle)) html = html.replace(leaveReturnNeedle, leaveReturnReplacement);

fs.writeFileSync(file, html);
console.log('Applied attic state fixes.');
