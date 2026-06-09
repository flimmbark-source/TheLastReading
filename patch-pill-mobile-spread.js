const fs = require('fs');
const file = 'index.html';
let html = fs.readFileSync(file, 'utf8');

const marker = '/* Pill mobile spread patch */';
if (!html.includes(marker)) {
  // On mobile, pull reserve and discards out of the flex stack and anchor them
  // independently: reserve halfway to the left edge (~25vw), discards halfway
  // to the right edge (~75vw). The score + threshold pills stay centered.
  const css = `
${marker}
@media (max-width: 640px) {
  .reserve-pill,.discards-pill{position:fixed;top:calc(46% - 215px);transform:translateX(-50%)}
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
