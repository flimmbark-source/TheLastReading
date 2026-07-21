import assert from 'node:assert/strict';
import { applyCardPhoto } from '../src/ui/renderCard.mjs';

let imageRequests=0;
class FakeImage {
  constructor(){
    imageRequests+=1;
    this.complete=false;
    this.naturalWidth=0;
    this.decoding='auto';
    this.fetchPriority='auto';
  }
  set src(value){
    this._src=value;
    queueMicrotask(()=>{
      this.complete=true;
      this.naturalWidth=600;
      this.onload?.();
    });
  }
  get src(){return this._src;}
  decode(){return Promise.resolve();}
}

const appendedStyles=[];
const view={
  Image:FakeImage,
  queueMicrotask,
  requestIdleCallback:()=>0,
};
const doc={
  defaultView:view,
  head:{appendChild:node=>appendedStyles.push(node)},
  createElement:()=>({id:'',textContent:''}),
};
function cardElement(){
  const classes=new Set();
  return {
    ownerDocument:doc,
    dataset:{},
    style:{backgroundImage:'',backgroundPosition:''},
    classList:{add:name=>classes.add(name),contains:name=>classes.has(name)},
  };
}

const card={id:'major_0'};
const first=cardElement();
const firstLoad=applyCardPhoto(first,card);
assert.equal(first.classList.contains('photo'),true,'photo cards should retain their photo class');
assert.equal(first.dataset.photoReady,undefined,'fallback content must remain visible before decode');
assert.match(first.style.backgroundImage,/sheet01\.small\.webp/);
await firstLoad;
assert.equal(first.dataset.photoReady,'1','decoded art should replace the fallback');
assert.equal(imageRequests,1,'the first card should request its sheet once');

const second=cardElement();
await applyCardPhoto(second,card);
assert.equal(second.dataset.photoReady,'1','cached sheets should render ready immediately');
assert.equal(imageRequests,1,'cards on the same sheet must share one request/decode');

assert.equal(appendedStyles.length,1,'runtime presentation styles should install once');
assert.match(appendedStyles[0].textContent,/photo-ready/,'runtime styles should gate fallback visibility on decode');
assert.match(appendedStyles[0].textContent,/slot\.target/,'runtime styles should own the selected-slot treatment');
assert.doesNotMatch(
  appendedStyles[0].textContent.match(/slot\.target\{([\s\S]*?)\}/)?.[1]||'',
  /rgba\(0,0,0/,
  'selected slots should not receive a black drop shadow',
);

console.log('Card art loading validation passed.');
