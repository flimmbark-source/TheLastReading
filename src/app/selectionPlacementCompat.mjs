// Compatibility bridge for the store/legacy selection seam.
// Keeps selected hand cards, Discard, and multiplayer drag placement using the
// same visible selection while the shell still mixes store-owned and legacy UI.

function runtime(target){return target.tlrRuntime || {};}
function stateOf(target){return runtime(target).state || target.state;}
function runOf(target){return target.tlrStore?.getState?.()?.run || null;}
function storeReady(target){return !!(target.tlrStore && target.tlrActions && typeof target.tlrStore.getState === 'function');}

function cardUidFromEvent(event){
  const cardEl=event.target?.closest?.('#hand .card[data-uid]');
  const uid=Number(cardEl?.dataset?.uid);
  return Number.isFinite(uid)?uid:null;
}

function hasSelectionMode(target){
  const state=stateOf(target);
  const run=runOf(target);
  return !!(run?.ability?.targeting || state?.abilitySelect || ((run?.purge ?? state?.purgeSelect) !== null));
}

function syncStoreSelection(target,uid){
  const state=stateOf(target);
  if(!storeReady(target)||!state||uid===null)return false;
  if(runOf(target)?.busy ?? state.busy)return true;
  const selected=runOf(target)?.selectedCardId ?? null;
  if(selected===uid)target.tlrStore.dispatch({type:target.tlrActions.CLEAR_SELECTION});
  else target.tlrStore.dispatch({type:target.tlrActions.SELECT_CARD,cardId:uid});
  state.selected=runOf(target)?.selectedCardId ?? null;
  target.refreshHandState?.();
  if(state.selected===uid)target.tutSignal?.('cardSelected');
  return true;
}

function slotIndexFromEvent(event,doc){
  const slot=event.target?.closest?.('#spread .slot.empty');
  if(!slot)return -1;
  return [...doc.querySelectorAll('#spread .slot')].indexOf(slot);
}

function previewMpPlacement(target,uid,slotIndex){
  const doc=target.document;
  if(!doc?.body?.classList?.contains('mp-game-active'))return;
  const slot=doc.querySelectorAll('#spread .slot')[slotIndex];
  if(!slot)return;
  const handCard=doc.querySelector(`#hand .card[data-uid="${uid}"]`);
  if(!handCard)return;
  const clone=handCard.cloneNode(true);
  clone.classList.add('mp-compat-pending-card');
  clone.style.setProperty('visibility','visible','important');
  clone.style.setProperty('pointer-events','none','important');
  handCard.classList.add('mp-compat-pending-hidden');
  slot.replaceChildren(clone);
  slot.classList.remove('empty','target','drop-target');
  slot.classList.add('filled','mp-compat-pending-slot');
  target.setTimeout?.(()=>{
    handCard.classList.remove('mp-compat-pending-hidden');
    slot.classList.remove('mp-compat-pending-slot');
  },1400);
}

function installStyles(doc){
  if(!doc||doc.getElementById('selection-placement-compat-style'))return;
  const style=doc.createElement('style');
  style.id='selection-placement-compat-style';
  style.textContent=`
    body.mp-game-active #hand .card.mp-compat-pending-hidden{visibility:hidden!important;pointer-events:none!important}
    body.mp-game-active #spread .slot.mp-compat-pending-slot{opacity:1!important;filter:none!important}
    body.mp-game-active #spread .slot .card.mp-compat-pending-card{opacity:1!important;filter:none!important}
  `;
  doc.head.appendChild(style);
}

export function installSelectionPlacementCompat(target=window){
  if(!target || target.__tlrSelectionPlacementCompatInstalled)return;
  target.__tlrSelectionPlacementCompatInstalled=true;
  const doc=target.document;
  installStyles(doc);

  doc.addEventListener('click',event=>{
    const uid=cardUidFromEvent(event);
    if(uid===null||hasSelectionMode(target))return;
    const state=stateOf(target);
    if(doc.body.classList.contains('mp-game-active')){
      if(state)state.selected=state.selected===uid?null:uid;
      return;
    }
    if(syncStoreSelection(target,uid)){
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation?.();
    }
  },true);

  doc.addEventListener('click',event=>{
    if(!doc.body.classList.contains('mp-game-active'))return;
    const state=stateOf(target);
    const uid=state?.selected ?? null;
    if(uid===null)return;
    const slotIndex=slotIndexFromEvent(event,doc);
    if(slotIndex<0)return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation?.();
    target.placeCard?.(slotIndex);
    previewMpPlacement(target,uid,slotIndex);
  },true);

  const originalDiscard=target.discardSelected;
  if(typeof originalDiscard==='function'){
    target.discardSelected=function(...args){
      const state=stateOf(target);
      const selected=runOf(target)?.selectedCardId ?? state?.selected ?? null;
      if(state&&selected!==null)state.selected=selected;
      return originalDiscard.apply(this,args);
    };
  }

  const originalPlaceCardUid=target.placeCardUid;
  if(typeof originalPlaceCardUid==='function'){
    target.placeCardUid=function(cardUid,slotIndex,...rest){
      if(doc.body.classList.contains('mp-game-active')){
        const state=stateOf(target);
        if(state)state.selected=cardUid;
        const result=target.placeCard?.(slotIndex);
        previewMpPlacement(target,cardUid,slotIndex);
        return result;
      }
      return originalPlaceCardUid.call(this,cardUid,slotIndex,...rest);
    };
  }
}
