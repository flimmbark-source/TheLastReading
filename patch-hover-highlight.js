const fs = require('fs');

const path = 'index.html';
let html = fs.readFileSync(path, 'utf8');
let changed = false;

function replaceOne(label, candidates, replacement) {
  if (html.includes(replacement)) {
    console.log(`${label} is already patched.`);
    return;
  }

  for (const candidate of candidates) {
    if (html.includes(candidate)) {
      html = html.replace(candidate, replacement);
      changed = true;
      console.log(`Patched ${label}.`);
      return;
    }
  }

  throw new Error(`Could not find ${label} block to patch.`);
}

const baseGlow = `0 10px 28px rgba(0,0,0,.75),0 0 0 2px #d4af6a`;
const hintCardGlow = `0 0 0 0.75px rgba(var(--hint-rgb,232,196,96),.98),0 0 32px rgba(var(--hint-rgb,232,196,96),.86),0 0 58px rgba(var(--hint-rgb,232,196,96),.42),0 10px 28px rgba(0,0,0,.75)`;
const hintCompleteGlow = `0 0 0 1px rgba(var(--hint-rgb,255,217,120),1),0 0 42px rgba(var(--hint-rgb,255,217,120),.95),0 0 76px rgba(var(--hint-rgb,255,217,120),.55),0 10px 28px rgba(0,0,0,.75)`;

replaceOne(
  'hand hover upright, press/selected glow',
  [
    `.hand .card:hover,.hand .card.sel{transform:translate3d(0,-92px,0) rotate(0deg);z-index:999!important;box-shadow:${baseGlow}}`,
    `.hand .card:hover,.hand .card.sel{transform:translate3d(0,-92px,0) rotate(0deg);z-index:999!important}.hand .card.sel{box-shadow:${baseGlow}`,
    `.hand .card:hover,.hand .card.sel{transform:translate3d(0,-92px,0) rotate(0deg);z-index:999!important}.hand .card:active,.hand .card.sel{box-shadow:${baseGlow}`
  ],
  `.hand .card:hover,.hand .card:active,.hand .card.sel{transform:translate3d(0,-92px,0) rotate(0deg);z-index:999!important}.hand .card:active,.hand .card.sel{box-shadow:${baseGlow}}`
);

replaceOne(
  'hand hint-card glow on press/selected only',
  [
    `.hand .card.hint-card:hover,.hand .card.hint-card.sel{box-shadow:${hintCardGlow}}`,
    `.hand .card.hint-card.sel{box-shadow:${hintCardGlow}}`,
    `.hand .card.hint-card:active,.hand .card.hint-card.sel{box-shadow:${hintCardGlow}}`
  ],
  `.hand .card.hint-card:active,.hand .card.hint-card.sel{box-shadow:${hintCardGlow}}`
);

replaceOne(
  'hand hint-complete glow on press/selected only',
  [
    `.hand .card.hint-complete:hover,.hand .card.hint-complete.sel{box-shadow:${hintCompleteGlow}}`,
    `.hand .card.hint-complete.sel{box-shadow:${hintCompleteGlow}}`,
    `.hand .card.hint-complete:active,.hand .card.hint-complete.sel{box-shadow:${hintCompleteGlow}}`
  ],
  `.hand .card.hint-complete:active,.hand .card.hint-complete.sel{box-shadow:${hintCompleteGlow}}`
);

replaceOne(
  'hand hint-multi glow on press/selected only',
  [
    `.hand .card.hint-multi:hover,.hand .card.hint-multi.sel,.hand .card.hint-multi.ability-picked,.choices .card.hint-multi:hover{box-shadow:var(--hint-shadow)!important}`,
    `.hand .card.hint-multi.sel,.hand .card.hint-multi.ability-picked,.choices .card.hint-multi:hover{box-shadow:var(--hint-shadow)!important}`,
    `.hand .card.hint-multi:active,.hand .card.hint-multi.sel,.hand .card.hint-multi.ability-picked,.choices .card.hint-multi:hover{box-shadow:var(--hint-shadow)!important}`
  ],
  `.hand .card.hint-multi:active,.hand .card.hint-multi.sel,.hand .card.hint-multi.ability-picked,.choices .card.hint-multi:hover{box-shadow:var(--hint-shadow)!important}`
);

replaceOne(
  'hand hint label on press/selected only',
  [
    `.hand .card[data-hint]:hover::after,.hand .card.sel[data-hint]::after,.hand .card.ability-picked[data-hint]::after,.choices .card[data-hint]:hover::after{opacity:1}`,
    `.hand .card.sel[data-hint]::after,.hand .card.ability-picked[data-hint]::after,.choices .card[data-hint]:hover::after{opacity:1}`,
    `.hand .card:active[data-hint]::after,.hand .card.sel[data-hint]::after,.hand .card.ability-picked[data-hint]::after,.choices .card[data-hint]:hover::after{opacity:1}`
  ],
  `.hand .card:active[data-hint]::after,.hand .card.sel[data-hint]::after,.hand .card.ability-picked[data-hint]::after,.choices .card[data-hint]:hover::after{opacity:1}`
);

if (changed) {
  fs.writeFileSync(path, html);
  console.log('Patched hand card highlighting to press/selected only without changing the highlight styles.');
} else {
  console.log('No hover highlight patch changes needed.');
}
