const fs = require('fs');
const file = 'index.html';
let html = fs.readFileSync(file, 'utf8');

// The redesigned market pack description was still inheriting flex:1
// from the older pack-card CSS. That stretched the description area and
// left a large empty gap above the cost. Keep the description natural-height
// so the icon, description, cost, and open button stay grouped together.
const old = '.shop-pack-desc{font-size:8.5px;color:#d4c090;text-align:center;line-height:1.3;padding:4px 8px 6px;background:transparent;text-shadow:0 1px 2px rgba(0,0,0,.85)}';
const next = '.shop-pack-desc{flex:0 0 auto;font-size:8.5px;color:#d4c090;text-align:center;line-height:1.3;padding:4px 8px 6px;background:transparent;text-shadow:0 1px 2px rgba(0,0,0,.85)}';

if (html.includes(next)) {
  console.log('market-pack-spacing: already applied.');
} else if (html.includes(old)) {
  html = html.replace(old, next);
  fs.writeFileSync(file, html);
  console.log('market-pack-spacing: grouped pack description above cost.');
} else {
  console.warn('market-pack-spacing: WARN — market pack description rule not found, skipping.');
}
