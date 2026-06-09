const fs = require('fs');
const file = 'index.html';
let html = fs.readFileSync(file, 'utf8');

const marker = '/* Pill mobile spread patch */';
// Remove old version of this block so it can be reinjected with fixes
html = html.replace(/\/\* Pill mobile spread patch \*\/[\s\S]*?}\n/,'');
if (!html.includes(marker)) {
  // On mobile, pull reserve and discards out of the flex stack and anchor them
  // independently: reserve halfway to the left edge (~25vw), discards halfway
  // to the right edge (~75vw). The score + threshold pills stay centered.
  const css = `
${marker}
@media (max-width: 640px) {
  .reserve-pill,.discards-pill{position:fixed;top:calc(46% - 215px);transform:translateX(-50%);width:110px;min-width:110px;height:36px;flex:none;display:grid;grid-template-columns:50px 1fr;column-gap:6px;align-items:center;align-content:center;font-size:11px}
  .reserve-pill{left:25vw}
  .discards-pill{left:75vw}
}
`;
  html = html.replace('</style>', css + '\n</style>');
  console.log('Applied pill mobile spread patch.');
} else {
  console.log('Pill mobile spread patch already present, skipping.');
}

fs.writeFileSync(file, html);
