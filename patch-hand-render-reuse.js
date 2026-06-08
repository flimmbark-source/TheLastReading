const fs = require('fs');

const path = 'index.html';
let html = fs.readFileSync(path, 'utf8');

// Replace the hand-render block that calls replaceChildren with a uid-keyed
// diff so existing card DOM nodes are reused. New cards get DOM created once;
// cards that left the hand are removed; surviving cards keep their identity
// so CSS transitions animate from their old --slot to the new one instead of
// every card popping in from --slot:0 (the centered default).
const original = `  const h=$('#hand');
  const hFrag=document.createDocumentFragment();
  const selectedId=state.selected;
  const handLen=state.hand.length;
  state.hand.forEach((c,i)=>{
    const e=document.createElement('div');
    const valid=ability&&ability.validIds.has(c.uid);
    const picked=ability&&ability.picked.includes(c.uid);
    const purgePicked=inPurge&&state.purgeSelect.includes(c.uid);
    e.className='card '+(c.type==='major'?'major ':'')
      +(inPurge?(purgePicked?'purge-picked ':'purge-target '):'')
      +(selectedId===c.uid&&!ability&&!inPurge?'sel ':'')
      +(valid&&!picked?'ability-target ':'')+(picked?'ability-picked ':'')
      +(ability&&!valid?'ability-disabled ':'');
    if(!inPurge)applyHint(e,c);
    e.dataset.uid=c.uid;
    e.style.zIndex=handLen-i;
    e.style.setProperty('--a',((i-(handLen-1)/2)*5)+'deg');
    e.innerHTML=cardHTML(c);
    applyCardPhoto(e,c);
    e.onclick=()=>{
      if(ability){handleAbilityHandClick(c);return}
      if(inPurge){togglePurgeCard(c.uid);return}
      if(state.busy)return;
      if(state.selected===c.uid){expandCard(c);return;}
      state.selected=c.uid;
      refreshHandState();
    };
    hFrag.appendChild(e);
  });
  h.replaceChildren(hFrag);`;

const replacement = `  const h=$('#hand');
  const selectedId=state.selected;
  const handLen=state.hand.length;
  // Build uid -> existing element map so we can reuse DOM that's still in hand.
  const _handExisting=new Map();
  h.querySelectorAll(':scope > .card[data-uid]').forEach(el=>_handExisting.set(Number(el.dataset.uid),el));
  state.hand.forEach((c,i)=>{
    const valid=ability&&ability.validIds.has(c.uid);
    const picked=ability&&ability.picked.includes(c.uid);
    const purgePicked=inPurge&&state.purgeSelect.includes(c.uid);
    let e=_handExisting.get(c.uid);
    const fresh=!e;
    if(fresh){
      e=document.createElement('div');
      e.dataset.uid=c.uid;
      e.innerHTML=cardHTML(c);
      applyCardPhoto(e,c);
    }else{
      _handExisting.delete(c.uid);
      // Clear hint inline styles so applyHint can re-apply (or leave clean
      // if this card no longer has a hint this render).
      e.style.removeProperty('--hint-rgb');
      e.style.removeProperty('--hint-shadow');
      delete e.dataset.hint;
    }
    e.className='card '+(c.type==='major'?'major ':'')
      +(inPurge?(purgePicked?'purge-picked ':'purge-target '):'')
      +(selectedId===c.uid&&!ability&&!inPurge?'sel ':'')
      +(valid&&!picked?'ability-target ':'')+(picked?'ability-picked ':'')
      +(ability&&!valid?'ability-disabled ':'');
    if(!inPurge)applyHint(e,c);
    e.style.zIndex=handLen-i;
    e.style.setProperty('--a',((i-(handLen-1)/2)*5)+'deg');
    // onclick captures the current render's ability/inPurge snapshot, so
    // rebind every render even for reused nodes.
    e.onclick=()=>{
      if(ability){handleAbilityHandClick(c);return}
      if(inPurge){togglePurgeCard(c.uid);return}
      if(state.busy)return;
      if(state.selected===c.uid){expandCard(c);return;}
      state.selected=c.uid;
      refreshHandState();
    };
    // Move into correct position only if not already there (avoids needless
    // DOM mutations that would trigger the swipe handler's MutationObserver).
    const at=h.children[i];
    if(at!==e)h.insertBefore(e,at||null);
  });
  // Drop cards that are no longer in hand.
  _handExisting.forEach(el=>el.remove());`;

if (html.includes(replacement)) {
  console.log('Hand render reuse already applied.');
} else if (!html.includes(original)) {
  throw new Error('Could not find hand render block to patch.');
} else {
  html = html.replace(original, replacement);
  fs.writeFileSync(path, html);
  console.log('Patched hand render to reuse existing card DOM by uid.');
}
