const fs = require('fs');
const file = 'index.html';
let html = fs.readFileSync(file, 'utf8');
let changed = false;

function replaceOnce(label, oldText, newText) {
  if (html.includes(newText)) {
    console.log(`${label}: already applied.`);
  } else if (html.includes(oldText)) {
    html = html.replace(oldText, newText);
    changed = true;
    console.log(`${label}: applied.`);
  } else {
    console.warn(`${label}: WARN — target rule not found, skipping.`);
  }
}

// The redesigned market pack description was still inheriting flex:1
// from the older pack-card CSS. That stretched the description area and
// left a large empty gap above the cost. Keep the description natural-height
// so the icon, description, cost, and open button stay grouped together.
replaceOnce(
  'market-pack-spacing',
  '.shop-pack-desc{font-size:8.5px;color:#d4c090;text-align:center;line-height:1.3;padding:4px 8px 6px;background:transparent;text-shadow:0 1px 2px rgba(0,0,0,.85)}',
  '.shop-pack-desc{flex:0 0 auto;font-size:8.5px;color:#d4c090;text-align:center;line-height:1.3;padding:4px 8px 6px;background:transparent;text-shadow:0 1px 2px rgba(0,0,0,.85)}'
);

// Purchasable packs should not gain a background glow. The enabled Open
// button already communicates that the pack can be bought.
replaceOnce(
  'market-pack-affordable-glow-old',
  '.shop-pack.affordable{border-color:#d4af6a;box-shadow:0 0 16px rgba(212,175,106,.28)}',
  '.shop-pack.affordable{border-color:transparent;box-shadow:none}'
);

replaceOnce(
  'market-pack-affordable-glow-redesign',
  '.shop-pack.affordable{filter:brightness(1.06);box-shadow:0 0 22px rgba(212,175,106,.28)}',
  '.shop-pack.affordable{filter:none;box-shadow:none}'
);

if (changed) {
  fs.writeFileSync(file, html);
}
