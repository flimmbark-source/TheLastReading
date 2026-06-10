const fs = require('fs');
const file = 'index.html';
let html = fs.readFileSync(file, 'utf8');

const markerStart = '/* hand idle animation override */';
const markerEnd = '/* end hand idle animation override */';

// The animation shorthand has very high specificity (many :not pseudo-classes), so its
// implicit animation-delay:0 overrides the nth-child stagger rules that follow it.
// We re-declare the stagger delays with the same full selector + :nth-child so they
// are more specific and win.
const S = `.hand:not(.hand-scroll-dragging):not(.has-selected-card) .card:not(.sel):not(.ability-picked):not(.purge-picked):not(.hand-card-dragging)`;
const stagger = [0,-550,-1100,-1650,-2200,-2750,-3300,-3850]
  .map((ms,i)=>`${S}:nth-child(${i+1}){animation-delay:${ms}ms}`)
  .join('');
const body = `@keyframes handCardIdleCycle{0%{translate:0 0px}100%{translate:0 5px}}
${S}{animation:handCardIdleCycle 4.4s ease-in-out infinite alternate}
${stagger}`;

const block = `${markerStart}\n${body}\n${markerEnd}`;
const re = new RegExp(
  markerStart.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '[\\s\\S]*?' + markerEnd.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
);

if (re.test(html)) {
  html = html.replace(re, block);
  console.log('hand-idle-override: refreshed.');
} else {
  const idx = html.lastIndexOf('</style>');
  if (idx < 0) throw new Error('</style> not found');
  html = html.slice(0, idx) + block + '\n' + html.slice(idx);
  console.log('hand-idle-override: inserted.');
}

fs.writeFileSync(file, html);
