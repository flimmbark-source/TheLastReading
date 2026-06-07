const fs = require('fs');

const path = 'index.html';
let html = fs.readFileSync(path, 'utf8');
let changed = false;

const spreadBefore = `    if(card){
      const e=document.createElement('div');
      const validSpread=ability&&ability.validIds.has(card.uid);
      const pickedSpread=ability&&ability.picked.includes(card.uid);
      e.className='card '+(card.type==='major'?'major ':'')+(validSpread&&!pickedSpread?'ability-target ':'')+(pickedSpread?'ability-picked ':'')+(ability&&!validSpread?'ability-disabled ':'');
      e.dataset.uid=card.uid