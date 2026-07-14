import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { calculateCardActivationMotion, installCardActivationFx } from '../src/ui/cardActivationFx.mjs';

const motion=calculateCardActivationMotion({
  startRect:{left:140,top:700,width:100,height:150},
  vector:{x:0,y:1,speed:1100},
  viewportWidth:390,
  viewportHeight:844,
});
assert.ok(Number.isFinite(motion.dx)&&Number.isFinite(motion.dy),'activation motion is finite');
assert.ok(motion.dy<0,'a bottom-edge activation returns into the visible play area');
assert.ok(motion.anchorY<=844*.60,'activation anchor stays out of the bottom table rim');

const gestureSource=readFileSync(new URL('../src/ui/gestureCard.mjs',import.meta.url),'utf8');
const fxSource=readFileSync(new URL('../src/ui/cardActivationFx.mjs',import.meta.url),'utf8');
assert.ok(gestureSource.includes('installCardActivationFx(target)'),'gesture installs the activation coordinator');
assert.ok(gestureSource.includes('tlrPrepareCardActivation'),'card visual is prepared before release');
assert.ok(gestureSource.includes('tlrActivateCardFromGesture'),'gesture delegates activation instead of resolving gameplay');
assert.ok(!gestureSource.includes('cloneNode('),'release path no longer deep-clones the live card');
assert.ok(!gestureSource.includes('FLICK_ABILITY_DELAY_MS'),'gameplay no longer runs on an overlapping guessed timer');
assert.ok(!gestureSource.includes('mixBlendMode'),'gesture no longer creates screen-blended burst DOM');
assert.ok(!gestureSource.includes('drop-shadow'),'armed drag feedback avoids live blur filters');
assert.ok(fxSource.includes('contain:layout paint style'),'permanent FX layer contains layout and paint work');
assert.ok(fxSource.includes('isolation:isolate'),'FX compositing is isolated from the table');
assert.ok(!fxSource.includes('mix-blend-mode'),'activation FX avoids blend-mode compositing');
assert.ok(!fxSource.includes('drop-shadow'),'activation flight avoids live blur filters');
const playIndex=fxSource.indexOf('await playCardActivation');
const discardIndex=fxSource.indexOf('target.discardCardUid(uid)');
assert.ok(playIndex>=0&&discardIndex>playIndex,'gameplay commit occurs after presentation completion');

globalThis.ROMAN=['0'];
globalThis.GLYPH={Cups:'C'};
globalThis.MEAN={};
globalThis.COURT_MEAN={};
globalThis.SUIT_MEAN={Cups:['','']};
globalThis.MAJOR_G=['M'];
globalThis.TXT={DRAW_1:'DRAW 1'};
globalThis.RANKS=[];

class FakeStyle{
  constructor(){this.values=new Map();}
  setProperty(name,value){this.values.set(name,String(value));}
  removeProperty(name){this.values.delete(name);}
  set cssText(_value){this.values.clear();}
  get cssText(){return [...this.values].map(([name,value])=>`${name}:${value}`).join(';');}
}
class FakeClassList{
  constructor(owner){this.owner=owner;this.values=new Set();}
  add(...names){names.forEach(name=>this.values.add(name));this.sync();}
  remove(...names){names.forEach(name=>this.values.delete(name));this.sync();}
  toggle(name,force){const enabled=force===undefined?!this.values.has(name):!!force;enabled?this.values.add(name):this.values.delete(name);this.sync();return enabled;}
  contains(name){return this.values.has(name);}
  sync(){this.owner._className=[...this.values].join(' ');}
}
const animationResolvers=[];
class FakeElement{
  constructor(tag){
    this.tagName=String(tag).toUpperCase();this.children=[];this.parentNode=null;this.style=new FakeStyle();
    this.dataset={};this.attributes=new Map();this.classList=new FakeClassList(this);this._className='';this.id='';this.innerHTML='';
  }
  set className(value){this._className=String(value);this.classList.values=new Set(this._className.split(/\s+/).filter(Boolean));}
  get className(){return this._className;}
  append(...elements){for(const element of elements){element.parentNode=this;this.children.push(element);}}
  appendChild(element){this.append(element);return element;}
  setAttribute(name,value){this.attributes.set(name,String(value));if(name==='id')this.id=String(value);}
  querySelector(selector){
    const matches=element=>selector.startsWith('.')?element.classList.contains(selector.slice(1)):selector.startsWith('#')?element.id===selector.slice(1):false;
    const walk=node=>{for(const child of node.children){if(matches(child))return child;const nested=walk(child);if(nested)return nested;}return null;};
    return walk(this);
  }
  animate(){
    let resolve;
    const finished=new Promise(done=>{resolve=done;});
    const animation={finished,cancel(){resolve();}};
    animationResolvers.push(resolve);
    return animation;
  }
  getAnimations(){return[];}
}
class FakeDocument{
  constructor(){this.head=new FakeElement('head');this.body=new FakeElement('body');}
  createElement(tag){return new FakeElement(tag);}
  getElementById(id){
    const walk=node=>{if(node.id===id)return node;for(const child of node.children){const found=walk(child);if(found)return found;}return null;};
    return walk(this.head)||walk(this.body);
  }
}

const document=new FakeDocument();
let discardCount=0;
const target={
  document,innerWidth:390,innerHeight:844,
  requestAnimationFrame(callback){queueMicrotask(()=>callback(0));return 1;},
  matchMedia(){return{matches:false};},
  canDiscardCardUid(){return true;},
  discardCardUid(){discardCount+=1;return true;},
  render(){throw new Error('successful activation should not need rollback render');},
};
const api=installCardActivationFx(target);
const card={uid:1,id:'major_0',type:'major',name:'The Fool',num:0,points:5,ability:'DRAW_1'};
assert.equal(api.prepare(card),true,'activation proxy can be prepared before release');
const activation=api.activate({cardUid:1,card,startRect:{left:100,top:650,width:100,height:150},vector:{x:0,y:1,speed:1000},startTiltDeg:4});
await new Promise(resolve=>setTimeout(resolve,0));
assert.equal(discardCount,0,'gameplay remains uncommitted while the animation is running');
assert.equal(target.__tlrCardActivationPending,true,'activation transaction locks input');
assert.equal(animationResolvers.length,2,'card flight and burst animations both start');
animationResolvers.splice(0).forEach(resolve=>resolve());
assert.equal(await activation,true,'activation resolves successfully');
assert.equal(discardCount,1,'gameplay commits once after animation completion');
assert.equal(target.__tlrCardActivationPending,false,'activation transaction releases input');
assert.equal(document.body.children.filter(child=>child.id==='tlrCardActivationLayer').length,1,'one permanent effects layer is reused');

console.log('Card activation architecture checks passed.');
