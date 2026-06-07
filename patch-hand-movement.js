const fs = require('fs');

const path = 'index.html';
let html = fs.readFileSync(path, 'utf8');
let changed = false;

const handSwayCss = `/* ── Hand sway ── */
.hand{transform-origin:50% 140%;}
@keyframes card-wave{0%{translate:0 0px}100%{translate:0 5px}}
.hand .card.idle-wave:not(.sel):not(.ability-picked):not(.purge-picked){animation:card-wave 900ms ease-in-out 2 alternate}
/* ── Tactile feel ── */`;

const handSwayRE = /\/\* ── Hand sway ── \*\/[\s\S]*?\/\* ── Tactile feel ── \*\//;
if (handSwayRE.test(html)) {
  html = html.replace(handSwayRE, handSwayCss);
  changed = true;
  console.log('Patched hand movement CSS to use intermittent idle waves.');
} else if (!html.includes('.hand .card.idle-wave:not(.sel):not(.ability-picked):not(.purge-picked)')) {
  throw new Error('Could not find Hand sway CSS block to patch.');
}

const handMovementJs = `// intermittent hand movement patch
const HAND_IDLE_MIN_DELAY_MS=2000;
const HAND_IDLE_MAX_DELAY_MS=12000;
const HAND_IDLE_ANIM_MS=1800;
let _handIdleTimer=null;
function _scheduleHandIdleMove(){
  if(_handIdleTimer)clearTimeout(_handIdleTimer);
  const delay=HAND_IDLE_MIN_DELAY_MS+Math.random()*(HAND_IDLE_MAX_DELAY_MS-HAND_IDLE_MIN_DELAY_MS);
  _handIdleTimer=setTimeout(()=>{
    const canMove=typeof state!=='undefined'&&!state.busy&&!state.abilitySelect&&state.purgeSelect===null;
    if(!canMove){_scheduleHandIdleMove();return;}
    const cards=[...document.querySelectorAll('#hand .card:not(.sel):not(.ability-picked):not(.purge-picked)')];
    if(!cards.length){_scheduleHandIdleMove();return;}
    const card=cards[Math.floor(Math.random()*cards.length)];
    card.classList.remove('idle-wave');
    void card.offsetWidth;
    card.classList.add('idle-wave');
    setTimeout(()=>{
      card.classList.remove('idle-wave');
      _scheduleHandIdleMove();
    },HAND_IDLE_ANIM_MS);
  },delay);
}
document.addEventListener('pointerdown',()=>{if(!_handIdleTimer)_scheduleHandIdleMove();},{once:true});
// end intermittent hand movement patch`;

const handMovementRE = /\/\/ intermittent hand movement patch[\s\S]*?\/\/ end intermittent hand movement patch/;
if (handMovementRE.test(html)) {
  html = html.replace(handMovementRE, handMovementJs);
  changed = true;
  console.log('Refreshed intermittent hand movement JS patch.');
} else {
  const insertBefore = 'function breathVisuals(){';
  if (!html.includes(insertBefore)) throw new Error('Could not find breathVisuals insertion point.');
  html = html.replace(insertBefore, handMovementJs + '\n' + insertBefore);
  changed = true;
  console.log('Inserted intermittent hand movement JS patch.');
}

if (changed) {
  fs.writeFileSync(path, html);
  console.log('Patched hand movement timing to 2000ms–12000ms between animations.');
} else {
  console.log('No hand movement timing changes needed.');
}
