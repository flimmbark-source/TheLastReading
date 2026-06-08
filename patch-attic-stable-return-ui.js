const fs = require('fs');
const file = 'index.html';
let html = fs.readFileSync(file, 'utf8');

const marker = '/* Attic stable return UI patch */';

if (!html.includes(marker)) {
  const css = `
${marker}
/* During the return from attic, the table should not slide or scale back into place.
   Hide the whole table UI while resetSession rebuilds it, then fade it back in at
   its final layout position. */
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
  transform:none!important;
  filter:none!important;
  transition:opacity .42s ease!important;
  will-change:opacity!important;
}
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
body.mode-to-table .actions{
  opacity:0!important;
  pointer-events:none!important;
}
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
  opacity:1!important;
}
body.mode-to-table .score-stack *,
body.mode-to-table .spread-wrap *,
body.mode-to-table .handDock *,
body.mode-table-return .score-stack *,
body.mode-table-return .spread-wrap *,
body.mode-table-return .handDock *{
  transform:none!important;
}
`;
  html = html.replace('</style>', css + '\n</style>');
}

fs.writeFileSync(file, html);
console.log('Applied attic stable return UI patch.');
