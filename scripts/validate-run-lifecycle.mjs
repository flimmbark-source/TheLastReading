import assert from 'node:assert/strict';
import { installRunLifecycle } from '../src/app/runLifecycle.mjs';

class ClassList {
  constructor(...names){this.names=new Set(names)}
  contains(name){return this.names.has(name)}
  add(...names){names.forEach(name=>this.names.add(name))}
  remove(...names){names.forEach(name=>this.names.delete(name))}
}

const summary={
  classList:new ClassList(),
  fail:false,
  button:null,
  querySelector(selector){
    if(selector==='.result-panel.fail')return this.fail?{}:null;
    if(selector.includes('button'))return this.button;
    return null;
  },
};
const settings={classList:new ClassList()};
const menuWrap={classList:new ClassList('open')};
const menuTab={innerHTML:''};
const elements={summary,settingsPanel:settings,menuPullWrap:menuWrap,menuPullTab:menuTab};
const calls=[];
let observerCallback=null;
const target={
  document:{getElementById:id=>elements[id]||null},
  MutationObserver:class {constructor(callback){observerCallback=callback}observe(){}},
  state:{busy:false},
  persist:{totalScore:120},
  tlrActions:{END_SESSION:'END_SESSION'},
  tlrStore:{getState:()=>({persist:{obals:4}}),dispatch:action=>calls.push(['dispatch',action])},
  tlrScoreToObals:score=>score>=100?3:1,
  tlrCloseArchives:()=>calls.push(['closeArchives']),
  showOverlay:html=>{summary.classList.add('show');calls.push(['show',html])},
  clearOverlay:()=>{summary.classList.remove('show');calls.push(['clear'])},
  resetSession:()=>calls.push(['reset']),
  tlrDebugEnterAttic:(obals,shouldReset)=>calls.push(['attic',obals,shouldReset]),
};

installRunLifecycle(target);
assert.equal(typeof target.getUpFromTable,'function');
assert.equal(typeof target.endSession,'function');

const beforeRise=calls.length;
target.getUpFromTable();
assert.equal(menuWrap.classList.contains('open'),false,'get-up confirmation should close the menu drawer');
assert.match(calls.at(-1)[1],/current run will remain as they are/i);
assert.equal(calls.slice(beforeRise).some(([kind])=>kind==='dispatch'||kind==='reset'||kind==='attic'),false,'opening the confirmation must not mutate the run');

target.tlrEnterAtticPreservingRun();
assert.deepEqual(calls.at(-1),['attic',4,false],'attic entry must explicitly disable reset-on-return');
assert.equal(calls.some(([kind])=>kind==='reset'),false,'an attic visit must not start a new run');

summary.fail=true;
summary.button={textContent:'End Session'};
summary.classList.add('show');
observerCallback?.();
assert.equal(summary.button.textContent,'Start New Run','failed-run action should describe the new behavior');
target.endSession();
assert.equal(calls.some(([kind,action])=>kind==='dispatch'&&action.type==='END_SESSION'&&action.obals===3),true,'ending a run must still bank its score and Obals');
assert.deepEqual(calls.at(-1),['reset'],'failed runs should start fresh from the result action');
assert.equal(calls.filter(([kind])=>kind==='attic').length,1,'ending a run must not enter the attic');

summary.fail=false;
summary.classList.remove('show');
target.endSession();
assert.match(calls.at(-1)[1],/Start New Run/,'completed-run summary should offer a new run');
assert.equal(calls.at(-1)[1].includes('tlrDebugEnterAttic'),false,'completed-run summary must not route to the attic');
target.tlrStartNewRunAfterSession();
assert.deepEqual(calls.slice(-2).map(([kind])=>kind),['clear','reset']);

console.log('Run lifecycle validation passed.');
