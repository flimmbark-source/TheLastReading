// Spread placement bridge for the shell-cutover path.
// It backs up the renderer onclick and drag gesture path by routing empty-slot
// clicks/pointer releases through the module-owned placeCard function.

function currentState(target){return target.tlrRuntime?.state || target.state;}

function slotIndexFromElement(el){
  const slot=el&&el.closest?el.closest('#spread .slot'):null;
  if(!slot||!slot.classList.contains('empty'))return -1;
  const slots=[...document.querySelectorAll('#spread .slot')];
  return slots.indexOf(slot);
}

function placeSelectedInto(index,target){
  const state=currentState(target);
  if(!state||state.selected===null||index<0)return false;
  if(typeof target.placeCard!=='function')return false;
  target.placeCard(index);
  return true;
}

export function installSpreadPlacementBridge(target = window){
  if(!target || target.__tlrSpreadPlacementBridgeInstalled)return;
  target.__tlrSpreadPlacementBridgeInstalled=true;

  document.addEventListener('click',event=>{
    const t=event.target instanceof Element?event.target:null;
    const idx=slotIndexFromElement(t);
    if(idx<0)return;
    if(placeSelectedInto(idx,target)){
      event.preventDefault();
      event.stopPropagation();
    }
  },true);

  document.addEventListener('pointerup',event=>{
    const state=currentState(target);
    if(!state||state.selected===null)return;
    const els=document.elementsFromPoint(event.clientX,event.clientY);
    for(const el of els){
      if(!(el instanceof Element))continue;
      const idx=slotIndexFromElement(el);
      if(idx<0)continue;
      if(placeSelectedInto(idx,target)){
        event.preventDefault();
        event.stopPropagation();
      }
      return;
    }
  },false);
}
