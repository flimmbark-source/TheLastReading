const fs = require('fs');
const file = 'index.html';
let html = fs.readFileSync(file, 'utf8');

const marker = '/* Attic obals free-actions patch */';
if (html.includes(marker)) {
  console.log('Attic obals/free-actions patch already present, skipping.');
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

console.log('Attic obals/free-actions patch:');

// Visual layer: Obals HUD plus a bottom tabletop return control.
html = html.replace('</style>', `
${marker}
#atticScene #candlelightHud{left:14px;top:12px;min-width:108px;justify-content:center;gap:8px;padding:8px 13px;border-color:rgba(198,150,77,.7);background:rgba(17,10,5,.68);box-shadow:0 10px 28px rgba(0,0,0,.48),0 0 18px rgba(220,166,75,.12)}
#atticScene #candlelightHud::before{content:'⚱';font-size:20px;line-height:1;color:#ffd978;text-shadow:0 0 12px rgba(255,205,105,.32)}
#atticScene #candlelightHud .candlelight-icon{display:none!important}
.attic-obal-label{font:800 10px system-ui,sans-serif;letter-spacing:.12em;text-transform:uppercase;color:#b99a5d}
.attic-obal-count{font:900 18px Georgia,serif;color:#ffd978;text-shadow:0 2px 8px rgba(0,0,0,.85);font-variant-numeric:tabular-nums}
#atticTableReturn{position:absolute;left:50%;bottom:-10px;z-index:28;width:min(84vw,560px);height:76px;transform:translateX(-50%);border:1px solid rgba(117,70,33,.9);border-bottom:0;border-radius:52% 52% 0 0/78% 78% 0 0;background:radial-gradient(ellipse at center top,rgba(139,83,42,.96),rgba(73,38,18,.98) 62%,rgba(28,14,8,1));box-shadow:0 -9px 30px rgba(0,0,0,.62),inset 0 8px 18px rgba(255,196,105,.12),inset 0 -14px 22px rgba(0,0,0,.42);color:#f3d79a;cursor:pointer;font:900 11px system-ui,sans-serif;letter-spacing:.16em;text-transform:uppercase;text-shadow:0 2px 8px rgba(0,0,0,.9);-webkit-tap-highlight-color:transparent;outline:none;appearance:none;-webkit-appearance:none;user-select:none;touch-action:manipulation}
#atticTableReturn::before{content:'';position:absolute;left:8%;right:8%;top:14px;height:1px;background:linear-gradient(90deg,transparent,rgba(255,210,130,.34),transparent)}
#atticTableReturn span{position:relative;top:-4px}
#atticTableReturn:hover,#atticTableReturn:active{filter:brightness(1.08);background:radial-gradient(ellipse at center top,rgba(139,83,42,.96),rgba(73,38,18,.98) 62%,rgba(28,14,8,1))}
#atticTableReturn:focus,#atticTableReturn:focus-visible{outline:none;background:radial-gradient(ellipse at center top,rgba(139,83,42,.96),rgba(73,38,18,.98) 62%,rgba(28,14,8,1))}
</style>`);
changed++;

// Add the tabletop return button to the attic scene DOM.
if (!html.includes('id="atticTableReturn"')) {
  rep('<div id="atticWhisper"></div></div>', '<button id="atticTableReturn" type="button" aria-label="Return to the table"><span>Return to Table</span></button><div id="atticWhisper"></div></div>', 'Inserted tabletop return button');
} else {
  console.log('  • tabletop return button already present');
}

// HUD still uses the old id internally, but it now displays Obals instead of spendable candles.
reg(/function renderCandles\(\)\{const h=document\.getElementById\('candlelightHud'\);if\(!h\)return;let out='';const n=Math\.max\(1,maxCandles\|\|candleCount\|\|1\);for\(let i=0;i<n;i\+\+\)out\+='<span class="candlelight-icon '\+\(i<candleCount\?'on':'off'\)\+'"><\/span>';h\.innerHTML=out;\}/, "function renderCandles(){const h=document.getElementById('candlelightHud');if(!h)return;h.innerHTML='<span class=\"attic-obal-label\">Obals</span><b class=\"attic-obal-count\">'+candleCount+'</b>';}", 'Render Obals HUD');

// Searches are no longer paid actions. Obals are kept for later gates/locks.
rep("if(candleCount<o.cost){whisper('The candle is almost gone.');return;}\n    ", '', 'Remove not-enough-candlelight blocker');
rep('dismissAtticTutorial();candleCount-=o.cost;searched[id]=true;renderCandles();', 'dismissAtticTutorial();searched[id]=true;renderCandles();', 'Do not spend Obals when rummaging');
rep('candleCount-=o.cost;searched[id]=true;renderCandles();', 'searched[id]=true;renderCandles();', 'Do not spend Obals when rummaging fallback');
rep('renderCandles();candleSpend();tagNear(el,o.verb);', 'renderCandles();tagNear(el,o.verb);', 'Remove candle spend flash from rummage');
rep("t.textContent=text+' -1';", 't.textContent=text;', 'Remove -1 cost tag');
rep(";if(candleCount<=0)setTimeout(leave,900);", ';', 'Do not auto-return after pickup');

// The player now returns by pressing the tabletop button, not by clicking the attic background.
rep("window.addEventListener('DOMContentLoaded',function(){const scene=document.getElementById('atticScene');if(scene)scene.addEventListener('click',function(){if(inAttic&&!awaitingPickup)leave();});});", "window.addEventListener('DOMContentLoaded',function(){const btn=document.getElementById('atticTableReturn');if(btn)btn.addEventListener('click',function(e){e.stopPropagation();leave();});});", 'Return via tabletop button instead of background click');

// User-facing language: Candlelight becomes Obals and the attic prompt no longer describes spending searches.
html = html.split('Candlelight').join('Obals');
html = html.split('candlelight').join('obals');
html = html.split('Spend Obals to search.').join('Search freely, then return to the table.');
html = html.split('spend a Obals and search it.').join('search it.');
html = html.split('You have <em>\'+candleCount+\'</em> candle\'+(candleCount===1?\'\':\'s\')+\' — each search costs one. When they run out, you return to the table.').join('You have <em>\'+candleCount+\'</em> Obals. Search as much as you like, then return to the table when you are done.');
changed++;

fs.writeFileSync(file, html);
console.log(`Done — ${changed} attic obals/free-actions changes applied.`);
