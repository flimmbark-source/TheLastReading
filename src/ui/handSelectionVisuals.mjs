// Hand selected-card visual lock extracted from the legacy inline tail.

export function installHandSelectionVisuals(target = window){
  if(!target || target.__handHoverSelectedLockInstalled)return;
  target.__handHoverSelectedLockInstalled=true;
  let rafPending=false;
  const flush=()=>{
    rafPending=false;
    const hasSelection=!!document.querySelector('.card.sel,.card.ability-picked');
    document.querySelectorAll('.hand').forEach(hand=>hand.classList.toggle('has-selected-card',hasSelection));
  };
  // Only schedule work if the class change happened inside #hand — sel and
  // ability-picked are exclusively set on hand cards, so spread/slot class
  // changes (e.g. drop-target) never need to trigger this.
  const update=mutations=>{
    if(rafPending)return;
    if(mutations&&mutations.length&&!mutations.some(m=>m.target instanceof Element&&!!m.target.closest('#hand')))return;
    rafPending=true;requestAnimationFrame(flush);
  };
  flush();
  // Observe only #hand — sel/ability-picked are exclusively set on hand cards.
  // Watching document.body would fire the callback for every drop-target and
  // spread slot class change, adding unnecessary overhead during card drag.
  const attachHandObserver=()=>{
    const h=document.getElementById('hand')||document.querySelector('.hand');
    if(!h){requestAnimationFrame(attachHandObserver);return;}
    new MutationObserver(update).observe(h,{subtree:true,childList:true,attributes:true,attributeFilter:['class']});
  };
  attachHandObserver();
}
