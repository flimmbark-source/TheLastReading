const fs = require('fs');
const file = 'index.html';
let html = fs.readFileSync(file, 'utf8');
let changed = 0;

function rep(old, next, label) {
  if (html.includes(next)) { console.log('  already applied:', label); return; }
  if (!html.includes(old)) { console.warn('  WARN not found:', label); return; }
  html = html.replace(old, next);
  changed++;
  console.log('  ✓', label);
}

// 1. In _doAcquireRelic: set flag instead of calling tutShow immediately
rep(
  `if(firstRelic){localStorage.setItem('tlr_tut_relic','1');afterFn();setTimeout(()=>tutShow(9),400);}
  else{afterFn();}`,
  `if(firstRelic){localStorage.setItem('tlr_tut_relic','1');window._pendingRelicTut=true;}
  afterFn();`,
  '_doAcquireRelic: defer tutShow(9) until shop close'
);

// 2. In selectRelicReplace: same deferral
rep(
  `if(firstRelic){localStorage.setItem('tlr_tut_relic','1');afterFn();setTimeout(()=>tutShow(9),400);}
    else{afterFn();}`,
  `if(firstRelic){localStorage.setItem('tlr_tut_relic','1');window._pendingRelicTut=true;}
    afterFn();`,
  'selectRelicReplace: defer tutShow(9) until shop close'
);

// 3. continueReading: fire pending relic tutorial when leaving the shop
rep(
  `function continueReading(){_packBuys={};const firstShop=!localStorage.getItem('tlr_tut_shop');state.reading++;startReading();if(firstShop){localStorage.setItem('tlr_tut_shop','1');setTimeout(()=>tutShow(8),400)}}`,
  `function continueReading(){_packBuys={};const firstShop=!localStorage.getItem('tlr_tut_shop');const pendingRelic=window._pendingRelicTut;window._pendingRelicTut=false;state.reading++;startReading();if(firstShop){localStorage.setItem('tlr_tut_shop','1');setTimeout(()=>tutShow(8),400)}else if(pendingRelic){setTimeout(()=>tutShow(9),400)}}`,
  'continueReading: show relic tutorial after leaving shop'
);

fs.writeFileSync(file, html);
console.log(`Done — ${changed} replacements applied.`);
