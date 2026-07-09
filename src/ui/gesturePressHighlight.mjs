// Card press-highlight pointer feedback extracted from the legacy inline tail.
//
// Press feedback is also the authoritative source for transient hint focus. A
// selected hand card can remain `.sel` until the click handler resolves the new
// selection; during that window, the pressed card owns hint text/active hint
// visuals so stale selected-card hint UI cannot flicker back in.

const ACTIVE_PRESS_EVENT = 'tlr:active-press-card-change';
const PRESS_HINT_STYLE_ID = 'tlr-press-hint-state-style';
const PRESS_HINT_CSS = `
.hand.has-active-press-card .card.sel[data-hint]:not(.press-highlight):not(.ability-picked)::after {
  opacity: 0 !important;
}

.hand.has-active-press-card .card.hint-card.sel:not(.press-highlight):not(.ability-picked):not(.ability-target),
.hand.has-active-press-card .card.hint-complete.sel:not(.press-highlight):not(.ability-picked):not(.ability-target),
.hand.has-active-press-card .card.hint-multi.sel:not(.press-highlight):not(.ability-picked):not(.ability-target) {
  box-shadow: 0 10px 28px rgba(0,0,0,.75), 0 0 0 2px #d4af6a !important;
}
`;

function installPressHintStyles(doc){
  if(!doc || doc.getElementById(PRESS_HINT_STYLE_ID))return;
  const style=doc.createElement('style');
  style.id=PRESS_HINT_STYLE_ID;
  style.textContent=PRESS_HINT_CSS;
  doc.head.appendChild(style);
}

function setActivePressCard(target,card){
  const uid=card?.dataset?.uid ?? null;
  target.__tlrActivePressCardUid=uid==null?null:String(uid);
  const event=new target.CustomEvent(ACTIVE_PRESS_EVENT,{detail:{cardUid:target.__tlrActivePressCardUid}});
  target.dispatchEvent(event);
  if(typeof target.__patternHintStackRefresh==='function')target.__patternHintStackRefresh();
}

export function installPressHighlight(target = window){
  if(!target || target.__pressHighlightInstalled)return;
  const doc=target.document;
  if(!doc)return;
  target.__pressHighlightInstalled=true;
  installPressHintStyles(doc);

  const clearPressHighlight=()=>{
    doc.querySelectorAll('.card.press-highlight').forEach(card=>card.classList.remove('press-highlight'));
    doc.querySelectorAll('.hand.has-active-press-card').forEach(hand=>hand.classList.remove('has-active-press-card'));
    if(target.__tlrActivePressCardUid!=null)setActivePressCard(target,null);
  };

  doc.addEventListener('pointerdown',ev=>{
    clearPressHighlight();
    const eventTarget=ev.target instanceof target.Element?ev.target:null;
    const card=eventTarget?eventTarget.closest('.card'):null;
    if(!card)return;
    card.classList.add('press-highlight');
    const hand=card.closest('.hand');
    if(hand)hand.classList.add('has-active-press-card');
    setActivePressCard(target,card);
  },true);

  ['pointerup','pointercancel','dragstart'].forEach(type=>doc.addEventListener(type,clearPressHighlight,true));
}
