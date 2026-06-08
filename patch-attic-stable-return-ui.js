const fs = require('fs');
const file = 'index.html';
let html = fs.readFileSync(file, 'utf8');

// Remove the previous return UI patch if it was already applied to a local build.
// That older patch forced transforms off on children, which breaks card/spread layout.
html = html.replace(/\/\* Attic stable return UI patch \*\/[\s\S]*?(?=\n<\/style>)/, '');

const marker = '/* Attic stable return UI patch v2 */';

if (!html.includes(marker)) {
  const css = `
${marker}
/* Do not animate the table UI during attic return. Keep it fully hidden while
   resetSession rebuilds the reading, then reveal it only after the attic overlay
   has finished fading. This prevents the pills/spread/hand from visibly reflowing. */
body.mode-return-hard-hide #titleWrap,
body.mode-return-hard-hide .score-stack,
body.mode-return-hard-hide .spread-wrap,
body.mode-return-hard-hide .handDock,
body.mode-return-hard-hide #handSwipeZone,
body.mode-return-hard-hide #relicRack,
body.mode-return-hard-hide .refs-layer,
body.mode-return-hard-hide .ability-prompt,
body.mode-return-hard-hide #abilityPrompt,
body.mode-return-hard-hide #purgePrompt,
body.mode-return-hard-hide .actions,
body.mode-to-table #titleWrap,
body.mode-to-table .score-stack,
body.mode-to-table .spread-wrap,
body.mode-to-table .handDock,
body.mode-to-table #handSwipeZone,
body.mode-to-table #relicRack,
body.mode-to-table .refs-layer,
body.mode-to-table .ability-prompt,
body.mode-to-table #abilityPrompt,
body.mode-to-table #purgePrompt,
body.mode-to-table .actions,
body.mode-table-return #titleWrap,
body.mode-table-return .score-stack,
body.mode-table-return .spread-wrap,
body.mode-table-return .handDock,
body.mode-table-return #handSwipeZone,
body.mode-table-return #relicRack,
body.mode-table-return .refs-layer,
body.mode-table-return .ability-prompt,
body.mode-table-return #abilityPrompt,
body.mode-table-return #purgePrompt,
body.mode-table-return .actions{
  opacity:0!important;
  transform:none!important;
  filter:none!important;
  transition:none!important;
  pointer-events:none!important;
  will-change:auto!important;
}
body.mode-return-hard-hide #invWrap,
body.mode-to-table #invWrap,
body.mode-table-return #invWrap{
  transform:translateY(calc(-1 * var(--inv-h)))!important;
  pointer-events:none!important;
}
`;
  html = html.replace('</style>', css + '\n</style>');
}

// Replace the old leave transition so the table is never partially visible while it resets.
const oldLeave = "function leave(){\n    if(window.tlrCloseArchives)window.tlrCloseArchives();\n    if(!inAttic)return;inAttic=false;document.querySelectorAll('#atticPickup,.attic-action-tag,.attic-dust').forEach(function(p){p.remove();});\n    document.body.classList.remove('mode-attic','mode-to-attic','mode-reading');document.body.classList.add('mode-to-table');\n    const scene=document.getElementById('atticScene');if(scene)scene.setAttribute('aria-hidden','true');\n    setTimeout(function(){if(resetOnLeave&&typeof resetSession==='function'){resetOnLeave=false;resetSession();}document.body.classList.remove('mode-to-table');document.body.classList.add('mode-reading','mode-table-return');},720);\n    setTimeout(function(){document.body.classList.remove('mode-table-return');},1650);\n  }";
const newLeave = "function leave(){\n    if(window.tlrCloseArchives)window.tlrCloseArchives();\n    if(!inAttic)return;inAttic=false;document.querySelectorAll('#atticPickup,.attic-action-tag,.attic-dust').forEach(function(p){p.remove();});\n    document.body.classList.add('mode-return-hard-hide');\n    if(resetOnLeave&&typeof resetSession==='function'){resetOnLeave=false;resetSession();}\n    setTimeout(function(){document.body.classList.remove('mode-attic','mode-to-attic','mode-reading');document.body.classList.add('mode-to-table');const scene=document.getElementById('atticScene');if(scene)scene.setAttribute('aria-hidden','true');},60);\n    setTimeout(function(){document.body.classList.remove('mode-to-table','mode-table-return','mode-return-hard-hide');document.body.classList.add('mode-reading');},1080);\n  }";
if (html.includes(oldLeave)) {
  html = html.replace(oldLeave, newLeave);
}

fs.writeFileSync(file, html);
console.log('Applied attic stable return UI patch v2.');
