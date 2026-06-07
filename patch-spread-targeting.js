const fs = require('fs');

const path = 'index.html';
let html = fs.readFileSync(path, 'utf8');
let changed = false;

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

const patchedSpreadBlockWithoutHints = `    if(card){
      const e=document.createElement('div');
      const validSpread=ability&&ability.validIds.has(card.uid);
      const pickedSpread=ability&&ability.picked.includes(card.uid);
      if(ability){
        s.classList.add(validSpread?'ability-target-slot':'ability-disabled-slot');
        if(validSpread)s.onclick=(ev)=>{ev.stopPropagation();handleAbilityHandClick(card);};
      }
      e.className='card '+(card.type==='major'?'major ':'')+(validSpread&&!pickedSpread?'ability-target ':'')+(pickedSpread?'ability-picked ':'')+(ability&&!validSpread?'ability-disabled ':'');
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

const patchedSpreadBlockWithHints = `    if(card){
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

if (html.includes(patchedSpreadBlockWithHints)) {
  console.log('Spread ability targeting and hints are already patched.');
} else if (html.includes(patchedSpreadBlockWithoutHints)) {
  html = html.replace(patchedSpreadBlockWithoutHints, patchedSpreadBlockWithHints);
  changed = true;
} else if (html.includes(originalSpreadBlock)) {
  html = html.replace(originalSpreadBlock, patchedSpreadBlockWithHints);
  changed = true;
} else {
  throw new Error('Could not find spread render block to patch.');
}

const oldCss = `.spread .slot.ability-target-slot{z-index:20;pointer-events:auto}.spread .slot.ability-disabled-slot,.spread .slot.ability-empty-slot{pointer-events:none}.spread .slot.ability-target-slot .card{pointer-events:auto}`;
const newCss = `.spread .slot.ability-target-slot{z-index:20;pointer-events:auto}.spread .slot.ability-disabled-slot,.spread .slot.ability-empty-slot{pointer-events:none}.spread .slot.ability-target-slot .card{pointer-events:auto}.spread .card.ability-target.hint-multi{box-shadow:0 0 0 2px #79c778,var(--hint-shadow)!important}.spread .card[data-hint]:hover::after,.spread .card.ability-picked[data-hint]::after,.spread .card.ability-target[data-hint]:hover::after{opacity:1}`;

if (html.includes(newCss)) {
  console.log('Spread ability targeting CSS is already patched.');
} else if (html.includes(oldCss)) {
  html = html.replace(oldCss, newCss);
  changed = true;
} else {
  html = html.replace('</style>', newCss + '\n</style>');
  changed = true;
}

if (changed) {
  fs.writeFileSync(path, html);
  console.log('Patched spread ability targeting and hint styling.');
} else {
  console.log('No spread targeting patch changes needed.');
}
