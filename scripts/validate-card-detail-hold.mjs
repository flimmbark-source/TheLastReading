import assert from 'node:assert/strict';
import fs from 'node:fs';
import { JSDOM } from 'jsdom';

import { installCardDetailGestures, syncCardDetailTrigger } from '../src/ui/cardDetailGestures.mjs';

const dom=new JSDOM('<!doctype html><html><head></head><body><div id="hand"><div class="card sel" data-uid="11"></div><div class="card" data-uid="12"></div></div><div id="spread"><div class="card" data-uid="22"></div></div></body></html>',{pretendToBeVisual:true});
const target=dom.window;
Object.defineProperty(target,'innerWidth',{configurable:true,value:430});
Object.defineProperty(target,'innerHeight',{configurable:true,value:800});
let clock=0;
Object.defineProperty(target.performance,'now',{configurable:true,value:()=>clock});

const handCard={uid:11,id:'major_1'};
const otherHandCard={uid:12,id:'major_3'};
const spreadCard={uid:22,id:'major_2'};
let run={hand:[handCard,otherHandCard],spread:[spreadCard,null,null,null,null],selectedCardId:11,busy:false,ability:null,purge:null};
const legacy={hand:[handCard,otherHandCard],spread:[spreadCard,null,null,null,null],selected:11,busy:false,abilitySelect:null,purgeSelect:null};
let expanded=null;
let expandCount=0;
let cancelledPulls=0;

 target.tlrRuntime={state:legacy};
target.tlrActions={SELECT_CARD:'SELECT_CARD'};
target.tlrStore={
  getState:()=>({run}),
  dispatch(action){
    if(action.type==='SELECT_CARD')run={...run,selectedCardId:action.cardId};
  },
};
target.expandCard=card=>{expanded=card;expandCount+=1;};
target.tlrCancelHandDrag=()=>{cancelledPulls+=1;return true;};

const handEl=target.document.querySelector('#hand .card[data-uid="11"]');
const otherHandEl=target.document.querySelector('#hand .card[data-uid="12"]');
const spreadEl=target.document.querySelector('#spread .card');
handEl.getBoundingClientRect=()=>({left:350,right:420,top:100,bottom:205,width:70,height:105,x:350,y:100,toJSON(){return this;}});
otherHandEl.getBoundingClientRect=()=>({left:180,right:250,top:100,bottom:205,width:70,height:105,x:180,y:100,toJSON(){return this;}});

function click(element){
  element.dispatchEvent(new target.MouseEvent('click',{bubbles:true,cancelable:true,button:0}));
}

function pointer(type,element,{pointerId=1,clientY=0}={}){
  const event=new target.Event(type,{bubbles:true,cancelable:true});
  Object.defineProperties(event,{
    pointerId:{value:pointerId},
    clientY:{value:clientY},
    clientX:{value:200},
  });
  element.dispatchEvent(event);
}

installCardDetailGestures(target);
syncCardDetailTrigger(target);

const trigger=target.document.querySelector('.card-detail-trigger');
assert.ok(trigger,'the selected hand card should expose a detail trigger');
assert.equal(trigger.dataset.uid,'11','the trigger should belong to the selected card only');
assert.equal(trigger.parentElement,handEl,'the trigger should be attached to the selected card so it inherits card animation');
assert.equal(trigger.dataset.side,'left','the trigger should swap to the left when the right edge would overflow');
assert.equal(trigger.style.left,'auto');
assert.equal(trigger.style.right,'calc(100% + 7px)','the left-side trigger should stay directly beside the animated card');
assert.equal(trigger.style.top,'0px','the trigger top should remain flush with the card top');

// Reproduce the real runtime problem: later card-gesture code may suppress the
// browser-generated click. The detail trigger must therefore finish on its own
// pointer sequence before that click exists.
target.document.addEventListener('click',event=>{
  if(event.target.closest?.('#hand .card[data-uid]')){
    event.preventDefault();
    event.stopImmediatePropagation();
  }
},true);

let triggerReceivedPointerDown=false;
trigger.addEventListener('pointerdown',()=>{triggerReceivedPointerDown=true;});
pointer('pointerdown',trigger,{pointerId:3,clientY:100});
handEl.classList.add('press-highlight');
pointer('pointerup',trigger,{pointerId:3,clientY:100});
assert.equal(triggerReceivedPointerDown,true,'the detail button must receive pointerdown');
assert.equal(expanded,handCard,'pointerup on the selected-card trigger should open that card detail view without waiting for click synthesis');
assert.equal(expandCount,1,'one pointer sequence should open the detail exactly once');

click(trigger);
assert.equal(expandCount,1,'the native click following pointerup must not reopen the detail view');

clock=1000;
expanded=null;
click(trigger);
assert.equal(expanded,handCard,'keyboard or programmatic click should remain a working fallback');
assert.equal(expandCount,2,'the fallback click should open once');

clock=2000;
target.__handGestureSuppressClickUntil=0;
expanded=null;
click(handEl);
click(handEl);
assert.equal(expanded,null,'hand cards should not open details by double tap');

click(spreadEl);
assert.equal(expanded,null,'one tap on a spread card should not open details');
click(spreadEl);
assert.equal(expanded,spreadCard,'double tapping a placed spread card should still open its detail view');

expanded=null;
target.__handGestureSuppressClickUntil=0;
pointer('pointerdown',handEl,{pointerId:7,clientY:100});
pointer('pointermove',handEl,{pointerId:7,clientY:190});
pointer('pointerup',handEl,{pointerId:7,clientY:190});
assert.equal(cancelledPulls,1,'the retired downward detail pull should be cancelled before it can open details');
assert.equal(expanded,null,'pulling a hand card downward should no longer open the detail view');

handEl.classList.remove('sel');
otherHandEl.classList.add('sel');
run={...run,selectedCardId:12};
legacy.selected=12;
syncCardDetailTrigger(target);
const movedTrigger=target.document.querySelector('.card-detail-trigger');
assert.ok(movedTrigger,'the detail trigger should follow the newly selected card');
assert.equal(movedTrigger.dataset.uid,'12');
assert.equal(movedTrigger.parentElement,otherHandEl,'the same trigger should move into the newly selected card');
assert.equal(movedTrigger.dataset.side,'right','the trigger should use the top-right corner when it fits on screen');
assert.equal(movedTrigger.style.left,'calc(100% + 7px)');
assert.equal(movedTrigger.style.right,'auto');
assert.equal(movedTrigger.style.top,'0px');

otherHandEl.classList.remove('sel');
run={...run,selectedCardId:null};
legacy.selected=null;
syncCardDetailTrigger(target);
assert.equal(target.document.querySelector('.card-detail-trigger'),null,'the trigger should disappear when no hand card is selected');

const cardGestureSource=fs.readFileSync(new URL('../src/ui/gestureCard.mjs',import.meta.url),'utf8');
const handGestureSource=fs.readFileSync(new URL('../src/ui/gestureHand.mjs',import.meta.url),'utf8');
assert.match(cardGestureSource,/#spread,\.card-detail-trigger/,'card dragging must ignore the detail button');
assert.match(handGestureSource,/closest\('\.card-detail-trigger'\)/,'hand swiping must ignore the detail button');

console.log('Card-detail trigger and spread double-tap checks passed.');
