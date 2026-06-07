const fs = require('fs');

const path = 'index.html';
let html = fs.readFileSync(path, 'utf8');
let changed = false;

const before = `    if(card){
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

const after = `    if(card){
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

if (html.includes(before)) {
  html = html.replace(before, after);
  changed = true;
} else if (html.includes(after)) {
  console.log('Spread ability targeting block is already patched.');
} else {
  throw new Error('Could not find spread render block to patch.');
}

const css = `.spread .slot.ability-target-slot{z-index:20;pointer-events:auto}.spread .slot.ability-disabled-slot,.spread .slot.ability-empty-slot{pointer-events:none}.spread .slot.ability-target-slot .card{pointer-events:auto}`;
if (!html.includes('.spread .slot.ability-target-slot')) {
  html = html.replace('</style>', css + '\n</style>');
  changed = true;
}

if (changed) {
  fs.writeFileSync(path, html);
  console.log('Patched spread ability targeting.');
}
