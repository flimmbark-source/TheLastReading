// Card press-highlight pointer feedback extracted from the legacy inline tail.

export function installPressHighlight(target = window){
  if(!target || target.__pressHighlightInstalled)return;
  target.__pressHighlightInstalled=true;

  let pendingClear=0;
  const cancelPendingClear=()=>{
    if(!pendingClear)return;
    if(typeof target.cancelAnimationFrame==='function')target.cancelAnimationFrame(pendingClear);
    else clearTimeout(pendingClear);
    pendingClear=0;
  };
  const clearPressHighlightNow=()=>{
    pendingClear=0;
    document.querySelectorAll('.card.press-highlight').forEach(card=>card.classList.remove('press-highlight'));
    document.querySelectorAll('.hand.has-pressed-card').forEach(hand=>hand.classList.remove('has-pressed-card'));
  };
  const clearPressHighlight=()=>{
    cancelPendingClear();
    clearPressHighlightNow();
  };
  const clearPressHighlightAfterClick=()=>{
    cancelPendingClear();
    const clear=()=>clearPressHighlightNow();
    pendingClear=typeof target.requestAnimationFrame==='function'
      ? target.requestAnimationFrame(clear)
      : setTimeout(clear,0);
  };

  document.addEventListener('pointerdown',ev=>{
    clearPressHighlight();
    const eventTarget=ev.target instanceof Element?ev.target:null;
    const card=eventTarget?eventTarget.closest('.card'):null;
    if(!card)return;
    card.classList.add('press-highlight');
    const hand=card.closest('.hand');
    if(hand)hand.classList.add('has-pressed-card');
  },true);

  // pointerup fires before the card's click handler changes selection. Clearing
  // immediately creates one paint where the old .sel card becomes visually active
  // again before the new selected card is rendered. Keep the pressed card active
  // through that click, then clear before the next paint.
  document.addEventListener('pointerup',clearPressHighlightAfterClick,true);
  ['pointercancel','dragstart'].forEach(type=>document.addEventListener(type,clearPressHighlight,true));
}
