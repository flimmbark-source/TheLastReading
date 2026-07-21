import assert from 'node:assert/strict';
import { applyCardPhoto } from '../src/ui/renderCard.mjs';

let imageRequests=0;
const requestedUrls=[];
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
    requestedUrls.push(value);
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
const view={Image:FakeImage,queueMicrotask};
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
assert.equal(first.classList.contains('photo'),true,'photo cards should retain their normal photo presentation');
assert.match(first.style.backgroundImage,/sheet01\.small\.webp/);
assert.equal(imageRequests,10,'the first renderer use should immediately warm all ten small sheets');
assert.equal(new Set(requestedUrls).size,10,'sheet warmup should request each small sheet once');
await firstLoad;
assert.equal(first.dataset.photoReady,'1','the requested art should be marked decoded');

const second=cardElement();
await applyCardPhoto(second,card);
assert.equal(second.dataset.photoReady,'1','cached sheets should render ready immediately');
assert.equal(imageRequests,10,'cards on the same sheet must reuse the existing request/decode');

assert.equal(appendedStyles.length,1,'runtime presentation styles should install once');
assert.doesNotMatch(
  appendedStyles[0].textContent,
  /photo-ready|>\s*\.title|>\s*\.art/,
  'loading must not expose the text-and-symbol card fallback',
);
assert.match(appendedStyles[0].textContent,/slot\.target/,'runtime styles should own the selected-slot treatment');
assert.doesNotMatch(
  appendedStyles[0].textContent.match(/slot\.target\{([\s\S]*?)\}/)?.[1]||'',
  /rgba\(0,0,0/,
  'selected slots should not receive a black drop shadow',
);

console.log('Card art loading validation passed.');
