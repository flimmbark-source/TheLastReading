// Card press-highlight pointer feedback extracted from the legacy inline tail.

export function installPressHighlight(target = window){
  if(!target || target.__pressHighlightInstalled)return;
  target.__pressHighlightInstalled=true;
  const clearPressHighlight=()=>document.querySelectorAll('.card.press-highlight').forEach(card=>card.classList.remove('press-highlight'));
  document.addEventListener('pointerdown',ev=>{
    clearPressHighlight();
    const eventTarget=ev.target instanceof Element?ev.target:null;
    const card=eventTarget?eventTarget.closest('.card'):null;
    if(card)card.classList.add('press-highlight');
  },true);
  ['pointerup','pointercancel','dragstart'].forEach(type=>document.addEventListener(type,clearPressHighlight,true));
}
