// Direct card placement runtime.
// After the shell cutover, module state is the source of truth. Placement can
// now receive an explicit card uid, so callers do not have to communicate a
// dragged/selected card through legacy `state.selected` first.

function runtime(target){return target.tlrRuntime || {};}
function stateOf(target){return runtime(target).state || target.state;}

function call(target,name,...args){
  const fn=target[name];
  if(typeof fn==='function')return fn(...args);
  return undefined;
}

function selectedCardId(target,state){
  const storeSelected=target.tlrStore?.getState?.()?.run?.selectedCardId;
  return storeSelected ?? state?.selected ?? null;
}

function scorePillBase(target,state){
  const explicit=Number(target.tlrScorePillSetBase||0);
  if(Number.isFinite(explicit)&&explicit>0)return explicit;
  const round=Number(state?.roundScore||0);
  return Number.isFinite(round)?round:0;
}

export function placeCard(slotIndex,target = window, explicitCardUid = null){
  const state=stateOf(target);
  const cardUid=explicitCardUid ?? selectedCardId(target,state);
  if(!state || cardUid===null || state.spread[slotIndex])return false;
  const handIndex=state.hand.findIndex(card=>card.uid===cardUid);
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
  call(target,'tutSignal','cardPlaced');
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

  call(target,'setCounterTarget',scorePillBase(target,state)+(after.finalScore||0));
  setTimeout(()=>call(target,'checkResonationTriggers'),750);
  call(target,'checkEnd');
  return true;
}

export function placeCardByUid(cardUid,slotIndex,target = window){
  return placeCard(slotIndex,target,cardUid);
}

export function installPlacementRuntime(target = window){
  if(!target || target.__tlrPlacementRuntimeInstalled)return;
  target.__tlrPlacementRuntimeInstalled=true;
  target.tlrPlacementRuntime={placeCard,placeCardByUid};
  target.placeCard=index=>placeCard(index,target);
  target.placeCardUid=(cardUid,index)=>placeCardByUid(cardUid,index,target);
}
