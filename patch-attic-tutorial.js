const fs = require('fs');
const file = 'index.html';
let html = fs.readFileSync(file, 'utf8');

const cssMarker = '/* Attic tutorial callout patch */';
const fnMarker = '/* attic-tutorial-fns */';

// ── CSS block ──────────────────────────────────────────────────────────────
if (!html.includes(cssMarker)) {
  const css = `
${cssMarker}
#atticTutorial{position:absolute;inset:0;z-index:30;display:flex;flex-direction:column;justify-content:flex-end;align-items:center;padding:0 0 120px;pointer-events:none;opacity:0;transition:opacity .45s ease}
#atticTutorial.show{opacity:1;pointer-events:auto}
.attic-tut-card{background:rgba(14,8,4,.90);border:1px solid rgba(194,148,75,.6);border-radius:12px;padding:18px 24px;max-width:min(86vw,420px);width:100%;box-shadow:0 18px 52px rgba(0,0,0,.72),0 0 24px rgba(255,196,80,.12);text-align:center;margin-bottom:14px}
.attic-tut-card h4{margin:0 0 8px;font:700 15px Georgia,serif;color:#ffd978;text-shadow:0 2px 8px rgba(0,0,0,.8);letter-spacing:.02em}
.attic-tut-card p{margin:0;font:400 13px Georgia,serif;color:#c8ae82;line-height:1.55}
.attic-tut-card em{color:#ffd978;font-style:normal;font-weight:700}
#atticTutDismiss{margin-top:6px;padding:11px 36px;border:1px solid rgba(194,148,75,.7);border-radius:999px;background:rgba(194,148,75,.18);color:#ffd978;font:700 11px system-ui,sans-serif;letter-spacing:.1em;text-transform:uppercase;cursor:pointer;box-shadow:0 6px 20px rgba(0,0,0,.5);transition:background .18s ease}
#atticTutDismiss:hover,#atticTutDismiss:active{background:rgba(194,148,75,.32)}
`;
  html = html.replace('</style>', css + '\n</style>');
  console.log('Injected attic tutorial CSS.');
} else {
  console.log('Attic tutorial CSS already present.');
}

// ── DOM: #atticTutorial element ────────────────────────────────────────────
const sceneOld = '<div id="atticScene" aria-hidden="true"><div id="atticPan">';
const sceneNew = '<div id="atticScene" aria-hidden="true"><div id="atticTutorial"></div><div id="atticPan">';
if (html.includes(sceneOld)) {
  html = html.replace(sceneOld, sceneNew);
  console.log('Injected #atticTutorial DOM element.');
} else if (html.includes(sceneNew)) {
  console.log('#atticTutorial DOM element already present.');
} else {
  console.warn('WARN: could not inject #atticTutorial into atticScene HTML');
}

// ── enter(): add single setTimeout for tutorial ────────────────────────────
const enterEnd = `    setTimeout(function(){document.body.classList.remove('mode-to-attic');document.body.classList.add('mode-attic');whisper('You get up from the table. Spend Candlelight to search.');},900);`;
const enterEndNew = enterEnd + `
    setTimeout(function(){showAtticTutorial();},1400);`;
if (html.includes(enterEndNew)) {
  console.log('enter() tutorial hook already present.');
} else if (html.includes(enterEnd)) {
  html = html.replace(enterEnd, enterEndNew);
  console.log('Hooked showAtticTutorial into enter().');
} else {
  console.warn('WARN: could not find enter() setTimeout to hook tutorial call');
}

// ── rummage(): dismiss tutorial on prop search ─────────────────────────────
const rummageCore = `candleCount-=o.cost;searched[id]=true;renderCandles();`;
const rummageCoreNew = `dismissAtticTutorial();candleCount-=o.cost;searched[id]=true;renderCandles();`;
if (html.includes(rummageCoreNew)) {
  console.log('rummage() dismiss hook already present.');
} else if (html.includes(rummageCore)) {
  html = html.replace(rummageCore, rummageCoreNew);
  console.log('Hooked dismissAtticTutorial into rummage().');
} else {
  console.warn('WARN: could not find rummage() core to hook dismiss');
}

// ── JS functions: upsert with fn marker so they survive re-runs ────────────
const tutFns = `${fnMarker}
  function showAtticTutorial(){
    try{if(localStorage.getItem('tlr_attic_tutored'))return;}catch(e){}
    const t=document.getElementById('atticTutorial');if(!t)return;
    const isDesktop=window.matchMedia('(pointer:fine)').matches;
    const searchLine=isDesktop
      ?'<em>Click</em> a glowing object to spend a Candlelight and search it.'
      :'<em>Tap</em> a glowing object to spend a Candlelight and search it.';
    const scrollLine=isDesktop
      ?'<p>Use the <em>hand area scroll wheel</em> to spread or constrict your cards.</p>'
      :'';
    t.innerHTML='<div class="attic-tut-card"><h4>The Attic</h4><p>'+searchLine+'</p>'+scrollLine+'</div>'
      +'<div class="attic-tut-card"><h4>Candlelight</h4><p>You have <em>'+candleCount+'</em> candle'+(candleCount===1?'':'s')+' — each search costs one. When they run out, you return to the table.</p></div>'
      +'<button id="atticTutDismiss">I understand</button>';
    const btn=t.querySelector('#atticTutDismiss');
    if(btn)btn.addEventListener('click',function(e){e.stopPropagation();dismissAtticTutorial();});
    t.addEventListener('click',function(){dismissAtticTutorial();});
    t.classList.add('show');
  }
  function dismissAtticTutorial(){
    const t=document.getElementById('atticTutorial');if(t){t.classList.remove('show');}
    try{localStorage.setItem('tlr_attic_tutored','1');}catch(e){}
  }`;

const anchor = `  window.tlrScoreToCandlelight=candlesFromScore;`;

if (html.includes(fnMarker)) {
  // Update in-place: replace from marker to just before anchor
  const markerIdx = html.indexOf(fnMarker);
  const anchorIdx = html.indexOf(anchor, markerIdx);
  if (anchorIdx > markerIdx) {
    html = html.slice(0, markerIdx) + tutFns + '\n    ' + html.slice(anchorIdx);
    console.log('Updated showAtticTutorial/dismissAtticTutorial functions.');
  }
} else if (html.includes(anchor)) {
  html = html.replace(anchor, tutFns + '\n    ' + anchor);
  console.log('Injected showAtticTutorial/dismissAtticTutorial functions.');
} else {
  console.warn('WARN: could not inject showAtticTutorial function');
}

fs.writeFileSync(file, html);
console.log('Attic tutorial patch complete.');
