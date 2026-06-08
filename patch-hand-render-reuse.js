const fs = require('fs');

const path = 'index.html';
let html = fs.readFileSync(path, 'utf8');

// v1: replaceChildren → uid-keyed diff (already applied in a prior run).
// v2: add __handRenderActive guard so the MutationObserver doesn't fire
//     applySlots() on every insertBefore with an intermediate card count.
const original = `  const h=$('#hand');
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

const replacement = `  const h=$('#hand');
  const selectedId=state.selected;
  const handLen=state.hand.length;
  // Suppress the swipe handler's MutationObserver during the loop.
  // Each insertBefore fires it synchronously with an intermediate card count,
  // causing applySlots() to assign wrong --slot values that then animate.
  // We trigger one correct layout pass at the end instead.
  window.__handRenderActive=true;
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
  _handExisting.forEach(el=>el.remove());
  // Lift the suppression flag and do one correct layout pass now that
  // the final DOM shape is in place.
  window.__handRenderActive=false;
  if(typeof window.__handTriggerLayout==='function')window.__handTriggerLayout();`;

if (html.includes(replacement)) {
  console.log('Hand render reuse already applied.');
} else if (!html.includes(original)) {
  throw new Error('Could not find hand render block to patch.');
} else {
  html = html.replace(original, replacement);
  fs.writeFileSync(path, html);
  console.log('Patched hand render to reuse existing card DOM by uid.');
}
