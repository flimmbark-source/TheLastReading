// Direct card placement runtime.
// After the shell cutover, module state is the source of truth. The old
// PLACE_CARD store action can no-op if the store selection is stale, so this
// owns the actual hand -> spread move and syncs the store afterward.

function runtime(target){return target.tlrRuntime || {};}
function stateOf(target){return runtime(target).state || target.state;}

function call(target,name,...args){
  const fn=target[name];
  if(typeof fn==='function')return fn(...args);
  return undefined;
}

export function placeCard(slotIndex,target = window){
  const state=stateOf(target);
  if(!state || state.selected===null || state.spread[slotIndex])return false;
  const handIndex=state.hand.findIndex(card=>card.uid===state.selected);
  if(handIndex<0)return false;

  const beforeScore=typeof target._scoreLegacy==='function'
    ? target._scoreLegacy(state.spread.filter(Boolean))
    : {melds:[],finalScore:0};
  const beforeMelds=new Map((beforeScore.melds||[]).map(m=>[m[0],m]));

  const card=state.hand.splice(handIndex,1)[0];
  state.spread[slotIndex]=card;
  state.selected=null;
  target._cachedPlacedScore=null;

  call(target,'tlrSyncRunToStore');
  call(target,'render');
  call(target,'playSound','place');
  call(target,'haptic',12);

  requestAnimationFrame(()=>{
    const landEl=target._slotEls?.[slotIndex]?.querySelector('.card');
    if(landEl){
      landEl.classList.add('landing');
      landEl.addEventListener('animationend',()=>landEl.classList.remove('landing'),{once:true});
    }
    call(target,'ghost',slotIndex,'+'+card.points);
  });

  const after=typeof target._getPlacedScore==='function'
    ? target._getPlacedScore()
    : (typeof target._scoreLegacy==='function'?target._scoreLegacy(state.spread.filter(Boolean)):{melds:[],finalScore:0});

  const newMelds=(after.melds||[]).flatMap(m=>{
    if(!beforeMelds.has(m[0]))return [m];
    const before=beforeMelds.get(m[0]);
    const chips=m[1]-before[1],mult=m[2]-before[2];
    return chips>0||mult>0?[[m[0],chips,mult,m[3]]]:[];
  });

  let delay=420,announceOffset=0;
  for(const meld of newMelds){
    const slots=typeof target.slotsForMeld==='function'?target.slotsForMeld(meld[0]):[];
    slots.forEach((slot,k)=>setTimeout(()=>call(target,'bump',slot),delay+k*130));
    const anchor=slots.length?slots[slots.length-1]:slotIndex;
    const ghostDelay=delay+slots.length*130+120;
    const relicKey=target._relicMeldNameToKey?.get?.(meld[0])||null;
    setTimeout(()=>call(target,'ghost',anchor,call(target,'meldStr',meld),true,relicKey),ghostDelay);
    const isRelicMeld=target._relicMeldNames?.has?.(meld[0]);
    if(!isRelicMeld&&meld[0]!=='Omen'&&meld[0]!=='Resonance'){
      setTimeout(()=>{
        call(target,'centerGhost',call(target,'normMeldName',meld[0]),meld[2]>1.5||(meld[3]==='add'&&meld[2]>=1.5));
        call(target,'playSound','meld');
        call(target,'haptic',[0,10,35,12]);
      },delay+announceOffset);
    }
    if(meld[2]>0){
      const raw=meld[3]==='add'?meld[2]:meld[2]-1;
      const label=('+'+Number(raw).toFixed(2)).replace(/\.?0+$/,'');
      setTimeout(()=>call(target,'fireMultGhost',label),ghostDelay+200);
    }
    call(target,'holdEffects',ghostDelay+1700);
    delay+=slots.length*130+700;
    announceOffset+=600;
  }

  call(target,'setCounterTarget',after.finalScore||0);
  setTimeout(()=>call(target,'checkResonationTriggers'),750);
  call(target,'checkEnd');
  return true;
}

export function installPlacementRuntime(target = window){
  if(!target || target.__tlrPlacementRuntimeInstalled)return;
  target.__tlrPlacementRuntimeInstalled=true;
  target.tlrPlacementRuntime={placeCard};
  target.placeCard=index=>placeCard(index,target);
}
