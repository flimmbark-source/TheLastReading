// Runtime state adapter for the legacy-to-module migration.
// Today index.html still owns `state`, `persist`, and `hintSettings` as global
// lexical bindings. This adapter gives modules one place to read those values
// while also defining the eventual initial-state shape for the fully modular app.

export function createInitialPersist(){
  return {
    pool:0,
    up:{
      discards:0,hand:0,mulligan:0,lens_mastery:0,offering:0,ritual_depth:0,deep_current:0,
      omen:0,resonance:0,rank:0,rank_mult:0,sequence:0,seq_mult:0,court_chips:0,court_mult:0,
      path_chips:0,path_mult:0,relicSlot:0,blessed_start:0,first_light:0,deep_reserve:0,
      nimble_fingers:0,quick_release:0,chosen:0,balanced_reading:0,balanced_reading_mult:0,
      elemental_harmony:0,elemental_harmony_mult:0,
    },
    relics:[],
    relicUsed:{},
  };
}

export function createInitialState(){
  return {
    deck:[],hand:[],discard:[],spread:Array(5).fill(null),selected:null,reading:1,th:0,
    thBonus:0,thBonusPending:0,discards:3,mull:false,busy:false,abilitySelect:null,purgeSelect:null,
  };
}

export function createInitialHintSettings(){
  return {patterns:true,relics:false};
}

function readGlobalLexical(name){
  try{return Function(`try{return typeof ${name}==='undefined'?undefined:${name}}catch(e){return undefined}`)();}
  catch(e){return undefined;}
}

export function installRuntimeState(target = window){
  if(!target || target.__tlrRuntimeStateInstalled)return target?.tlrRuntime;
  target.__tlrRuntimeStateInstalled=true;

  const runtime={
    get persist(){return readGlobalLexical('persist') || target.persist || createInitialPersist();},
    get state(){return readGlobalLexical('state') || target.state || createInitialState();},
    get hintSettings(){return readGlobalLexical('hintSettings') || target.hintSettings || createInitialHintSettings();},
    get caches(){
      if(!target.__tlrRuntimeCaches){
        target.__tlrRuntimeCaches={
          hints:new Map(),
          hintsKey:null,
          spreadScoreForHints:null,
          unlockedFragments:null,
          placedScore:null,
          slotEls:null,
          resonationStateKey:null,
        };
      }
      return target.__tlrRuntimeCaches;
    },
  };

  target.tlrRuntime=runtime;
  target.tlrGetPersist=()=>runtime.persist;
  target.tlrGetState=()=>runtime.state;
  target.tlrGetHintSettings=()=>runtime.hintSettings;
  return runtime;
}
