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

// Larger swipe strip: same bottom edge, more height upward.
html = html.replace('</style>', `
${marker}
#handSwipeZone.hand-swipe-zone{height:156px!important;bottom:197px!important}
@media(max-width:640px){#handSwipeZone.hand-swipe-zone{height:132px!important;bottom:152px!important}}
/* Do not cycle swipe-help text. Show one stable drift hint until an actual drift happens. */
#handSwipeZone .hand-swipe-hint{display:flex!important;align-items:center;justify-content:center;transform:translate(-50%,-50%)!important}
#handSwipeZone .swipe-hint-line{position:static!important;transform:none!important;animation:none!important;opacity:1!important}
#handSwipeZone .swipe-hint-line-2,#handSwipeZone .swipe-hint-line-3{display:none!important}
#settingsPanel .settings-action.get-up-action{margin-top:6px;background:rgba(194,148,75,.18);color:#ffd978;border-color:rgba(194,148,75,.7)}
</style>`);
changed++;

// Use a new localStorage key so old accidental dismissals do not keep the hint hidden.
html = html.split('tlr_hand_swiped').join('tlr_hand_drifted');
changed++;

// Add Get Up to the hamburger menu.
rep(
  '<button type="button" class="settings-action" onclick="replayTutorial()">Replay Tutorial</button>',
  '<button type="button" class="settings-action" onclick="replayTutorial()">Replay Tutorial</button><button type="button" class="settings-action get-up-action" onclick="getUpFromTable()">Get Up</button>',
  'Add Get Up button to settings menu'
);

// Expose Get Up as a small wrapper around the existing endSession result/attic path.
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

// The old handler dismissed the hint on pointerdown. Remove that block.
reg(
  /\n    if\(!window\.__handHasBeenSwiped\)\{\n      window\.__handHasBeenSwiped=true;\n      try\{localStorage\.setItem\('tlr_hand_drifted','1'\);\}catch\(e\)\{\}\n      const z2=zoneEl\(\);if\(z2\)\{z2\.classList\.add\('has-swiped'\);z2\.classList\.remove\('has-overflow'\);\}\n    \}/,
  '',
  'Do not dismiss swipe hint at gesture start'
);

// Add a helper and dismiss only after actual horizontal drift.
rep(
  `const stepSlide=ev=>{
    const dx=ev.clientX-startX;
    const dy=(ev.clientY||startY)-startY;
    const target=softClamp(startOffset+dx*DEG_PER_PX_SWIPE);`,
  `const markHandDrifted=()=>{
    if(window.__handHasBeenSwiped)return;
    window.__handHasBeenSwiped=true;
    try{localStorage.setItem('tlr_hand_drifted','1');}catch(e){}
    const z2=zoneEl();if(z2){z2.classList.add('has-swiped');z2.classList.remove('has-overflow');}
  };
  const stepSlide=ev=>{
    const dx=ev.clientX-startX;
    const dy=(ev.clientY||startY)-startY;
    const target=softClamp(startOffset+dx*DEG_PER_PX_SWIPE);
    if(Math.abs(target-startOffset)>1.15)markHandDrifted();`,
  'Dismiss swipe hint only after actual horizontal drift'
);

// Horizontal wheel/trackpad drift also counts as actual drift.
rep(
  `const markHandScrolled=()=>{
      if(window.__handHasBeenSwiped)return;
      window.__handHasBeenSwiped=true;
      try{localStorage.setItem('tlr_hand_drifted','1');}catch(e){}
      const z2=zoneEl();if(z2){z2.classList.add('has-swiped');z2.classList.remove('has-overflow');}
    };`,
  `const markHandScrolled=()=>{
      if(window.__handHasBeenSwiped)return;
      window.__handHasBeenSwiped=true;
      try{localStorage.setItem('tlr_hand_drifted','1');}catch(e){}
      const z2=zoneEl();if(z2){z2.classList.add('has-swiped');z2.classList.remove('has-overflow');}
    };`,
  'Keep horizontal wheel/trackpad drift as a real dismissal path'
);

fs.writeFileSync(file, html);
console.log(`Done — ${changed} get-up/swipe-hint changes applied.`);
