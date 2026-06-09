const fs = require('fs');
const file = 'index.html';
let html = fs.readFileSync(file, 'utf8');

const marker = '/* Pill mobile spread patch */';
// Strip any previous version of this block before reinserting
html = html.replace(/\/\* Pill mobile spread patch \*\/[\s\S]*?(?=\n<\/style>)/,'');
if (!html.includes(marker)) {
  // Switch the score-stack to CSS Grid on mobile so we can place reserve and
  // discards at specific columns without fighting the flex layout or the
  // transform:translateX(-50%) that would corrupt position:fixed children.
  const css = `
${marker}
@media (max-width: 640px) {
  .score-stack{left:5vw!important;right:5vw!important;width:90vw!important;transform:none!important;top:8px!important;display:grid!important;grid-template-columns:110px 1fr 1fr 110px;grid-template-rows:36px 50px;gap:4px 0;align-items:center;justify-items:center}
  .reserve-pill{grid-column:1!important;grid-row:1!important;justify-self:start!important;width:110px!important;height:36px!important;display:grid!important;grid-template-columns:50px 1fr;column-gap:6px;align-items:center;align-content:center;font-size:11px;transform:none!important}
  .discards-pill{grid-column:4!important;grid-row:1!important;justify-self:end!important;width:110px!important;height:36px!important;display:grid!important;grid-template-columns:50px 1fr;column-gap:6px;align-items:center;align-content:center;font-size:11px;transform:none!important}
  .score-stack .score-pill{grid-column:2!important;grid-row:2!important;width:110px!important;height:50px!important;transform:none!important}
  .score-stack .th-pill-wrap{grid-column:3!important;grid-row:2!important;width:110px!important;height:50px!important}
}
`;
  html = html.replace('</style>', css + '\n</style>');
  console.log('Applied pill mobile spread patch.');
} else {
  console.log('Pill mobile spread patch already present, skipping.');
}

fs.writeFileSync(file, html);
