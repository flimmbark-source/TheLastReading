const fs = require('fs');
const file = 'index.html';
let html = fs.readFileSync(file, 'utf8');

const marker = '/* Get up and swipe hint patch */';
if (html.includes(marker)) {
  console.log('Get up/swipe hint patch already present, skipping.');
  process.exit(0);
}

let changed = 0;
function rep(oldText, newText, label) {
  if (html.includes(oldText)) {
    html = html.replace(oldText, newText);
    console.log('  ✓', label);
    changed++;
  } else {
    console.warn('  WARN: not found —', label);
  }
}
function reg(pattern, newText, label) {
  if (pattern.test(html)) {
    html = html.replace(pattern, newText);
    console.log('  ✓', label);
    changed++;
  } else {
    console.warn('  WARN: not found —', label);
  }
}

console.log('Get up/swipe hint patch:');

// Larger swipe strip, but pulled back down from the first oversized version.
html = html.replace('</style>', `
${marker}
#handSwipeZone.hand-swipe-zone{height:121px!important;bottom:197px!important}
@media(max-width:640px){#handSwipeZone.hand-swipe-zone{height:97px!important;bottom:152px!important}}
/* Show one swipe-help step at a time. Each one advances only after its matching gesture. */
#handSwipeZone .hand-swipe-hint{display:flex!important;align-items:center;justify-content:center;transform:translate(-50%,-50%)!important}
#handSwipeZone .swipe-hint-line{position:static!important;transform:none!important;animation:none!important;opacity:1!important;display:none!important}
#handSwipeZone[data-hint-step="1"] .swipe-hint-line-1,#handSwipeZone[data-hint-step="2"] .swipe-hint-line-2,#handSwipeZone[data-hint-step="3"] .swipe-hint-line-3{display:flex!important}
#handSwipeZone.hints-complete .hand-swipe-hint{display:none!important}
#settingsPanel .settings-action.get-up-action{margin-top:6px;background:rgba(194,148,75,.18);color:#ffd978;border-color:rgba(194,148,75,.7)}
</style>`);
changed++;

// Replace the old single-dismiss key with staged hint progress.
rep(
  "try{if(localStorage.getItem('tlr_hand_swiped'))window.__handHasBeenSwiped=true;}catch(e){}",
  "try{window.__handHintStep=Number(localStorage.getItem('tlr_hand_hint_step')||'1');if(window.__handHintStep>=4)window.__handHasBeenSwiped=true;}catch(e){window.__handHintStep=1;}",
  'Initialize staged swipe hints'
);
html = html.split('tlr_hand_swiped').join('tlr_hand_hint_step');
changed++;

// Add Get Up to the hamburger menu, exactly once.
html = html.replace(/<button type="button" class="settings-action get-up-action" onclick="getUpFromTable\(\)">Get Up<\/button>/g, '');
changed++;
rep(
  '<button type="button" class="settings-action" onclick="replayTutorial()">Replay Tutorial</button>',
  '<button type="button" class="settings-action" onclick="replayTutorial()">Replay Tutorial</button><button type="button" class="settings-action get-up-action" onclick="getUpFromTable()">Get Up</button>',
  'Add exactly one Get Up button to settings menu'
);

// Expose Get Up as a small wrapper around the existing endSession result/attic path.
if (!html.includes('function getUpFromTable(){')) {
  rep(
    'function startReading(){\n  if(window.tlrCloseArchives)window.tlrCloseArchives();',
    `function getUpFromTable(){
  if(state&&state.busy)return;
  if(window.tlrCloseArchives)window.tlrCloseArchives();
  const panel=document.getElementById('settingsPanel');if(panel)panel.classList.add('hidden');
  if(typeof endSession==='function')endSession();
}
function startReading(){
  if(window.tlrCloseArchives)window.tlrCloseArchives();`,
    'Add getUpFromTable() wrapper'
  );
} else {
  console.log('  • getUpFromTable() wrapper already present');
}

// Keep the hint visible until all three gestures have been completed.
rep(
  `const updateOverflowHint=()=>{const z=zoneEl();if(!z)return;if(window.__handHasBeenSwiped){z.classList.remove('has-overflow');return;}z.classList.toggle('has-overflow',slideCap()>1);};`,
  `const updateOverflowHint=()=>{const z=zoneEl();if(!z)return;const step=window.__handHintStep||1;z.dataset.hintStep=String(Math.max(1,Math.min(3,step)));if(window.__handHasBeenSwiped||step>=4){z.classList.add('hints-complete');z.classList.remove('has-overflow');return;}z.classList.remove('hints-complete','has-swiped');z.classList.toggle('has-overflow',slideCap()>1);};`,
  'Make overflow hint stage-aware'
);

// The old handler dismissed the hint on pointerdown. Remove that block.
reg(
  /\n    if\(!window\.__handHasBeenSwiped\)\{\n      window\.__handHasBeenSwiped=true;\n      try\{localStorage\.setItem\('tlr_hand_hint_step','1'\);\}catch\(e\)\{\}\n      const z2=zoneEl\(\);if\(z2\)\{z2\.classList\.add\('has-swiped'\);z2\.classList\.remove\('has-overflow'\);\}\n    \}/,
  '',
  'Do not dismiss swipe hint at gesture start'
);

// Shared hint progression helper: step 1 = drift, step 2 = constrict, step 3 = expand.
rep(
  `const stepSlide=ev=>{
    const dx=ev.clientX-startX;
    const dy=(ev.clientY||startY)-startY;
    const target=softClamp(startOffset+dx*DEG_PER_PX_SWIPE);`,
  `const completeHandHintStep=expected=>{
    const cur=window.__handHintStep||1;
    if(cur!==expected||window.__handHasBeenSwiped)return;
    const next=expected+1;
    window.__handHintStep=next;
    try{localStorage.setItem('tlr_hand_hint_step',String(next));}catch(e){}
    const z2=zoneEl();
    if(next>=4){window.__handHasBeenSwiped=true;if(z2){z2.classList.add('has-swiped','hints-complete');z2.classList.remove('has-overflow');}}
    else if(z2){z2.dataset.hintStep=String(next);z2.classList.remove('has-swiped','hints-complete');updateOverflowHint();}
  };
  const stepSlide=ev=>{
    const dx=ev.clientX-startX;
    const dy=(ev.clientY||startY)-startY;
    const target=softClamp(startOffset+dx*DEG_PER_PX_SWIPE);
    if(Math.abs(target-startOffset)>1.15)completeHandHintStep(1);`,
  'Advance first hint only after actual horizontal drift'
);

// Pinch inward dismisses the constrict hint; pull outward dismisses the expand hint.
rep(
  `manualSpacing=next;
    cachedCap=null;
    applySpacing(next);
    applyOffset(clampOffset(offset));`,
  `if(next<pinchStart.spacing-.15)completeHandHintStep(2);
    if(next>pinchStart.spacing+.15)completeHandHintStep(3);
    manualSpacing=next;
    cachedCap=null;
    applySpacing(next);
    applyOffset(clampOffset(offset));`,
  'Advance pinch hints only after matching pinch gesture'
);

// Horizontal wheel/trackpad drift counts as the first hint. Vertical scroll advances constrict/expand hints.
rep(
  `const markHandScrolled=()=>{
      if(window.__handHasBeenSwiped)return;
      window.__handHasBeenSwiped=true;
      try{localStorage.setItem('tlr_hand_hint_step','1');}catch(e){}
      const z2=zoneEl();if(z2){z2.classList.add('has-swiped');z2.classList.remove('has-overflow');}
    };`,
  `const markHandScrolled=()=>{completeHandHintStep(1);};`,
  'Horizontal scroll drift advances first hint'
);
rep(
  `if(pendingSpacingDelta){
        const delta=pendingSpacingDelta;pendingSpacingDelta=0;
        // deltaY > 0 = scroll down = constrict (reduce spacing)`,
  `if(pendingSpacingDelta){
        const delta=pendingSpacingDelta;pendingSpacingDelta=0;
        if(delta>0)completeHandHintStep(2);
        if(delta<0)completeHandHintStep(3);
        // deltaY > 0 = scroll down = constrict (reduce spacing)`,
  'Vertical scroll advances constrict/expand hints only on matching direction'
);

fs.writeFileSync(file, html);
console.log(`Done — ${changed} get-up/swipe-hint changes applied.`);
