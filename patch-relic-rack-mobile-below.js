const fs = require('fs');
const file = 'index.html';
let html = fs.readFileSync(file, 'utf8');

const marker = '/* relic rack below-spread mobile patch */';
if (html.includes(marker)) {
  // Re-apply with updated CSS (replace old block)
  const re = /\/\* relic rack below-spread mobile patch \*\/[\s\S]*?(?=\n<\/style>)/;
  const css = `${marker}
@media (max-width: 640px) {
  .relic-rack{position:fixed!important;flex-direction:row!important;justify-content:center!important;align-items:center!important;width:100%!important;left:0!important;right:0!important;top:calc(46vh + 122px)!important;bottom:auto!important;transform:none!important;margin:0!important;gap:8px!important;z-index:24!important}
  .relic-rack .relic-btn{width:38px!important;height:38px!important}
  .relic-rack .relic-slot-empty{width:38px!important;height:38px!important}
}`;
  if (re.test(html)) {
    html = html.replace(re, css);
    console.log('Updated relic rack below-spread mobile CSS.');
  } else {
    console.log('Relic rack below-spread patch already present (no update needed).');
  }
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

// 2. Override relic rack CSS on mobile: fixed, horizontal, centered below the spread.
// The spread-wrap is positioned at top:46% translateY(-50%); spread content is ~241px tall.
// So the spread bottom edge is approximately calc(46vh + 120px). We anchor the rack just below.
const css = `
${marker}
@media (max-width: 640px) {
  .relic-rack{position:fixed!important;flex-direction:row!important;justify-content:center!important;align-items:center!important;width:100%!important;left:0!important;right:0!important;top:calc(46vh + 122px)!important;bottom:auto!important;transform:none!important;margin:0!important;gap:8px!important;z-index:24!important}
  .relic-rack .relic-btn{width:38px!important;height:38px!important}
  .relic-rack .relic-slot-empty{width:38px!important;height:38px!important}
}
`;
html = html.replace('</style>', css + '\n</style>');

fs.writeFileSync(file, html);
console.log('Applied relic rack below-spread mobile patch.');
