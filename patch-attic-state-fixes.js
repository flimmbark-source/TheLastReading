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

// Add a tiny helper for found attic items.
const helperNeedle = "  function candlesFromScore(score){if(score>=1000)return 7;";
const helperReplacement = "  function foundItems(){try{return JSON.parse(localStorage.getItem('tlr_attic_found_items')||'[]')}catch(e){return []}}\n  function candlesFromScore(score){if(score>=1000)return 7;";
if (html.includes(helperNeedle) && !html.includes('function foundItems(){try{return JSON.parse(localStorage.getItem')) {
  html = html.replace(helperNeedle, helperReplacement);
}

// Once an attic item has been found, its associated rummage prop should no longer appear.
const renderNeedle = "Object.keys(objects).forEach(function(k){const o=objects[k];const done=!!searched[o.id];const el=document.createElement('div');";
const renderReplacement = "Object.keys(objects).forEach(function(k){const o=objects[k];if(foundItems().includes(o.itemId))return;const done=!!searched[o.id];const el=document.createElement('div');";
if (html.includes(renderNeedle)) {
  html = html.replace(renderNeedle, renderReplacement);
}

// If the player takes an item, immediately re-render props so that prop vanishes from the scene.
const takeNeedle = "saveFound(o.itemId);if(typeof renderInventory==='function')renderInventory();whisper('You take '+o.itemTitle+' back to the table.');";
const takeReplacement = "saveFound(o.itemId);renderObjects();if(typeof renderInventory==='function')renderInventory();whisper('You take '+o.itemTitle+' back to the table.');";
if (html.includes(takeNeedle)) {
  html = html.replace(takeNeedle, takeReplacement);
}

fs.writeFileSync(file, html);
console.log('Applied attic state fixes.');
