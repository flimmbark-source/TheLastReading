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

export function createInitialHintSettings(){return {patterns:false,relics:false,patternText:false};}

// Hint settings are remembered separately per mode. Adventure starts with hint
// text on; the reading table starts with hints off. Whatever the player last
// chose in a mode is restored when they re-enter it.
const HINT_MODE_DEFAULTS={
  reading:{patterns:false,relics:false,patternText:false},
  adventure:{patterns:true,relics:false,patternText:true},
};
function documentFor(target){return target.document||(typeof document!=='undefined'?document:null);}
function hintMode(target){
  const body=documentFor(target)?.body;
  return (target.__tlrAdventureActive||body?.classList?.contains('mode-adventure'))?'adventure':'reading';
}
function hintStorageKey(target){return 'tlr_hint_settings_'+hintMode(target);}
function normalizeHintSettings(value){
  const patternText=!!value?.patternText;
  return {patterns:patternText||!!value?.patterns,relics:!!value?.relics,patternText};
}
function loadHintSettingsForMode(target){
  try{
    const raw=target.localStorage?.getItem(hintStorageKey(target));
    if(raw){const parsed=JSON.parse(raw);if(parsed&&typeof parsed==='object')return normalizeHintSettings(parsed);}
  }catch(e){}
  return normalizeHintSettings(HINT_MODE_DEFAULTS[hintMode(target)]||HINT_MODE_DEFAULTS.reading);
}
function writeHintSettings(target,next){
  const normalized=normalizeHintSettings(next);
  if(!target.hintSettings||typeof target.hintSettings!=='object')target.hintSettings=createInitialHintSettings();
  Object.assign(target.hintSettings,normalized);
  return target.hintSettings;
}
function saveHintSettingsForMode(target){
  try{target.localStorage?.setItem(hintStorageKey(target),JSON.stringify(normalizeHintSettings(target.hintSettings)));}catch(e){}
}
function hintLevelFromSettings(settings){return settings.patternText?2:(settings.patterns?1:0);}
function syncHintBar(target,level){
  const bar=documentFor(target)?.getElementById('hintLevelBar');
  if(!bar)return;
  bar.querySelectorAll('.hint-level-seg').forEach(button=>{
    const segmentLevel=Number(button.dataset.level);
    const isActive=segmentLevel===level;
    button.classList.toggle('active',isActive);
    button.classList.toggle('on',segmentLevel>=1&&segmentLevel<=level);
    button.setAttribute('aria-pressed',String(isActive));
  });
}
function syncHintCheckboxes(target){
  const relics=documentFor(target)?.getElementById('hintRelics');
  if(relics)relics.checked=!!target.hintSettings.relics;
}
function invalidateHintState(target){
  if(target._hintsCache&&typeof target._hintsCache.clear==='function')target._hintsCache.clear();
  target._hintsCacheKey=null;
  target._spreadScoreForHints=null;
}
function applyHintSettings(target,next,{persist=true,render=true}={}){
  const settings=writeHintSettings(target,next);
  syncHintBar(target,hintLevelFromSettings(settings));
  syncHintCheckboxes(target);
  if(persist)saveHintSettingsForMode(target);
  invalidateHintState(target);
  if(render&&typeof target.render==='function')target.render();
  target.__patternHintStackRefresh?.();
  return settings;
}

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
  writeHintSettings(target,target.hintSettings);

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

  if(typeof target.$!=='function')target.$=selector=>documentFor(target)?.querySelector(selector)||null;
  if(typeof target.shuffle!=='function')target.shuffle=array=>{for(let i=array.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[array[i],array[j]]=[array[j],array[i]];}return array;};
  if(typeof target._slots!=='function')target._slots=()=>target._slotEls||(target._slotEls=Array.from(documentFor(target)?.querySelectorAll('.slot')||[]));

  // Runtime state owns these controls. Always replace any boot/legacy stub so a
  // button cannot update only its visual segment while leaving the live setting
  // and persisted mode value unchanged.
  target.toggleHintSetting=(key,value)=>{
    const next={...target.hintSettings,[key]:!!value};
    if(key==='patterns'&&!value)next.patternText=false;
    if(key==='patternText'&&value)next.patterns=true;
    return applyHintSettings(target,next);
  };
  target.setHintLevel=level=>{
    const numeric=Number(level);
    const normalized=Number.isFinite(numeric)?Math.max(0,Math.min(2,Math.round(numeric))):0;
    return applyHintSettings(target,{
      ...target.hintSettings,
      patterns:normalized>=1,
      patternText:normalized>=2,
    });
  };
  // Load and apply the hint settings saved for the current mode (adventure vs
  // reading), or that mode's default. Mutate the existing object rather than
  // replacing it so every renderer/reference observes the same live settings.
  target.tlrApplyModeHintSettings=()=>applyHintSettings(target,loadHintSettingsForMode(target),{persist:false});
  target.tlrGetHintLevel=()=>hintLevelFromSettings(target.hintSettings);
  syncHintBar(target,hintLevelFromSettings(target.hintSettings));
  syncHintCheckboxes(target);

  const runtime={
    get persist(){return target.persist;},set persist(v){target.persist=v;},
    get state(){return target.state;},set state(v){target.state=v;},
    get hintSettings(){return target.hintSettings;},set hintSettings(v){writeHintSettings(target,v);},
    get caches(){return target.__tlrRuntimeCaches;},
  };

  target.tlrRuntime=runtime;
  target.tlrGetPersist=()=>runtime.persist;
  target.tlrGetState=()=>runtime.state;
  target.tlrGetHintSettings=()=>runtime.hintSettings;
  return runtime;
}
