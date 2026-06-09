const fs = require('fs');
const file = 'index.html';
let html = fs.readFileSync(file, 'utf8');

const marker = '/* Attic tutorial copy cleanup patch */';
if (html.includes(marker)) {
  console.log('Attic tutorial copy cleanup patch already present, skipping.');
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

console.log('Attic tutorial/copy cleanup:');

// Remove the entry whisper. The attic transition itself already communicates the movement.
rep(
  "setTimeout(function(){document.body.classList.remove('mode-to-attic');document.body.classList.add('mode-attic');whisper('You get up from the table. Search freely, then return to the table.');},900);",
  "setTimeout(function(){document.body.classList.remove('mode-to-attic');document.body.classList.add('mode-attic');},900);",
  'Remove attic entry whisper after Obals copy'
);
rep(
  "setTimeout(function(){document.body.classList.remove('mode-to-attic');document.body.classList.add('mode-attic');whisper('You get up from the table. Spend Candlelight to search.');},900);",
  "setTimeout(function(){document.body.classList.remove('mode-to-attic');document.body.classList.add('mode-attic');},900);",
  'Remove attic entry whisper fallback'
);

// Finding and taking an item are already shown through the pickup card itself.
rep(
  "setTimeout(function(){renderObjects();showPickup(o);whisper('You find '+o.itemTitle+'.');},430);",
  "setTimeout(function(){renderObjects();showPickup(o);},430);",
  'Remove found-item whisper'
);
rep(
  "whisper('You take '+o.itemTitle+' back to the table.');",
  "",
  'Remove taken-item whisper'
);

// Replace the attic tutorial function so it matches the free-search + tabletop-return loop.
const fnMarker = '/* attic-tutorial-fns */';
const anchors = [
  '  window.tlrScoreToObals=candlesFromScore;',
  '  window.tlrScoreToCandlelight=candlesFromScore;'
];
const anchor = anchors.find(a => html.includes(a));
const tutFns = `${fnMarker}
  function showAtticTutorial(){
    try{if(localStorage.getItem('tlr_attic_tutored_obals'))return;}catch(e){}
    const t=document.getElementById('atticTutorial');if(!t)return;
    const isDesktop=window.matchMedia('(pointer:fine)').matches;
    const searchLine=isDesktop
      ?'<em>Click</em> glowing objects to search them.'
      :'<em>Tap</em> glowing objects to search them.';
    const lookLine=isDesktop
      ?'<p>Use the attic view to look around for anything that can be searched.</p>'
      :'<p>Swipe the attic view to look around for anything that can be searched.</p>';
    t.innerHTML='<div class="attic-tut-card"><h4>The Attic</h4><p>'+searchLine+' Actions here do not spend Obals.</p>'+lookLine+'</div>'
      +'<div class="attic-tut-card"><h4>Return to the Table</h4><p>When you are done, press the <em>Return to Table</em> tabletop button at the bottom of the screen.</p></div>'
      +'<button id="atticTutDismiss">I understand</button>';
    const btn=t.querySelector('#atticTutDismiss');
    if(btn)btn.addEventListener('click',function(e){e.stopPropagation();dismissAtticTutorial();});
    function _tutBlock(e){e.stopPropagation();e.preventDefault();dismissAtticTutorial();}
    t.addEventListener('click',_tutBlock);
    t.addEventListener('touchstart',_tutBlock,{passive:false});
    t.classList.add('show');
  }
  function dismissAtticTutorial(){
    const t=document.getElementById('atticTutorial');if(t){t.classList.remove('show');}
    try{localStorage.setItem('tlr_attic_tutored_obals','1');localStorage.setItem('tlr_attic_tutored','1');}catch(e){}
  }`;

if (anchor && html.includes(fnMarker)) {
  const markerIdx = html.indexOf(fnMarker);
  const anchorIdx = html.indexOf(anchor, markerIdx);
  if (anchorIdx > markerIdx) {
    html = html.slice(0, markerIdx) + tutFns + '\n    ' + html.slice(anchorIdx);
    console.log('  ✓ Updated attic tutorial copy/functions');
    changed++;
  } else {
    console.warn('  WARN: could not locate tutorial anchor after marker');
  }
} else {
  console.warn('  WARN: could not update attic tutorial function marker/anchor');
}

// Remove any remaining old tutorial phrases if another patch shape produced them.
html = html.split('spend a Candlelight and search it.').join('search it.');
html = html.split('spend a Obals and search it.').join('search it.');
html = html.split('Spend Candlelight to search.').join('Search freely, then return to the table.');
html = html.split('Spend Obals to search.').join('Search freely, then return to the table.');
html = html.split('The candle is almost gone.').join('');

html = html.replace('</style>', `${marker}\n</style>`);
fs.writeFileSync(file, html);
console.log(`Done — ${changed} attic tutorial/copy cleanup changes applied.`);
