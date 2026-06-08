const fs = require('fs');
const file = 'index.html';
let html = fs.readFileSync(file, 'utf8');

const marker = '/* Attic stable return UI patch */';

if (!html.includes(marker)) {
  const css = `
${marker}
/* During the return from attic, do not slide/scale the table HUD. Fade it only.
   The moving transform made the small pill counters appear to drift around. */
body.mode-to-table #titleWrap,
body.mode-to-table .score-stack,
body.mode-to-table #relicRack,
body.mode-to-table .refs-layer,
body.mode-table-return #titleWrap,
body.mode-table-return .score-stack,
body.mode-table-return #relicRack,
body.mode-table-return .refs-layer{
  transform:none!important;
  filter:none!important;
  transition:opacity .55s ease!important;
  will-change:opacity!important;
}
body.mode-to-table #titleWrap,
body.mode-to-table .score-stack,
body.mode-to-table #relicRack,
body.mode-to-table .refs-layer{
  opacity:0!important;
  pointer-events:none!important;
}
body.mode-table-return #titleWrap,
body.mode-table-return .score-stack,
body.mode-table-return #relicRack,
body.mode-table-return .refs-layer{
  opacity:1!important;
}
/* Keep the play area and hand allowed to animate separately, but prevent the top pills from inheriting return movement. */
body.mode-to-table .score-stack *,
body.mode-table-return .score-stack *{
  transform:none!important;
}
`;
  html = html.replace('</style>', css + '\n</style>');
}

fs.writeFileSync(file, html);
console.log('Applied attic stable return UI patch.');
