import assert from 'node:assert/strict';
import { installRuntimeState } from '../src/app/runtimeState.mjs';

class FakeClassList {
  constructor(values=[]){this.values=new Set(values);}
  contains(value){return this.values.has(value);}
  add(...values){values.forEach(value=>this.values.add(value));}
  remove(...values){values.forEach(value=>this.values.delete(value));}
  toggle(value,force){
    const enabled=force===undefined?!this.values.has(value):!!force;
    if(enabled)this.values.add(value);else this.values.delete(value);
    return enabled;
  }
}

class FakeButton {
  constructor(level){this.dataset={level:String(level)};this.classList=new FakeClassList();this.attributes=new Map();}
  setAttribute(name,value){this.attributes.set(name,String(value));}
  getAttribute(name){return this.attributes.get(name);}
}

class MemoryStorage {
  constructor(){this.values=new Map();}
  getItem(key){return this.values.has(key)?this.values.get(key):null;}
  setItem(key,value){this.values.set(key,String(value));}
  removeItem(key){this.values.delete(key);}
}

const segments=[0,1,2].map(level=>new FakeButton(level));
const hintBar={querySelectorAll(selector){return selector==='.hint-level-seg'?segments:[];}};
const relicCheckbox={checked:false};
const bodyClasses=new FakeClassList(['mode-reading']);
const document={
  body:{classList:bodyClasses},
  getElementById(id){if(id==='hintLevelBar')return hintBar;if(id==='hintRelics')return relicCheckbox;return null;},
  querySelector(){return null;},
  querySelectorAll(){return[];},
};
const storage=new MemoryStorage();
let renders=0;
let cacheClears=0;
let stackRefreshes=0;
const initialSettings={patterns:false,relics:false,patternText:false};
const staleSetter=()=>{throw new Error('stale setter should be replaced');};
const target={
  document,
  localStorage:storage,
  hintSettings:initialSettings,
  setHintLevel:staleSetter,
  _hintsCache:{clear(){cacheClears+=1;}},
  render(){renders+=1;},
  __patternHintStackRefresh(){stackRefreshes+=1;},
};

installRuntimeState(target);
assert.notEqual(target.setHintLevel,staleSetter,'runtime replaces stale hint-level helpers');
assert.equal(target.hintSettings,initialSettings,'runtime preserves the shared hint-settings object');

const assertLevel=level=>{
  assert.equal(target.tlrGetHintLevel(),level,`live hint level is ${level}`);
  segments.forEach((button,index)=>{
    assert.equal(button.classList.contains('active'),index===level,`segment ${index} active state matches level ${level}`);
    assert.equal(button.classList.contains('on'),index>=1&&index<=level,`segment ${index} cumulative fill matches level ${level}`);
    assert.equal(button.getAttribute('aria-pressed'),String(index===level),`segment ${index} aria state matches level ${level}`);
  });
};

target.setHintLevel(2);
assert.deepEqual(target.hintSettings,{patterns:true,relics:false,patternText:true},'Text changes the actual live setting');
assert.deepEqual(JSON.parse(storage.getItem('tlr_hint_settings_reading')),target.hintSettings,'Text persists for Reading');
assertLevel(2);
assert.ok(renders>0&&cacheClears>0&&stackRefreshes>0,'changing level invalidates and rerenders hint output');

const sharedReference=target.hintSettings;
bodyClasses.remove('mode-reading');
bodyClasses.add('mode-adventure');
target.__tlrAdventureActive=true;
target.tlrApplyModeHintSettings();
assert.equal(target.hintSettings,sharedReference,'mode restore mutates rather than replaces live settings');
assert.deepEqual(target.hintSettings,{patterns:true,relics:false,patternText:true},'Adventure default is Text');
target.setHintLevel(1);
assert.deepEqual(JSON.parse(storage.getItem('tlr_hint_settings_adventure')),{patterns:true,relics:false,patternText:false},'Adventure level persists separately');
assertLevel(1);

bodyClasses.remove('mode-adventure');
bodyClasses.add('mode-reading');
target.__tlrAdventureActive=false;
target.tlrApplyModeHintSettings();
assert.deepEqual(target.hintSettings,{patterns:true,relics:false,patternText:true},'Reading restores its separately persisted level');
assertLevel(2);

target.toggleHintSetting('patterns',false);
assert.deepEqual(target.hintSettings,{patterns:false,relics:false,patternText:false},'disabling pattern hints also disables dependent text');
assertLevel(0);
target.toggleHintSetting('patternText',true);
assert.deepEqual(target.hintSettings,{patterns:true,relics:false,patternText:true},'enabling text also enables its required glow setting');
assertLevel(2);

target.setHintLevel(-4);
assertLevel(0);
target.setHintLevel(99);
assertLevel(2);

console.log('Hint setting state, persistence, and UI synchronization checks passed.');
