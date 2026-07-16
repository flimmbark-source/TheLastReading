// Hand renderer (Phase 15.2). Moved verbatim from index.html's render().
// Diffs hand DOM by card uid and cooperates with the swipe handler's
// MutationObserver via the global __handRenderActive flag.
/* global state, $, handleAbilityHandClick, togglePurgeCard, refreshHandState */
import { cardHTML, applyCardPhoto, CARD_SHEET } from './renderCard.mjs';
import { applyHint } from './renderHints.mjs';
import { consumeDrawAnimation } from './drawAnimation.mjs';

function startQueuedDrawAnimations(elements) {
  if (!elements.length) return;
  requestAnimationFrame(() => {
    elements.forEach(({ element, delayMs }) => {
      if (!element.isConnected) return;
      element.classList.remove('card-draw-dealt');
      element.style.setProperty('--draw-delay', `${delayMs}ms`);
      requestAnimationFrame(() => {
        if (!element.isConnected) return;
        element.classList.add('card-draw-dealt');
        element.addEventListener('animationend', () => {
          element.classList.remove('card-draw-dealt');
          element.style.removeProperty('--draw-delay');
        }, { once: true });
      });
    });
  });
}

export function renderHand(ability, inPurge, view = null) {
  // Display data (hand list, selection, purge picks) comes from `view` when
  // provided — multiplayer passes its own match-state view so it no longer has
  // to copy piles into the legacy global `state`. Singleplayer omits `view` and
  // the global `state` is used. Click handlers still drive the shared legacy
  // selection store (`state.selected`) in both modes.
  const v = view || state;
  const h=$('#hand');
  const selectedId=v.selected;
  const handLen=v.hand.length;
  const hintState={spread:v.spread||[],hand:v.hand||[]};
  const hintPool=[...hintState.spread.filter(Boolean),...hintState.hand];
  const queuedDraws=[];
  // Suppress the swipe handler's MutationObserver during the loop.
  // Each insertBefore fires it synchronously with an intermediate card count,
  // causing applySlots() to assign wrong --slot values that then animate.
  // We trigger one correct layout pass at the end instead.
  window.__handRenderActive=true;
  // Build uid -> existing element map so we can reuse DOM that's still in hand.
  const _handExisting=new Map();
  h.querySelectorAll(':scope > .card[data-uid]').forEach(el=>_handExisting.set(Number(el.dataset.uid),el));
  v.hand.forEach((c,i)=>{
    const valid=ability&&ability.validIds.has(c.uid);
    const picked=ability&&ability.picked.includes(c.uid);
    const purgePicked=inPurge&&(v.purgeSelect||[]).includes(c.uid);
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
    e.className='card '+(c.type==='major'?'major ':'')+(CARD_SHEET[c.id]?'photo ':'')
      +(inPurge?(purgePicked?'purge-picked ':'purge-target '):'')
      +(selectedId===c.uid&&!ability&&!inPurge?'sel ':'')
      +(valid&&!picked?'ability-target ':'')+(picked?'ability-picked ':'')
      +(ability&&!valid?'ability-disabled ':'');
    if(!inPurge)applyHint(e,c,hintPool,hintState);
    e.style.zIndex=handLen-i;
    e.style.setProperty('--a',((i-(handLen-1)/2)*5)+'deg');
    e.style.removeProperty('--draw-delay');
    const drawEntry=consumeDrawAnimation(c.uid,window);
    if(drawEntry)queuedDraws.push({element:e,delayMs:drawEntry.delayMs});
    // The gesture controller commits pointer taps on pointerup, while native
    // click remains the keyboard/accessibility path. Both invoke the same
    // current-render action so tap and click cannot drift apart.
    const commitTap=()=>{
      if(ability){handleAbilityHandClick(c);return}
      if(inPurge){togglePurgeCard(c.uid);return}
      // When the caller owns selection (multiplayer passes its own store via the
      // view model), route the toggle to it instead of mutating global `state`.
      if(v.onToggleSelect){v.onToggleSelect(c.uid);return}
      const store=window.tlrStore;
      const actions=window.tlrActions;
      const run=store?.getState?.()?.run;
      if(run?.busy??state.busy)return;
      if(store&&actions){
        const selected=run?.selectedCardId ?? state.selected;
        store.dispatch({type:selected===c.uid?actions.CLEAR_SELECTION:actions.SELECT_CARD,cardId:c.uid});
        state.selected=store.getState?.()?.run?.selectedCardId ?? null;
        refreshHandState();
        if(state.selected===c.uid&&typeof window.tutSignal==='function')window.tutSignal('cardSelected');
        return;
      }
      if(state.selected===c.uid){state.selected=null;refreshHandState();return;}
      state.selected=c.uid;
      refreshHandState();
      if(typeof window.tutSignal==='function')window.tutSignal('cardSelected');
    };
    e.__tlrCommitTap=commitTap;
    e.onclick=commitTap;
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
  if(typeof window.__handTriggerLayout==='function')window.__handTriggerLayout();
  startQueuedDrawAnimations(queuedDraws);
}
