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

target.tlrRuntime={state:legacy};
target.tlrActions={SELECT_CARD:'SELECT_CARD'};
target.tlrStore={
  getState:()=>({run}),
  dispatch(action){
    if(action.type==='SELECT_CARD')run={...run,selectedCardId:action.cardId};
  },
};
target.expandCard=card=>{expanded=card;expandCount+=1;};

const handEl=target.document.querySelector('#hand .card[data-uid="11"]');
const otherHandEl=target.document.querySelector('#hand .card[data-uid="12"]');
const spreadEl=target.document.querySelector('#spread .card');
let handRect={left:350,right:420,top:100,bottom:205,width:70,height:105,x:350,y:100,toJSON(){return this;}};
handEl.getBoundingClientRect=()=>handRect;
otherHandEl.getBoundingClientRect=()=>({left:180,right:250,top:100,bottom:205,width:70,height:105,x:180,y:100,toJSON(){return this;}});

function click(element){
  element.dispatchEvent(new target.MouseEvent('click',{bubbles:true,cancelable:true,button:0}));
}

function pointer(type,element,{pointerId=1,clientX=200,clientY=0}={}){
  const event=new target.Event(type,{bubbles:true,cancelable:true});
  Object.defineProperties(event,{
    pointerId:{value:pointerId},
    clientY:{value:clientY},
    clientX:{value:clientX},
  });
  element.dispatchEvent(event);
}

const cleanup=installCardDetailGestures(target);
syncCardDetailTrigger(target);

const trigger=target.document.querySelector('.card-detail-trigger');
assert.ok(trigger,'the selected hand card should expose a detail trigger');
assert.equal(trigger.dataset.uid,'11','the trigger should belong to the selected card only');
assert.equal(trigger.parentElement,target.document.body,'the trigger should use the viewport portal instead of the transformed hand subtree');
assert.equal(trigger.dataset.side,'left','the trigger should swap to the left when the right edge would overflow');
assert.equal(trigger.style.left,'340px','the medallion tucks flush inside the card left edge (350 - inset 10)');
assert.equal(trigger.style.right,'auto');
assert.equal(trigger.style.top,'195px','the medallion hangs below the card, glyph top at the card bottom (205 - inset 10)');
assert.equal(trigger.type,'button');
assert.equal(trigger.getAttribute('aria-haspopup'),'dialog');
assert.equal(trigger.querySelector('.card-detail-trigger-glyph')?.textContent,'?');
assert.equal(target.document.getElementById('card-detail-trigger-style'),null,'trigger styling should come from the stylesheet rather than an injected style element');

// The selected card can still be moving when the user presses the body-level
// trigger. Freeze the hit target through pointerup so native click synthesis is
// not cancelled by the element moving out from under the pointer.
pointer('pointerdown',trigger,{pointerId:3,clientX:330,clientY:100});
handRect={left:330,right:400,top:100,bottom:205,width:70,height:105,x:330,y:100,toJSON(){return this;}};
syncCardDetailTrigger(target);
assert.equal(trigger.style.left,'340px','the trigger should remain fixed while its pointer is held');
pointer('pointerup',trigger,{pointerId:3,clientX:330,clientY:100});
syncCardDetailTrigger(target);
assert.equal(trigger.style.left,'366px','the trigger should resume alignment after pointerup');
assert.equal(expanded,null,'pointerup without a click should not activate the detail button');

click(trigger);
assert.equal(expanded,handCard,'a native button click should open the selected card detail view');
assert.equal(expandCount,1,'one click should open the detail exactly once');

clock=1000;
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
assert.equal(expanded,null,'pulling a hand card downward should no longer open the detail view');

handEl.classList.remove('sel');
otherHandEl.classList.add('sel');
run={...run,selectedCardId:12};
legacy.selected=12;
syncCardDetailTrigger(target);
const movedTrigger=target.document.querySelector('.card-detail-trigger');
assert.ok(movedTrigger,'the detail trigger should follow the newly selected card');
assert.equal(movedTrigger.dataset.uid,'12');
assert.equal(movedTrigger.parentElement,target.document.body);
assert.equal(movedTrigger.dataset.side,'right','the trigger should use the right side when it fits on screen');
assert.equal(movedTrigger.style.left,'216px');
assert.equal(movedTrigger.style.right,'auto');
assert.equal(movedTrigger.style.top,'195px');

movedTrigger.focus();
assert.equal(target.document.activeElement,movedTrigger,'the native button should accept keyboard focus');
otherHandEl.classList.remove('sel');
run={...run,selectedCardId:null};
legacy.selected=null;
syncCardDetailTrigger(target);
assert.equal(target.document.querySelector('.card-detail-trigger'),null,'the trigger should disappear when no hand card is selected');
assert.equal(target.document.activeElement,target.document.getElementById('hand'),'focus should return to the hand when a focused trigger disappears');

const cardGestureSource=fs.readFileSync(new URL('../src/ui/gestureCard.mjs',import.meta.url),'utf8');
const handGestureSource=fs.readFileSync(new URL('../src/ui/gestureHand.mjs',import.meta.url),'utf8');
const detailGestureSource=fs.readFileSync(new URL('../src/ui/cardDetailGestures.mjs',import.meta.url),'utf8');
const utilityButtonCss=fs.readFileSync(new URL('../src/styles/singlePlayerV2/components/utilityButtons.css',import.meta.url),'utf8');

assert.match(cardGestureSource,/#spread,\.card-detail-trigger/,'card dragging must ignore the detail button');
assert.match(handGestureSource,/closest\('\.card-detail-trigger'\)/,'hand swiping must ignore the detail button');
assert.doesNotMatch(cardGestureSource,/DETAIL_DRAG_DOWN_PX|hand-card-detail-pull|inDetailZone/,'the retired drag-down detail implementation must be removed from the card gesture controller');
assert.doesNotMatch(detailGestureSource,/triggerPointer|POINTER_CLICK_DEDUPE_MS|requestAnimationFrame\(trackPosition\)/,'the trigger should not use pointerup activation or an endless position loop');
assert.match(detailGestureSource,/addEventListener\('click',onTriggerClick\)/,'the trigger should use the native button click event');
assert.match(detailGestureSource,/setPointerCapture/,'the moving viewport trigger should capture its active pointer');
assert.match(detailGestureSource,/if\(triggerPress&&trigger\?\.isConnected\)return true/,'the trigger should freeze while pressed');
assert.match(detailGestureSource,/MOTION_TRACK_MS/,'position tracking should be bounded to active motion');
assert.match(detailGestureSource,/mirrorIdleMotion|__idleMirrors/,'the trigger should ride the fan idle animation via a compositor-driven WAAPI mirror, not a per-frame position loop');
assert.match(utilityButtonCss,/\.card-detail-trigger\s*\{[^}]*width:\s*44px;[^}]*height:\s*44px;/s,'the real mobile hit target should be 44px square');
assert.match(utilityButtonCss,/\.card-detail-trigger-glyph\s*\{[^}]*width:\s*24px;[^}]*height:\s*24px;/s,'the visible medallion should retain its 24px size');

cleanup();
assert.equal(target.__cardDetailGesturesInstalled,false,'the controller should expose a working teardown path');

console.log('Card-detail trigger and spread double-tap checks passed.');
