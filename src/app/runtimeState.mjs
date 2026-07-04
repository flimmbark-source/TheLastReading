// Runtime state ownership for the modular app.
// During migration this still knows how to read old global lexical bindings, but
// it now creates real window-backed globals when index.html is only a shell.

export function createInitialPersist(){
  return {
    pool:0,
    up:{
      discards:0,hand:0,mulligan:0,lens_mastery:0,offering:0,ritual_depth:0,deep_current:0,
      omen:0,resonance:0,rank:0,rank_mult:0,sequence:0,seq_mult:0,court_chips:0,court_mult:0,royal_court_chips:0,royal_court_mult:0,
      path_chips:0,path_mult:0,relicSlot:0,blessed_start:0,first_light:0,deep_reserve:0,
      nimble_fingers:0,quick_release:0,chosen:0,balanced_reading:0,balanced_reading_mult:0,
      elemental_harmony:0,elemental_harmony_mult:0,
    },
    relics:[],
    relicUsed:{},
    stampedMajors:[],
    stampedFive:[],
  };
}

export function createInitialState(){
  return {
    deck:[],hand:[],discard:[],spread:Array(5).fill(null),selected:null,reading:1,th:0,
    thBonus:0,thBonusPending:0,discards:3,mull:false,mullCharges:0,busy:false,
    abilitySelect:null,purgeSelect:null,pendingPool:0,freeDiscardUsed:false,discardedCards:[],worldCarry:0,
    setIndex:0,setsPerRound:2,roundScore:0,setScores:[],roundDiscardCount:0,roundPatternCount:0,
    constellationId:null,untargetableCardUids:[],awaitingNextSet:false,lastOutcome:null,
  };
}

export function createInitialHintSettings(){return {patterns:true,relics:false,patternText:true};}

function readGlobalLexical(name){
  try{return Function(`try{return typeof ${name}==='undefined'?undefined:${name}}catch(e){return undefined}`)();}
  catch(e){return undefined;}
}

function ensure(target,name,value){if(!(name in target))target[name]=value;return target[name];}
function defineCacheProp(target,prop,cacheKey,initial){
  if(prop in target)return;
  Object.defineProperty(target,prop,{configurable:true,enumerable:true,
    get(){const c=target.__tlrRuntimeCaches||(target.__tlrRuntimeCaches={});if(!(cacheKey in c))c[cacheKey]=initial;return c[cacheKey];},
    set(v){const c=target.__tlrRuntimeCaches||(target.__tlrRuntimeCaches={});c[cacheKey]=v;},
  });
}

export function installRuntimeState(target = window){
  if(!target)return null;
  if(target.__tlrRuntimeStateInstalled)return target.tlrRuntime;
  target.__tlrRuntimeStateInstalled=true;

  target.persist = readGlobalLexical('persist') || target.persist || createInitialPersist();
  target.state = readGlobalLexical('state') || target.state || createInitialState();
  target.hintSettings = readGlobalLexical('hintSettings') || target.hintSettings || createInitialHintSettings();

  target.__tlrRuntimeCaches ||= {
    hints:new Map(),hintsKey:null,spreadScoreForHints:null,unlockedFragments:null,
    placedScore:null,slotEls:null,resonationStateKey:null,
  };

  ensure(target,'effectsUntil',0);
  ensure(target,'_sfxVol',1.0);
  ensure(target,'_packBuys',{});
  ensure(target,'_shopPacks',null);
  ensure(target,'_shopRefreshCount',0);
  ensure(target,'_relicRackKey','');
  ensure(target,'_openRelicKey',null);
  ensure(target,'_replaceSelectedKey',null);
  ensure(target,'invOpen',false);
  ensure(target,'invPos',(()=>{try{return JSON.parse(target.localStorage.getItem('tlr_inv_pos')||'{}');}catch(e){return {};}})());

  defineCacheProp(target,'_cachedPlacedScore','placedScore',null);
  defineCacheProp(target,'_hintsCache','hints',new Map());
  defineCacheProp(target,'_hintsCacheKey','hintsKey',null);
  defineCacheProp(target,'_spreadScoreForHints','spreadScoreForHints',null);
  defineCacheProp(target,'_unlockedFragmentsCache','unlockedFragments',null);
  defineCacheProp(target,'_slotEls','slotEls',null);
  defineCacheProp(target,'_resStateKey','resonationStateKey',null);

  for(const name of ['_elThreshold','_elPool','_elDiscards','_elDiscardBtn','_elPurgeBtn','_elMullBtn','_elHand','_elCurrent'])ensure(target,name,null);

  if(typeof target.$!=='function')target.$=selector=>document.querySelector(selector);
  if(typeof target.shuffle!=='function')target.shuffle=array=>{for(let i=array.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[array[i],array[j]]=[array[j],array[i]];}return array;};
  if(typeof target._slots!=='function')target._slots=()=>target._slotEls||(target._slotEls=Array.from(document.querySelectorAll('.slot')));
  if(typeof target.toggleHintSetting!=='function')target.toggleHintSetting=(key,value)=>{target.hintSettings[key]=value;if(target._hintsCache)target._hintsCache.clear();if(typeof target.render==='function')target.render();};

  const runtime={
    get persist(){return target.persist;},set persist(v){target.persist=v;},
    get state(){return target.state;},set state(v){target.state=v;},
    get hintSettings(){return target.hintSettings;},set hintSettings(v){target.hintSettings=v;},
    get caches(){return target.__tlrRuntimeCaches;},
  };

  target.tlrRuntime=runtime;
  target.tlrGetPersist=()=>runtime.persist;
  target.tlrGetState=()=>runtime.state;
  target.tlrGetHintSettings=()=>runtime.hintSettings;
  return runtime;
}
