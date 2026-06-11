// Reading flow orchestration (Step 3a, Phase 16.4). Moved verbatim from
// index.html. Dispatches to the architecture store for all owned gameplay
// transitions and reads results back into legacy state.
// effectsUntil stays in the classic script (shared write with renderGhost.mjs
// holdEffects via the global declarative environment). _slotEls stays in the
// classic script (shared write with renderSpread.mjs). slotsForMeld stays
// inline (function declaration → window, accessed via global env here).
/* global state, persist, TH, SUITS, $, effectsUntil, _slotEls,
   _scoreLegacy, _getPlacedScore, _cachedPlacedScore, _resStateKey,
   _relicMeldNameToKey, _relicMeldNames, _packBuys, _shopPacks, _shopRefreshCount,
   getUnlockedFragments, render, refreshHandState,
   ghost, bump, centerGhost, fireMultGhost, fireScoreGhost, holdEffects,
   meldStr, normMeldName, sortCards, cardDisplayName, cleanName, choice,
   buildDeck, shuffle, drawN, slotsForMeld,
   tlrSyncRunToStore, tlrStoreReady, tlrResolveAbilityThroughStore,
   tlrAbilityDraw, tlrBindSelectionToStore, openShop,
   maxHand, hasMull, tlrArchitectureSync, tlrScoreToObals */
import { isCardUntargetable, hasActiveConstellation } from '../systems/constellations.mjs';

let counterShown=0,counterTarget=0,counterTimer=null,counterCancel=null;

function legacyScore(score){return {...score,melds:(score.melds||[]).map(m=>Array.isArray(m)?m:[m.name,m.chips,m.mult,m.mode])}}
function syncRoundFields(_run){
  state.setIndex=_run.setIndex||0;
  state.setsPerRound=_run.setsPerRound||2;
  state.roundScore=_run.roundScore||0;
  state.setScores=(_run.setScores||[]).slice();
  state.roundDiscardCount=_run.roundDiscardCount||0;
  state.roundPatternCount=_run.roundPatternCount||0;
  state.constellationId=hasActiveConstellation(_run)?(_run.constellationId||null):null;
  state.untargetableCardUids=hasActiveConstellation(_run)?((_run.untargetableCardIds||[]).slice()):[];
  state.awaitingNextSet=!!_run.awaitingNextSet;
  state.lastOutcome=_run.lastOutcome||null;
}
function isTargetBlocked(card){return isCardUntargetable({th:state.th,constellationId:state.constellationId,untargetableCardIds:state.untargetableCardUids},card)}
function targetable(cards){return cards.filter(c=>!isTargetBlocked(c))}

export function getUpFromTable(){
  if(state&&state.busy)return;
  if(window.tlrCloseArchives)window.tlrCloseArchives();
  const panel=document.getElementById('settingsPanel');if(panel)panel.classList.add('hidden');
  const mw=document.getElementById('menuPullWrap');if(mw&&mw.classList.contains('open')){mw.classList.remove('open');const mt=document.getElementById('menuPullTab');if(mt)mt.innerHTML='&#9660; Menu';}
  if(typeof endSession==='function')endSession();
}

export function startReading(){
  if(window.tlrCloseArchives)window.tlrCloseArchives();
  tlrSyncRunToStore();
  window.tlrStore.dispatch({type:window.tlrActions.START_READING,deck:shuffle(buildDeck())});
  const _st=window.tlrStore.getState(),_run=_st.run;
  state.deck=_run.deck.slice();state.hand=_run.hand.slice();state.discard=[];
  state.spread=_run.spread.slice();state.purgeSelect=null;
  state.discards=_run.discards;state.mullCharges=_run.mulliganCharges;
  state.freeDiscardUsed=false;state.sightChargesUsed=0;state.discardedCards=[];
  state.abilityTakenUids=new Set();state.resonationTriggeredThisReading={};
  state.resonationBonus={chips:0,mult:0};
  state.thBonus=_run.thresholdBonus;state.thBonusPending=0;
  syncRoundFields(_run);
  persist.pool=_st.persist.reserve;
  playSound('shuffle');
  _resStateKey=null;
  clearOverlay();snapCounter(state.roundScore||0);render();
}

export function continueSet(){
  if(!state.awaitingNextSet)return;
  tlrSyncRunToStore();
  window.tlrStore.dispatch({type:window.tlrActions.START_NEXT_SET});
  const _run=window.tlrStore.getState().run;
  state.deck=_run.deck.slice();state.hand=_run.hand.slice();state.discard=_run.discard.slice();
  state.spread=_run.spread.slice();state.purgeSelect=null;state.selected=null;
  state.discards=_run.discards;state.mullCharges=_run.mulliganCharges;
  state.abilityTakenUids=new Set();state.resonationTriggeredThisReading={};
  state.resonationBonus={chips:0,mult:0};
  syncRoundFields(_run);
  playSound('shuffle');
  _resStateKey=null;
  clearOverlay();snapCounter(state.roundScore||0);render();
}

export function placeCard(i){
  if(state.selected===null||state.spread[i])return;
  let idx=state.hand.findIndex(c=>c.uid===state.selected);if(idx<0)return;
  const beforeMelds=new Map(_scoreLegacy(state.spread.filter(Boolean)).melds.map(x=>[x[0],x]));
  let c=state.hand[idx];
  tlrSyncRunToStore();
  window.tlrStore.dispatch({type:window.tlrActions.PLACE_CARD,slotIndex:i});
  const _run=window.tlrStore.getState().run;
  state.hand=_run.hand.slice();
  state.spread=_run.spread.slice();
  syncRoundFields(_run);
  render();playSound('place');haptic(12);
  requestAnimationFrame(()=>{
    const _landEl=_slotEls?.[i]?.querySelector('.card');
    if(_landEl){_landEl.classList.add('landing');_landEl.addEventListener('animationend',()=>_landEl.classList.remove('landing'),{once:true});}
    ghost(i,'+'+c.points);
  });
  let after=_getPlacedScore();
  let newMelds=after.melds.flatMap(x=>{
    if(!beforeMelds.has(x[0]))return[x];
    const bm=beforeMelds.get(x[0]);
    const dc=x[1]-bm[1],dm=x[2]-bm[2];
    if(dc>0||dm>0)return[[x[0],dc,dm,x[3]]];
    return[];
  });
  let delay=420;let announceOffset=0;
  newMelds.forEach(m=>{
    let slots=slotsForMeld(m[0]);
    slots.forEach((si,k)=>setTimeout(()=>bump(si),delay+k*130));
    let anchor=slots.length?slots[slots.length-1]:i;
    let ghostDelay=delay+slots.length*130+120;
    const _rk=_relicMeldNameToKey.get(m[0])||null;
    setTimeout(()=>ghost(anchor,meldStr(m),true,_rk),ghostDelay);
    if(!_relicMeldNames.has(m[0])&&m[0]!=='Omen'&&m[0]!=='Resonance')
      setTimeout(()=>{centerGhost(normMeldName(m[0]),m[2]>1.5||m[3]==='add'&&m[2]>=1.5);playSound('meld');haptic([0,10,35,12]);},delay+announceOffset);
    if(m[2]>0){const _mg=m[3]==='add'?m[2]:m[2]-1;const multLabel=('+'+Number(_mg).toFixed(2)).replace(/\.?0+$/,'');setTimeout(()=>fireMultGhost(multLabel),ghostDelay+200);}
    holdEffects(ghostDelay+1700);
    delay+=slots.length*130+700;announceOffset+=600;
  });
  setCounterTarget((state.roundScore||0)+after.finalScore);
  setTimeout(()=>checkResonationTriggers(),750);
  checkEnd();
}

export function setCounterTarget(v){counterTarget=v;if(counterTimer)clearTimeout(counterTimer);counterTimer=setTimeout(()=>{if(counterCancel)counterCancel();counterCancel=rollCounter(counterShown,counterTarget,650);counterShown=counterTarget;counterTimer=null},700)}
export function snapCounter(v){if(counterTimer){clearTimeout(counterTimer);counterTimer=null}if(counterCancel){counterCancel();counterCancel=null}counterShown=counterTarget=v;_cacheEls();_elCurrent.textContent=v;_elCurrent.style.color=''}
export function rollCounter(from,to,dur){_cacheEls();let el=_elCurrent,start=performance.now(),dead=false,lastVal=from,popAnim=null;function step(now){if(dead)return;let t=Math.min(1,(now-start)/dur),e=1-Math.pow(1-t,3),val=Math.round(from+(to-from)*e);for(let v=lastVal+1;v<=val;v++){fireScoreGhost();}if(val!==lastVal){if(popAnim)popAnim.cancel();popAnim=el.animate([{transform:'scale(1)'},{transform:'scale(1.22)'},{transform:'scale(.97)'},{transform:'scale(1)'}],{duration:220,easing:'ease-out'});}lastVal=val;el.textContent=val;el.style.color='#ff9b52';if(t<1)requestAnimationFrame(step);else{el.textContent=to;el.style.color='';holdEffects(1000);}}requestAnimationFrame(step);return()=>{dead=true;if(popAnim)popAnim.cancel();el.style.color=''}}

export function startPurge(){if(state.busy||state.hand.length<3||state.abilitySelect||state.purgeSelect!==null)return;state.purgeSelect=[];state.selected=null;render()}
export function togglePurgeCard(uid){if(state.purgeSelect===null)return;const idx=state.purgeSelect.indexOf(uid);if(idx>=0)state.purgeSelect.splice(idx,1);else if(state.purgeSelect.length<3)state.purgeSelect.push(uid);refreshHandState()}
export function confirmPurge(){if(!state.purgeSelect||state.purgeSelect.length!==3)return;state.hand=state.hand.filter(c=>!state.purgeSelect.includes(c.uid));state.discards++;state.purgeSelect=null;render();checkEnd()}
export function cancelPurge(){state.purgeSelect=null;render()}

export function discardSelected(){
  if(state.busy||state.selected===null)return;
  const selectedBefore=state.selected;
  const free=persist.relics.includes('gilded_discard')&&!state.freeDiscardUsed;
  if(!free&&state.discards<=0)return;
  let idx=state.hand.findIndex(c=>c.uid===selectedBefore);if(idx<0)return;
  let c=state.hand[idx];
  tlrSyncRunToStore();
  window.tlrStore.dispatch({type:window.tlrActions.DISCARD_SELECTED});
  const _run=window.tlrStore.getState().run;
  if(_run.selectedCardId===selectedBefore)return;
  state.hand=_run.hand.slice();
  state.discard=_run.discard.slice();
  state.discardedCards=_run.discardedCards.slice();
  state.discards=_run.discards;
  state.freeDiscardUsed=_run.freeDiscardUsed;
  state.sightChargesUsed=_run.sightChargesUsed;
  syncRoundFields(_run);
  playSound('discard');haptic(16);
  resolveAbility(c.ability,()=>{if(persist.up.nimble_fingers)drawN(persist.up.nimble_fingers);render();checkEnd()},c);
}

export function resolveAbility(ab,done,sourceCard=null){
  const lens=persist.up.lens_mastery||0;
  const rd=persist.up.ritual_depth||0;
  if(ab&&tlrStoreReady())window.tlrStore.dispatch({type:window.tlrActions.START_ABILITY,abilityId:ab,sourceCardId:sourceCard?sourceCard.uid:null});
  if(ab==='DRAW_1'){tlrAbilityDraw(1+rd);done()}
  else if(ab==='DRAW_2'){tlrAbilityDraw(2+rd);done()}
  else if(ab==='DRAW_3'){tlrAbilityDraw(3+rd);done()}
  else if(ab==='PEEK_3')peek(3+lens+(persist.up.peek_plus||0),done);
  else if(ab==='PEEK_5')peek(5+lens+(persist.up.peek_plus||0),done);
  else if(ab==='SEARCH')search(done);
  else if(ab==='NEIGHBOR_2')relation('Neighbor','Choose an anchor card. Neighbor finds adjacent cards: nearby Major numbers or court ranks in the same suit.',neighbor,2+lens+(persist.up.relation_plus||0),done);
  else if(ab==='KIN_2')relation('Kin','Choose an anchor card. Kin finds cards of the same Arcana.',kin,2+lens+(persist.up.relation_plus||0),done);
  else if(ab==='MIRROR_1')relation('Mirror','Choose a card. Take the card opposite it across the centerline of its Arcana. (Knight/Queen, 10/11)',mirror,1+lens,done);
  else if(ab==='BETWEEN_2')betweenAbility(done,sourceCard);
  else if(ab==='WORLD'){
    tlrResolveAbilityThroughStore({kind:'world',handSize:maxHand()+rd});
    playSound('shuffle');done()}
  else{if(ab&&tlrStoreReady())window.tlrStore.dispatch({type:window.tlrActions.CANCEL_ABILITY});done()}
}

function peek(n,done){state.busy=true;let cards=[];for(let i=0;i<n;i++){if(!state.deck.length&&state.discard.length)state.deck=shuffle(state.discard.splice(0));if(!state.deck.length)break;cards.push(state.deck.shift())}if(!cards.length){state.busy=false;done();return}choice('Peek '+n,'Pick one. The rest go to the bottom.',cards,p=>{
  tlrResolveAbilityThroughStore({kind:'take',heldCards:cards,takenCardId:p.uid});
  state.busy=false;done()})}

function search(done){state.busy=true;if(!state.deck.length){state.busy=false;done();return}choice('Search deck','Pick any card. The deck reshuffles.',sortCards(state.deck),p=>{
  tlrResolveAbilityThroughStore({kind:'search',takenCardId:p.uid});
  playSound('shuffle');state.busy=false;done()})}

function inPlay(){return[...state.hand,...state.spread.filter(Boolean)]}
function neighbor(t){return window.tlrAbilities.cardsInDeckByIds(state.deck,window.tlrAbilities.neighborCardIds(t))}
function kin(t){return state.deck.filter(c=>c.uid!==t.uid&&window.tlrAbilities.isSameArcana(c,t))}
function mirror(t){return window.tlrAbilities.cardsInDeckByIds(state.deck,[window.tlrAbilities.mirrorCardId(t)].filter(Boolean))}
function betweenPool(a,b){
  if(!a||!b||a.uid===b.uid)return[];
  return window.tlrAbilities.cardsInDeckByIds(state.deck,window.tlrAbilities.betweenCardIds(a,b));
}
function uniqueCards(cards){let seen=new Set();return cards.filter(c=>{if(seen.has(c.uid))return false;seen.add(c.uid);return true})}
function fallbackAbility(done,title='No valid ability result'){tlrAbilityDraw(1);choice(title,'No valid target was available. Draw 1 instead.',state.hand.slice(-1),()=>{state.busy=false;done()})}

export function selectFromHand(title,prompt,cards,count,cb,previewFn=null){
  state.abilitySelect={title,prompt,validIds:new Set(cards.map(c=>c.uid)),picked:[],count,cb,previewFn};
  render();
}

export function handleAbilityHandClick(card){
  const a=state.abilitySelect;
  if(!a||!a.validIds.has(card.uid))return;
  const idx=a.picked.indexOf(card.uid);
  if(idx>=0)a.picked.splice(idx,1);
  else{
    if(a.picked.length>=a.count)a.picked.shift();
    a.picked.push(card.uid);
  }
  refreshHandState();
}

export function confirmAbilitySelection(){
  const a=state.abilitySelect;
  if(!a||a.picked.length<a.count)return;
  const allCards=[...state.hand,...state.spread.filter(Boolean)];
  const picked=a.picked.map(id=>allCards.find(c=>c.uid===id)).filter(Boolean);
  const cb=a.cb;
  state.abilitySelect=null;
  render();
  cb(...picked);
}

function betweenAbility(done,sourceCard=null){
  state.busy=true;
  const anchors=sortCards(targetable([...state.hand,...state.spread.filter(Boolean)]));
  const validAnchors=anchors.filter(a=>anchors.some(b=>b.uid!==a.uid&&betweenPool(a,b).length>0));
  if(!validAnchors.length){fallbackAbility(done,'Between — no cards between');return}
  const previewFn=(a,b)=>{
    if(!a||!b)return'';
    const total=betweenPool(a,b).length;
    return total?('Between these anchors: '+total+' card'+(total===1?'':'s')):'No cards between these anchors.';
  };
  selectFromHand('Between','Choose 2 cards. Between finds cards whose values fall between them in sequence.',validAnchors,2,(a,b)=>{
    const found=uniqueCards(betweenPool(a,b));
    if(!found.length){
      state.busy=false;done();return;
    }
    choice('Between — '+cleanName(a)+' / '+cleanName(b),'Cards found between them. Take 1. Unchosen revealed cards go to the bottom.',found,p=>{
      tlrResolveAbilityThroughStore({kind:'take',heldCards:found,takenCardId:p.uid,threadBond:true});
      state.busy=false;done();
    });
  },previewFn);
}

function relation(title,prompt,poolFn,n,done){
  state.busy=true;
  const candidates=targetable(inPlay()).filter(c=>poolFn(c).length>0);
  if(!candidates.length){fallbackAbility(done,title+' — no matching cards');return}
  const previewFn=(t)=>{
    if(!t)return'';
    const total=poolFn(t).length;
    return total?(cleanName(t)+': '+total+' card'+(total===1?'':'s')+' found'):'No matching cards.';
  };
  selectFromHand(title,prompt,candidates,1,(t)=>{
    const found=sortCards(poolFn(t)).slice(0,n);
    if(!found.length){
      state.busy=false;done();return;
    }
    choice(title+' — '+cleanName(t),'Cards found from '+cleanName(t)+'. Take 1. Unchosen revealed cards go to the bottom.',found,p=>{
      tlrResolveAbilityThroughStore({kind:'take',heldCards:found,takenCardId:p.uid,threadBond:title==='Kin'||title==='Neighbor'});
      state.busy=false;done();
    });
  },previewFn);
}

export function checkEnd(){if(!state.spread.every(Boolean)&&state.hand.length)return;waitForCounterThenScore()}
function waitForCounterThenScore(){if(counterShown===counterTarget&&!counterTimer&&Date.now()>=effectsUntil)setTimeout(scoreReading,120);else setTimeout(waitForCounterThenScore,100)}

export function scoreReading(){let cards=state.spread.filter(Boolean),res=_scoreLegacy(cards),total=res.finalScore,curTH=TH[state.th]+(state.thBonus||0),pass=total>=curTH;
tlSyncBeforeScore();
window.tlrStore.dispatch({type:window.tlrActions.SCORE_READING});
let needsNext=false,roundTotal=total,setNumber=(state.setIndex||0)+1,setsPerRound=state.setsPerRound||2;
{const _run=window.tlrStore.getState().run;
if(_run.lastScore){
  res=legacyScore(_run.lastScore);
  total=res.finalScore;
  curTH=_run.lastThreshold;
  pass=!!_run.lastPassed;
  needsNext=_run.lastOutcome==='nextSet';
  roundTotal=_run.roundScore||total;
  setNumber=(_run.setIndex||0)+1;
  setsPerRound=_run.setsPerRound||setsPerRound;
  syncRoundFields(_run);
}}
if(needsNext){continueSet();return;}
let title=pass?'The Round Opens':'The Reading Fails';
let verdict=pass?('Threshold '+curTH+' Cleared'):('Below Threshold '+curTH);
let html=`<div class="result-panel ${pass?'pass':'fail'}">`;html+=`<div class="rhead"><span class="rorn">✦ &nbsp; ✦ &nbsp; ✦</span><h3 class="${pass?'pass':'fail'}">${title}</h3></div>`;html+=`<div class="rscore"><span class="rsc">${res.chips}</span><span class="rop">×</span><span class="rsm">${res.mult}</span><span class="rop">=</span><span class="rsf${pass?'':' fail'}">${res.finalScore}</span></div>`;html+=`<span class="rverdict ${pass?'pass':'fail'}">${verdict}</span>`;html+='<hr class="rdiv"><table class="rtable">';html+=`<tr><td>Base card points</td><td class="r">${res.baseChips}</td></tr>`;const _regMelds=res.melds.filter(m=>!m[0].startsWith('⚷'));const _resMelds=res.melds.filter(m=>m[0].startsWith('⚷'));if(_regMelds.length||_resMelds.length){_regMelds.forEach(m=>html+=`<tr class="mrow"><td>⚜ ${m[0]}</td><td class="r">${meldStr(m)}</td></tr>`);_resMelds.forEach(m=>{const _rn=m[0].replace(/^⚷\s*/,'');html+=`<tr class="res-mrow"><td colspan="2"><div class="res-result-banner"><div class="res-result-label">⚷ &nbsp;Hidden Pattern Revealed</div><div class="res-result-row"><span class="res-result-name">${_rn}</span><span class="res-result-score">${meldStr(m)}</span></div></div></td></tr>`;});}else{html+=`<tr><td style="color:#5a4828;font-style:italic">No patterns formed</td><td class="r" style="color:#5a4828">—</td></tr>`;}html+=`<tr class="totrow"><td>Round total</td><td class="r">${roundTotal} / ${curTH}</td></tr>`;if(pass){const miserBonus=persist.relics.includes('miser')?5:0;
{const _st=window.tlrStore.getState();
state.worldCarry=_st.run.worldCarry||0;
state.pendingPool=_st.run.pendingReserve||0;
persist.totalScore=_st.persist.totalScore||0;
state.relicEarned=!!_st.run.relicEarned;
state.th=_st.run.thresholdIndex;}
const worldCarry=state.worldCarry;
html+=`<tr class="totrow"><td>Added to reserve</td><td class="r">+${roundTotal}${miserBonus?` <span style="color:#ffd978">(+${miserBonus} Miser)</span>`:''}${worldCarry?` <span style="color:#ffd978">(+${worldCarry} carry→next)</span>`:''}</td></tr>`;}else{html+=`<tr class="totrow"><td>The candles burn out</td><td class="r">${roundTotal}</td></tr>`;}html+='</table><div class="rbtns">';if(pass){if(state.th>=TH.length)html+='<button class="btn-gold" onclick="endSession()">Complete the Session</button>';else html+='<button class="btn-gold" onclick="openShop()">Visit the Market →</button>';}else{html+='<button onclick="endSession()">End Session</button>';}html+='</div></div>';showOverlay(html);render();}
function tlSyncBeforeScore(){tlrSyncRunToStore()}

export function showOverlay(html){let s=$('#summary');s.className='modal show';s.innerHTML=html;tlrArchitectureSync()}
export function clearOverlay(){let s=$('#summary');s.className='';s.innerHTML='';tlrArchitectureSync()}

export function continueReading(){_packBuys={};_shopPacks=null;_shopRefreshCount=0;const firstShop=!localStorage.getItem('tlr_tut_shop');const pendingRelic=window._pendingRelicTut;window._pendingRelicTut=false;
tlrSyncRunToStore();window.tlrStore.dispatch({type:window.tlrActions.LEAVE_MARKET});state.reading=window.tlrStore.getState().run.reading;
startReading();if(firstShop){localStorage.setItem('tlr_tut_shop','1');setTimeout(()=>tutShow(8),400)}else if(pendingRelic){setTimeout(()=>tutShow(9),400)}}

export function endSession(){const total=persist.totalScore||0;const candles=window.tlrScoreToObals?window.tlrScoreToObals(total):1;
tlrSyncRunToStore();window.tlrStore.dispatch({type:window.tlrActions.END_SESSION,totalScore:total,obals:candles});
showOverlay(`<div class="result-panel pass"><div class="rhead"><span class="rorn">✦ &nbsp; ✦ &nbsp; ✦</span><h3 class="pass">The Reading Ends</h3></div><div class="rscore"><span class="rsf">${total}</span></div><span class="rverdict pass">Total Score</span><div class="rscore" style="margin-top:10px"><span class="rsf" style="font-size:32px">${candles}</span></div><span class="rverdict pass">Obals</span><p style="margin:16px 0 0;color:#8a7551;font-size:12px;text-align:center">Tap to close.</p></div>`);const s=document.getElementById('summary');const openedAt=Date.now();const go=function(){if(Date.now()-openedAt<250)return;s.removeEventListener('click',go);clearOverlay();if(window.tlrDebugEnterAttic)window.tlrDebugEnterAttic(candles,true);};s.addEventListener('click',go)}

export function resetSession(){state={deck:[],hand:[],discard:[],spread:Array(5).fill(null),selected:null,reading:1,th:0,thBonus:0,thBonusPending:0,discards:3,mullCharges:0,busy:false,abilitySelect:null,purgeSelect:null,pendingPool:0,freeDiscardUsed:false,discardedCards:[],worldCarry:0,setIndex:0,setsPerRound:2,roundScore:0,setScores:[],roundDiscardCount:0,roundPatternCount:0,constellationId:null,untargetableCardUids:[],awaitingNextSet:false,lastOutcome:null};tlrBindSelectionToStore();
window.tlrStore.dispatch({type:window.tlrActions.SYNC_LEGACY_PERSIST,persist:{reserve:persist.pool,totalScore:persist.totalScore||0,upgrades:persist.up,relics:persist.relics,relicUsed:persist.relicUsed}});
window.tlrStore.dispatch({type:window.tlrActions.RESET_SESSION});
const _p=window.tlrStore.getState().persist;
persist.relics=_p.relics.slice();persist.relicUsed=Object.assign({},_p.relicUsed);
persist.up=Object.assign({},_p.upgrades);persist.totalScore=_p.totalScore;persist.pool=_p.reserve;
startReading()}
