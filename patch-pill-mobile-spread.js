const fs = require('fs');
const file = 'index.html';
let html = fs.readFileSync(file, 'utf8');

// Strip any previous version of this block before reinserting
html = html.replace(/\/\* Pill mobile spread patch \*\/[\s\S]*?(?=\n<\/style>)/, '');

const marker = '/* Pill mobile spread patch */';
if (!html.includes(marker)) {
  // On mobile the score-stack is 224px wide, centered.
  // Row 1: reserve (order:1, 110px) then discards (order:2, 110px).
  // Reserve center sits at 50vw - 57px; discards center at 50vw + 57px.
  // We want reserve at 25vw and discards at 75vw, so:
  //   reserve shift = 25vw - (50vw - 57px) = -25vw + 57px
  //   discards shift = 75vw - (50vw + 57px) =  25vw - 57px
  // Everything else (top, width, score/threshold) stays exactly as original.
  const css = `
${marker}
@media (max-width: 640px) {
  .reserve-pill{transform:translateX(calc(-25vw + 57px))}
  .discards-pill{transform:translateX(calc(25vw - 57px))}
}
`;
  html = html.replace('</style>', css + '\n</style>');
  console.log('Applied pill mobile spread patch.');
} else {
  console.log('Pill mobile spread patch already present, skipping.');
}

fs.writeFileSync(file, html);
