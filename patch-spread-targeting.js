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

  // The committed index.html may have been refactored so the original block no
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

const originalSpreadBlock = `    if(card){
      const e=document.createElement('div');
      const validSpread=ability&&ability.validIds.has(card.uid);
      const pickedSpread=ability&&ability.picked.includes(card.uid);
      e.className='card '+(card.type==='major'?'major ':'')+(validSpread&&!pickedSpread?'ability-target ':'')+(pickedSpread?'ability-picked ':'')+(ability&&!validSpread?'ability-disabled ':'');
      e.dataset.uid=card.uid;
      e.innerHTML=cardHTML(card);
      applyCardPhoto(e,card);
      if(ability){e.onclick=(ev)=>{ev.stopPropagation();handleAbilityHandClick(card);};s.onclick=()=>handleAbilityHandClick(card);}
      s.appendChild(e);
    }else{
      s.innerHTML='<div class="num">'+(i+1)+'</div>';
      s.onclick=()=>placeCard(i);
    }`;

const previousSpreadBlock = `    if(card){
      const e=document.createElement('div');
      const validSpread=ability&&ability.validIds.has(card.uid);
      const pickedSpread=ability&&ability.picked.includes(card.uid);
      if(ability){
        s.classList.add(validSpread?'ability-target-slot':'ability-disabled-slot');
        if(validSpread)s.onclick=(ev)=>{ev.stopPropagation();handleAbilityHandClick(card);};
      }
      e.className='card '+(card.type==='major'?'major ':'')+(validSpread&&!pickedSpread?'ability-target ':'')+(pickedSpread?'ability-picked ':'')+(ability&&!validSpread?'ability-disabled ':'');
      if(!inPurge)applyHint(e,card);
      e.dataset.uid=card.uid;
      e.innerHTML=cardHTML(card);
      applyCardPhoto(e,card);
      if(ability&&validSpread){e.onclick=(ev)=>{ev.stopPropagation();handleAbilityHandClick(card);};}
      s.appendChild(e);
    }else{
      s.innerHTML='<div class="num">'+(i+1)+'</div>';
      if(!ability)s.onclick=()=>placeCard(i);
      else s.classList.add('ability-empty-slot');
    }`;

const patchedSpreadBlock = `    if(card){
      const e=document.createElement('div');
      const validSpread=ability&&ability.validIds.has(card.uid);
      const pickedSpread=ability&&validSpread&&ability.picked.includes(card.uid);
      if(ability){
        s.classList.add(pickedSpread?'ability-picked-slot':(validSpread?'ability-target-slot':'ability-disabled-slot'));
        if(validSpread)s.onclick=(ev)=>{ev.stopPropagation();handleAbilityHandClick(card);};
      }
      e.className='card '+(card.type==='major'?'major ':'')+(validSpread&&!pickedSpread?'ability-target ':'')+(pickedSpread?'ability-picked ':'')+(ability&&!validSpread?'ability-disabled ':'');
      if(!inPurge)applyHint(e,card);
      e.dataset.uid=card.uid;
      e.innerHTML=cardHTML(card);
      applyCardPhoto(e,card);
      if(ability&&validSpread){e.onclick=(ev)=>{ev.stopPropagation();handleAbilityHandClick(card);};}
      s.appendChild(e);
    }else{
      s.innerHTML='<div class="num">'+(i+1)+'</div>';
      if(!ability)s.onclick=()=>placeCard(i);
      else s.classList.add('ability-empty-slot');
    }`;

replaceOne('spread render highlighting', [originalSpreadBlock, previousSpreadBlock], patchedSpreadBlock, [
  `pickedSpread?'ability-picked-slot':(validSpread?'ability-target-slot':'ability-disabled-slot')`,
]);

const originalRefreshBlock = `  document.querySelectorAll('#spread .card[data-uid]').forEach(el=>{
    if(ability){const isPicked=ability.picked.includes(Number(el.dataset.uid));el.classList.toggle('ability-picked',isPicked);el.classList.toggle('ability-target',!isPicked&&ability.validIds.has(Number(el.dataset.uid)));}
  });`;

const previousRefreshBlock = `  document.querySelectorAll('#spread .slot').forEach(slot=>{
    const el=slot.querySelector('.card[data-uid]');
    if(!el)return;
    const uid=Number(el.dataset.uid);
    if(ability){
      const isValid=ability.validIds.has(uid);
      const isPicked=ability.picked.includes(uid);
      el.classList.toggle('ability-picked',isPicked);
      el.classList.toggle('ability-target',isValid&&!isPicked);
      el.classList.toggle('ability-disabled',!isValid);
      slot.classList.toggle('ability-target-slot',isValid);
      slot.classList.toggle('ability-disabled-slot',!isValid);
    }else{
      el.classList.remove('ability-picked','ability-target','ability-disabled');
      slot.classList.remove('ability-target-slot','ability-disabled-slot','ability-empty-slot');
    }
  });`;

const patchedRefreshBlock = `  document.querySelectorAll('#spread .slot').forEach(slot=>{
    const el=slot.querySelector('.card[data-uid]');
    if(!el)return;
    const uid=Number(el.dataset.uid);
    if(ability){
      const isValid=ability.validIds.has(uid);
      const isPicked=isValid&&ability.picked.includes(uid);
      el.classList.toggle('ability-picked',isPicked);
      el.classList.toggle('ability-target',isValid&&!isPicked);
      el.classList.toggle('ability-disabled',!isValid);
      slot.classList.toggle('ability-target-slot',isValid&&!isPicked);
      slot.classList.toggle('ability-picked-slot',isPicked);
      slot.classList.toggle('ability-disabled-slot',!isValid);
    }else{
      el.classList.remove('ability-picked','ability-target','ability-disabled');
      slot.classList.remove('ability-target-slot','ability-picked-slot','ability-disabled-slot','ability-empty-slot');
    }
  });`;

replaceOne('spread refresh highlighting', [originalRefreshBlock, previousRefreshBlock], patchedRefreshBlock);

const stylePatch = `/* spread ability highlight patch */
.spread .slot.ability-target-slot{z-index:20;pointer-events:auto;border-color:#79c778;background:rgba(98,170,104,.14);box-shadow:0 0 0 1px rgba(121,199,120,.75),0 0 24px rgba(121,199,120,.28)}
.spread .slot.ability-picked-slot{z-index:30;pointer-events:auto;border-color:#d4af6a;background:rgba(212,175,106,.14);box-shadow:0 0 0 1px rgba(212,175,106,.9),0 0 28px rgba(212,175,106,.34)}
.spread .slot.ability-disabled-slot,.spread .slot.ability-empty-slot{pointer-events:none}
.spread .slot.ability-disabled-slot .card,.spread .slot.ability-empty-slot .card{pointer-events:none}
.spread .slot.ability-target-slot .card,.spread .slot.ability-picked-slot .card{pointer-events:auto}
.spread .card.ability-target{opacity:1;filter:none;box-shadow:0 0 0 2px #79c778,0 2px 7px rgba(0,0,0,.38)!important}
.spread .card.ability-picked{opacity:1;filter:none;box-shadow:0 6px 14px rgba(0,0,0,.55),0 0 0 2px #d4af6a,0 0 26px rgba(212,175,106,.28)!important}
.spread .card.ability-disabled{opacity:.45;filter:saturate(.55) brightness(.75)}
.spread .card.ability-target.hint-multi{box-shadow:0 0 0 2px #79c778,var(--hint-shadow)!important}
.spread .card.ability-picked.hint-multi{box-shadow:0 6px 14px rgba(0,0,0,.55),0 0 0 2px #d4af6a,0 0 26px rgba(212,175,106,.28)!important}
.spread .card[data-hint]:hover::after,.spread .card.ability-picked[data-hint]::after,.spread .card.ability-target[data-hint]:hover::after{opacity:1}
/* end spread ability highlight patch */`;

const stylePatchRE = /\/\* spread ability highlight patch \*\/[\s\S]*?\/\* end spread ability highlight patch \*\//;
if (stylePatchRE.test(html)) {
  html = html.replace(stylePatchRE, stylePatch);
  changed = true;
  console.log('Refreshed spread ability highlight CSS patch.');
} else {
  html = html.replace('</style>', stylePatch + '\n</style>');
  changed = true;
  console.log('Inserted spread ability highlight CSS patch.');
}

if (changed) {
  fs.writeFileSync(path, html);
  console.log('Patched spread ability targeting and selected/unselected highlight styling.');
} else {
  console.log('No spread targeting patch changes needed.');
}
