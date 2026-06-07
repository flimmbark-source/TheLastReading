const fs = require('fs');

const path = 'index.html';
let html = fs.readFileSync(path, 'utf8');
let changed = false;

function replaceOne(label, candidate, replacement) {
  if (html.includes(replacement)) {
    console.log(`${label} already applied.`);
    return false;
  }
  if (!html.includes(candidate)) {
    throw new Error(`${label}: could not find candidate to replace.`);
  }
  html = html.replace(candidate, replacement);
  changed = true;
  console.log(`Patched ${label}.`);
  return true;
}

function replaceAllOccurrences(label, candidate, replacement) {
  if (!html.includes(candidate)) {
    console.log(`${label} already applied (no more occurrences).`);
    return;
  }
  const before = html.split(candidate).length - 1;
  html = html.split(candidate).join(replacement);
  changed = true;
  console.log(`Patched ${label} (${before} replacement${before === 1 ? '' : 's'}).`);
}

// ── 1. Rename "Three/Four of a Rank" → "Three/Four of a Kind" everywhere ──
replaceAllOccurrences(
  '"of a Rank" → "of a Kind"',
  'of a Rank',
  'of a Kind'
);

// ── 2. Score sheet Full Court / Royal Court rename + condition ──
replaceOne(
  'Full Court score-sheet row',
  `['Full Court','3+ Courts, any suit',\`+${'${14+courtChips}'} / +${'${20+courtChips}'}\`,\`×${'${courtMult}'} / ×${'${+(courtMult+0.25).toFixed(2)}'}\`],`,
  `['Full Court (3+)','Consecutive Ranks',\`+${'${14+courtChips}'} / +${'${20+courtChips}'}\`,\`×${'${courtMult}'} / ×${'${+(courtMult+0.25).toFixed(2)}'}\`],`
);

replaceOne(
  'Royal Court score-sheet row',
  `['Royal Court','3+ Courts, same suit',\`+${'${20+courtChips}'} / +${'${28+courtChips}'}\`,\`×${'${courtMult}'} / ×${'${+(courtMult+0.25).toFixed(2)}'}\`],`,
  `['Royal Court (3+)','Consecutive Ranks, same suit',\`+${'${20+courtChips}'} / +${'${28+courtChips}'}\`,\`×${'${courtMult}'} / ×${'${+(courtMult+0.25).toFixed(2)}'}\`],`
);

// ── 3. Last tutorial step (currently threshold-pill) → spread ──
replaceOne(
  'last tutorial step target',
  `{sel:'.threshold-pill',arrow:'up',text:'Fill all 5 slots to complete a reading. Beat the <b>Threshold</b> to clear it. Fall short and the reading fails.'}`,
  `{sel:'#spread',arrow:'up',text:'Fill all 5 slots to complete a reading. Beat the <b>Threshold</b> to clear it. Fall short and the reading fails.'}`
);

// ── 4. Add "Replay Tutorial" button to settings panel + handler + style ──
const settingsHtmlOriginal = `      <label class="settings-check"><input type="checkbox" id="hintRelics" onchange="toggleHintSetting('relics',this.checked)">Relic hints</label>
    </div>`;
const settingsHtmlPatched = `      <label class="settings-check"><input type="checkbox" id="hintRelics" onchange="toggleHintSetting('relics',this.checked)">Relic hints</label>
      <hr>
      <button type="button" class="settings-action" onclick="replayTutorial()">Replay Tutorial</button>
    </div>`;
replaceOne(
  'settings panel "Replay Tutorial" button',
  settingsHtmlOriginal,
  settingsHtmlPatched
);

// Insert button CSS just after the existing settings-check rule.
const settingsCheckRule = `.settings-check input[type=checkbox]{accent-color:#c8a87a;width:14px;height:14px;cursor:pointer;flex:0 0 auto}`;
const settingsCheckRuleWithAction = `.settings-check input[type=checkbox]{accent-color:#c8a87a;width:14px;height:14px;cursor:pointer;flex:0 0 auto}
.settings-panel .settings-action{background:rgba(180,140,90,.18);border:1px solid rgba(180,140,90,.45);border-radius:6px;color:#e6c89a;font:600 .78rem system-ui,Segoe UI,sans-serif;letter-spacing:.04em;text-transform:uppercase;padding:7px 10px;cursor:pointer;width:100%;transition:background .15s,filter .15s}
.settings-panel .settings-action:hover{background:rgba(180,140,90,.3);filter:brightness(1.1)}`;
replaceOne(
  'settings-action button style',
  settingsCheckRule,
  settingsCheckRuleWithAction
);

// Insert replayTutorial() function near other tutorial helpers.
const tutSkipFn = `function tutSkip(){localStorage.setItem(TUT_KEY,'1');tutDone=true;tutHide()}`;
const tutSkipFnWithReplay = `function tutSkip(){localStorage.setItem(TUT_KEY,'1');tutDone=true;tutHide()}
function replayTutorial(){['tlr_tut_done','tlr_tut_relic','tlr_tut_shop','tlr_tut_inv_open','tlr_tut_inv_name','tlr_tut_inv_detail'].forEach(k=>localStorage.removeItem(k));tutDone=false;const p=document.getElementById('settingsPanel');if(p)p.classList.add('hidden');tutShow(0);}`;
replaceOne(
  'replayTutorial() helper',
  tutSkipFn,
  tutSkipFnWithReplay
);

if (changed) {
  fs.writeFileSync(path, html);
  console.log('Applied UI tweaks: tutorial replay, "of a Rank"→"of a Kind", court score-sheet rows, last tutorial target.');
} else {
  console.log('No UI tweak changes needed.');
}
