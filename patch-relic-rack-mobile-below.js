const fs = require('fs');
const file = 'index.html';
let html = fs.readFileSync(file, 'utf8');

const marker = '/* relic rack below-spread mobile patch */';
if (html.includes(marker)) {
  console.log('Relic rack below-spread patch already present, skipping.');
  fs.writeFileSync(file, html);
  process.exit(0);
}

// 1. Move #relicRack to immediately after .spread-wrap so it flows under the spread.
const rackEl = '<div id="relicRack" class="relic-rack"></div>\n';
const spreadWrapEnd = '</div>\n<div id="abilityPrompt"';
const spreadWrapEndWithRack = '</div>\n<div id="relicRack" class="relic-rack"></div>\n<div id="abilityPrompt"';

if (html.includes(rackEl) && html.includes(spreadWrapEnd)) {
  html = html.replace(rackEl, ''); // remove from original position
  html = html.replace(spreadWrapEnd, spreadWrapEndWithRack); // insert after spread-wrap
  console.log('Moved #relicRack to after .spread-wrap');
} else {
  console.warn('WARN: could not relocate #relicRack — expected elements not found');
}

// 2. Override relic rack CSS on mobile: drop fixed positioning, go horizontal, centered.
const css = `
${marker}
@media (max-width: 640px) {
  .relic-rack{position:static!important;flex-direction:row!important;justify-content:center!important;align-items:center!important;width:100%!important;top:auto!important;right:auto!important;left:auto!important;transform:none!important;margin:8px 0 4px!important;gap:8px!important}
  .relic-rack .relic-btn{width:38px!important;height:38px!important}
  .relic-rack .relic-slot-empty{width:38px!important;height:38px!important}
}
`;
html = html.replace('</style>', css + '\n</style>');

fs.writeFileSync(file, html);
console.log('Applied relic rack below-spread mobile patch.');
