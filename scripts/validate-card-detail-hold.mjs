import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

import { installCardDetailGestures } from '../src/ui/cardDetailGestures.mjs';

const dom=new JSDOM('<!doctype html><html><body><div id="hand"><div class="card" data-uid="11"></div></div><div id="spread"><div class="card" data-uid="22"></div></div></body></html>');
const target=dom.window;
globalThis.Element=target.Element;

const handCard={uid:11,id:'major_1'};
const spreadCard={uid:22,id:'major_2'};
let run={hand:[handCard],spread:[spreadCard,null,null,null,null],selectedCardId:null,busy:false,ability:null,purge:null};
const legacy={hand:[handCard],spread:[spreadCard,null,null,null,null],selected:null,busy:false,abilitySelect:null,purgeSelect:null};
let refreshes=0;
let expanded=null;
let nextTimerId=1;
const timers=new Map();

target.setTimeout=fn=>{
  const id=nextTimerId++;
  timers.set(id,fn);
  return id;
};
target.clearTimeout=id=>timers.delete(id);
target.tlrRuntime={state:legacy};
target.tlrActions={SELECT_CARD:'SELECT_CARD'};
target.tlrStore={
  getState:()=>({run}),
  dispatch(action){
    if(action.type==='SELECT_CARD')run={...run,selectedCardId:action.cardId};
  },
};
target.refreshHandState=()=>{refreshes+=1;};
target.expandCard=card=>{expanded=card;};

function pointer(type,element,{x=10,y=10,id=1}={}){
  const event=new target.MouseEvent(type,{bubbles:true,cancelable:true,clientX:x,clientY:y,button:0});
  Object.defineProperty(event,'pointerId',{value:id});
  element.dispatchEvent(event);
}

function fireOnlyTimer(){
  assert.equal(timers.size,1,'a stationary press should schedule one detail hold');
  const [[id,callback]]=timers;
  timers.delete(id);
  callback();
}

installCardDetailGestures(target);

const handEl=target.document.querySelector('#hand .card');
pointer('pointerdown',handEl);
fireOnlyTimer();
assert.equal(expanded,handCard,'holding a hand card should open that card in the detail view');
assert.equal(run.selectedCardId,11,'holding a hand card should preserve the old selected-card behavior');
assert.equal(legacy.selected,11,'legacy selection should stay synchronized');
assert.equal(refreshes,1,'the raised hand-card state should refresh once');
assert.ok(target.__handGestureSuppressClickUntil>performance.now(),'the synthetic click after a hold should be suppressed');

expanded=null;
pointer('pointerdown',handEl,{x:10,y:10,id:2});
pointer('pointermove',handEl,{x:24,y:10,id:2});
assert.equal(timers.size,0,'moving beyond the drag threshold should cancel the detail hold');
assert.equal(expanded,null,'starting a drag should not open the detail view');

const spreadEl=target.document.querySelector('#spread .card');
pointer('pointerdown',spreadEl,{id:3});
fireOnlyTimer();
assert.equal(expanded,spreadCard,'holding a placed spread card should still open its detail view');
assert.equal(run.selectedCardId,11,'opening a spread card should not replace the selected hand card');

console.log('Card-detail hold gesture checks passed.');
