const fs = require('fs');
const file = 'index.html';
let html = fs.readFileSync(file, 'utf8');

// Clear persist.pool when the session resets so reserve doesn't carry over.
const old = 'persist.totalScore=0;startReading()}';
const next = 'persist.totalScore=0;persist.pool=0;startReading()}';

if (html.includes(next)) {
  console.log('reserve-reset: already applied.');
} else if (html.includes(old)) {
  html = html.replace(old, next);
  fs.writeFileSync(file, html);
  console.log('reserve-reset: persist.pool zeroed in resetSession.');
} else {
  console.warn('reserve-reset: WARN — resetSession signature not found, skipping.');
}

// Keep the final visual/UI override last without extending the already-long package script.
require('./patch-drawer-tabs-and-desktop-drift.js');
