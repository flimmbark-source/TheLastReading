const fs = require('fs');

const path = 'index.html';
let html = fs.readFileSync(path, 'utf8');
let changed = false;

function replaceOne(label, candidates, replacement, markers = []) {
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

  // The committed index.html may have been refactored so the original rule no
  // longer exists verbatim, yet already embodies the intended result. Treat the
  // presence of any marker as "already satisfied" instead of failing the build.
  for (const marker of markers) {
    if (html.includes(marker)) {
      console.log(`${label} already satisfied by current source; skipping.`);
      return;
    }
  }

  throw new Error(`Could not find ${label} block to patch.`);
}

function replaceOptional(label, candidates, replacement) {
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

  console.log(`Skipped ${label}; matching block is not present in this build step.`);
}

function upsertStyle(label, markerStart, markerEnd, css) {
  const block = `${markerStart}\n${css}\n${markerEnd}`;
  const re = new RegExp(markerStart.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '[\\s\\S]*?' + markerEnd.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));

  if (re.test(html)) {
    html = html.replace(re, block);
    changed = true;
    console.log(`Refreshed ${label}.`);
    return;
  }

  const styleEnd = html.indexOf('</style>');
  if (styleEnd < 0) throw new Error(`Could not insert ${label}; </style> not found.`);
  html = html.slice(0, styleEnd) + block + '\n' + html.slice(styleEnd);
  changed = true;
  console.log(`Inserted ${label}.`);
}

function upsertScript(label, markerStart, markerEnd, script) {
  const block = `${markerStart}\n${script}\n${markerEnd}`;
  const re = new RegExp(markerStart.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '[\\s\\S]*?' + markerEnd.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));

  if (re.test(html)) {
    html = html.replace(re, block);
    changed = true;
    console.log(`Refreshed ${label}.`);
    return;
  }

  const scriptEnd = html.lastIndexOf('</script>');
  if (scriptEnd < 0) throw new Error(`Could not insert ${label}; </script> not found.`);
  html = html.slice(0, scriptEnd) + block + '\n' + html.slice(scriptEnd);
  changed = true;
  console.log(`Inserted ${label}.`);
}

const baseGlow = `0 10px 28px rgba(0,0,0,.75),0 0 0 2px #d4af6a`;
const hintCardGlow = `0 0 0 0.75px rgba(var(--hint-rgb,232,196,96),.98),0 0 32px rgba(var(--hint-rgb,232,196,96),.86),0 0 58px rgba(var(--hint-rgb,232,196,96),.42),0 10px 28px rgba(0,0,0,.75)`;
const hintCompleteGlow = `0 0 0 1px rgba(var(--hint-rgb,255,217,120),1),0 0 42px rgba(var(--hint-rgb,255,217,120),.95),0 0 76px rgba(var(--hint-rgb,255,217,120),.55),0 10px 28px rgba(0,0,0,.75)`;
const selectorRing = `0 0 0 2px #d4af6a`;
const hintCardSelectorGlow = `${selectorRing},${hintCardGlow}`;
const hintCompleteSelectorGlow = `${selectorRing},${hintCompleteGlow}`;
const hintMultiSelectorGlow = `${selectorRing},var(--hint-shadow)`;

replaceOne(
  'hand hover upright, press/selected glow',
  [
    `.hand .card:hover,.hand .card.sel{transform:translate3d(0,-92px,0) rotate(0deg);z-index:999!important;box-shadow:${baseGlow}}`,
    `.hand .card:hover,.hand .card.sel{transform:translate3d(0,-92px,0) rotate(0deg);z-index:999!important}.hand .card.sel{box-shadow:${baseGlow}}`,
    `.hand .card:hover,.hand .card:active,.hand .card.sel{transform:translate3d(0,-92px,0) rotate(0deg);z-index:999!important}.hand .card:active,.hand .card.sel{box-shadow:${baseGlow}}`,
    `.hand .card:hover,.hand .card:active,.hand .card.sel,.hand .card.ability-picked,.hand .card.press-highlight{transform:translate3d(0,-92px,0) rotate(0deg);z-index:999!important}.hand .card:active,.hand .card.sel,.hand .card.ability-picked,.hand .card.press-highlight{box-shadow:${baseGlow}}`,
    `.hand:not(.has-selected-card) .card:hover,.hand .card:active,.hand .card.sel,.hand .card.ability-picked,.hand .card.press-highlight{transform:translate3d(0,-92px,0) rotate(0deg);z-index:999!important}.hand .card:active,.hand .card.sel,.hand .card.ability-picked,.hand .card.press-highlight{box-shadow:${baseGlow}}`
  ],
  `.hand:not(.has-selected-card) .card:hover,.hand .card.sel,.hand .card.ability-picked{transform:translate3d(0,-92px,0) rotate(0deg);z-index:999!important}.hand .card:active,.hand .card.sel,.hand .card.ability-picked,.hand .card.press-highlight{box-shadow:${baseGlow}}`,
  [`.hand:not(.has-selected-card) .card:hover,.hand .card.sel,.hand .card.ability-picked,.hand .card.purge-picked{`]
);

replaceOne(
  'hand hint-card glow with stacked selector highlight',
  [
    `.hand .card.hint-card:hover,.hand .card.hint-card.sel{box-shadow:${hintCardGlow}}`,
    `.hand .card.hint-card.sel{box-shadow:${hintCardGlow}}`,
    `.hand .card.hint-card:active,.hand .card.hint-card.sel{box-shadow:${hintCardGlow}}`,
    `.hand .card.hint-card:active,.hand .card.hint-card.sel,.hand .card.hint-card.ability-picked,.hand .card.hint-card.press-highlight{box-shadow:${hintCardGlow}}`,
    `.hand .card.hint-card:active,.hand .card.hint-card.sel,.hand .card.hint-card.ability-picked,.hand .card.hint-card.press-highlight{box-shadow:${hintCardSelectorGlow}}`
  ],
  `.hand .card.hint-card:active,.hand .card.hint-card.sel,.hand .card.hint-card.ability-picked,.hand .card.hint-card.press-highlight{box-shadow:${hintCardSelectorGlow}}`,
  [`.card.hint-card.press-highlight,.card.hint-card.sel,.card.hint-card.ability-picked{box-shadow:`]
);

replaceOne(
  'hand hint-complete glow with stacked selector highlight',
  [
    `.hand .card.hint-complete:hover,.hand .card.hint-complete.sel{box-shadow:${hintCompleteGlow}}`,
    `.hand .card.hint-complete.sel{box-shadow:${hintCompleteGlow}}`,
    `.hand .card.hint-complete:active,.hand .card.hint-complete.sel{box-shadow:${hintCompleteGlow}}`,
    `.hand .card.hint-complete:active,.hand .card.hint-complete.sel,.hand .card.hint-complete.ability-picked,.hand .card.hint-complete.press-highlight{box-shadow:${hintCompleteGlow}}`,
    `.hand .card.hint-complete:active,.hand .card.hint-complete.sel,.hand .card.hint-complete.ability-picked,.hand .card.hint-complete.press-highlight{box-shadow:${hintCompleteSelectorGlow}}`
  ],
  `.hand .card.hint-complete:active,.hand .card.hint-complete.sel,.hand .card.hint-complete.ability-picked,.hand .card.hint-complete.press-highlight{box-shadow:${hintCompleteSelectorGlow}}`,
  [`.card.hint-complete.press-highlight,.card.hint-complete.sel,.card.hint-complete.ability-picked{box-shadow:`]
);

replaceOne(
  'hand hint-multi glow with stacked selector highlight',
  [
    `.hand .card.hint-multi:hover,.hand .card.hint-multi.sel,.hand .card.hint-multi.ability-picked,.choices .card.hint-multi:hover{box-shadow:var(--hint-shadow)!important}`,
    `.hand .card.hint-multi.sel,.hand .card.hint-multi.ability-picked,.choices .card.hint-multi:hover{box-shadow:var(--hint-shadow)!important}`,
    `.hand .card.hint-multi:active,.hand .card.hint-multi.sel,.hand .card.hint-multi.ability-picked,.choices .card.hint-multi:hover{box-shadow:var(--hint-shadow)!important}`,
    `.hand .card.hint-multi:active,.hand .card.hint-multi.sel,.hand .card.hint-multi.ability-picked,.hand .card.hint-multi.press-highlight,.choices .card.hint-multi:active,.choices .card.hint-multi.press-highlight{box-shadow:var(--hint-shadow)!important}`,
    `.hand .card.hint-multi:active,.hand .card.hint-multi.sel,.hand .card.hint-multi.ability-picked,.hand .card.hint-multi.press-highlight,.choices .card.hint-multi:active,.choices .card.hint-multi.press-highlight{box-shadow:${hintMultiSelectorGlow}!important}`
  ],
  `.hand .card.hint-multi:active,.hand .card.hint-multi.sel,.hand .card.hint-multi.ability-picked,.hand .card.hint-multi.press-highlight,.choices .card.hint-multi:active,.choices .card.hint-multi.press-highlight{box-shadow:${hintMultiSelectorGlow}!important}`,
  [`.card.hint-multi.press-highlight,.card.hint-multi.sel,.card.hint-multi.ability-picked{box-shadow:`]
);

replaceOne(
  'hand hint label on press/selected only',
  [
    `.hand .card[data-hint]:hover::after,.hand .card.sel[data-hint]::after,.hand .card.ability-picked[data-hint]::after,.choices .card[data-hint]:hover::after{opacity:1}`,
    `.hand .card.sel[data-hint]::after,.hand .card.ability-picked[data-hint]::after,.choices .card[data-hint]:hover::after{opacity:1}`,
    `.hand .card:active[data-hint]::after,.hand .card.sel[data-hint]::after,.hand .card.ability-picked[data-hint]::after,.choices .card[data-hint]:hover::after{opacity:1}`,
    `.hand .card:active[data-hint]::after,.hand .card.sel[data-hint]::after,.hand .card.ability-picked[data-hint]::after,.hand .card.press-highlight[data-hint]::after,.choices .card:active[data-hint]::after,.choices .card.press-highlight[data-hint]::after{opacity:1}`
  ],
  `.hand .card:active[data-hint]::after,.hand .card.sel[data-hint]::after,.hand .card.ability-picked[data-hint]::after,.hand .card.press-highlight[data-hint]::after,.choices .card:active[data-hint]::after,.choices .card.press-highlight[data-hint]::after{opacity:1}`,
  [`.card.press-highlight[data-hint]::after{opacity:1}`]
);

replaceOptional(
  'spread hint label on press/selected only',
  [
    `.spread .card[data-hint]:hover::after,.spread .card.ability-picked[data-hint]::after,.spread .card.ability-target[data-hint]:hover::after{opacity:1}`,
    `.spread .card.press-highlight[data-hint]::after,.spread .card.ability-picked[data-hint]::after,.spread .card.ability-target.press-highlight[data-hint]::after{opacity:1}`,
    `.spread .card:active[data-hint]::after,.spread .card.press-highlight[data-hint]::after,.spread .card.ability-picked[data-hint]::after,.spread .card.ability-target.press-highlight[data-hint]::after{opacity:1}`
  ],
  `.spread .card:active[data-hint]::after,.spread .card.press-highlight[data-hint]::after,.spread .card.ability-picked[data-hint]::after,.spread .card.ability-target.press-highlight[data-hint]::after{opacity:1}`
);

upsertStyle(
  'press highlight coverage CSS',
  '/* press highlight coverage patch */',
  '/* end press highlight coverage patch */',
  `.card.press-highlight{box-shadow:${baseGlow}}
.card.hint-card.press-highlight,.card.hint-card.sel,.card.hint-card.ability-picked{box-shadow:${hintCardSelectorGlow}}
.card.hint-complete.press-highlight,.card.hint-complete.sel,.card.hint-complete.ability-picked{box-shadow:${hintCompleteSelectorGlow}}
.card.hint-multi.press-highlight,.card.hint-multi.sel,.card.hint-multi.ability-picked{box-shadow:${hintMultiSelectorGlow}!important}
.card.press-highlight[data-hint]::after{opacity:1}`
);

upsertScript(
  'press highlight pointer handler',
  '/* press highlight pointer handler patch */',
  '/* end press highlight pointer handler patch */',
  `(function(){
  if(window.__pressHighlightInstalled)return;
  window.__pressHighlightInstalled=true;
  const clearPressHighlight=()=>document.querySelectorAll('.card.press-highlight').forEach(card=>card.classList.remove('press-highlight'));
  document.addEventListener('pointerdown',ev=>{
    clearPressHighlight();
    const target=ev.target instanceof Element?ev.target:null;
    const card=target?target.closest('.card'):null;
    if(card)card.classList.add('press-highlight');
  },true);
  ['pointerup','pointercancel','dragstart'].forEach(type=>document.addEventListener(type,clearPressHighlight,true));
})();`
);

upsertScript(
  'hand hover lock while selected',
  '/* hand hover selected-lock patch */',
  '/* end hand hover selected-lock patch */',
  `(function(){
  if(window.__handHoverSelectedLockInstalled)return;
  window.__handHoverSelectedLockInstalled=true;
  let _rafPending=false;
  const flush=()=>{
    _rafPending=false;
    const hasSelection=!!document.querySelector('.card.sel,.card.ability-picked');
    document.querySelectorAll('.hand').forEach(hand=>hand.classList.toggle('has-selected-card',hasSelection));
  };
  const update=()=>{if(_rafPending)return;_rafPending=true;requestAnimationFrame(flush);};
  flush();
  new MutationObserver(update).observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['class']});
})();`
);

if (changed) {
  fs.writeFileSync(path, html);
  console.log('Patched card highlighting so selected/pressed cards stack over hint glows and hover movement stops while a card is selected.');
} else {
  console.log('No hover highlight patch changes needed.');
}
