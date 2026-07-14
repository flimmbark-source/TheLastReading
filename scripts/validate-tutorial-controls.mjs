import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { installMenuControls } from '../src/app/menuControls.mjs';

class FakeClassList {
  constructor(values=[]){this.values=new Set(values);}
  contains(value){return this.values.has(value);}
  add(...values){values.forEach(value=>this.values.add(value));}
  remove(...values){values.forEach(value=>this.values.delete(value));}
  toggle(value,force){const enabled=force===undefined?!this.values.has(value):!!force;if(enabled)this.values.add(value);else this.values.delete(value);return enabled;}
}
class BaseElement {}
globalThis.Element=BaseElement;
class FakeElement extends BaseElement {
  constructor(id,classes=[]){super();this.id=id;this.classList=new FakeClassList(classes);this.innerHTML='';this.parent=null;}
  contains(element){for(let current=element;current;current=current.parent){if(current===this)return true;}return false;}
  closest(selector){
    const ids=selector.split(',').map(value=>value.trim()).filter(value=>value.startsWith('#')).map(value=>value.slice(1));
    for(let current=this;current;current=current.parent){if(ids.includes(current.id))return current;}
    return null;
  }
}

const listeners={};
const scoringWrap=new FakeElement('scoringPullWrap',['open']);
const scoringTab=new FakeElement('scoringPullTab');scoringTab.parent=scoringWrap;
const scoringButton=new FakeElement('scoringBtn');
const menuWrap=new FakeElement('menuPullWrap');
const menuTab=new FakeElement('menuPullTab');menuTab.parent=menuWrap;
const outside=new FakeElement('tableSurface');
const elements=new Map([
  ['scoringPullWrap',scoringWrap],['scoringPullTab',scoringTab],['scoringBtn',scoringButton],
  ['menuPullWrap',menuWrap],['menuPullTab',menuTab],
]);
const document={
  scripts:[],
  getElementById(id){return elements.get(id)||null;},
  addEventListener(type,listener,options){(listeners[type]||(listeners[type]=[])).push({listener,capture:options===true||!!options?.capture});},
};
globalThis.document=document;
const target={tlrTogglePullTab(){}};
installMenuControls(target);

const pointerdown=listeners.pointerdown.find(entry=>entry.capture)?.listener;
const click=listeners.click.find(entry=>!entry.capture)?.listener;
assert.equal(typeof pointerdown,'function','scoring-close gesture tracker installed');
assert.equal(typeof click,'function','menu outside-click handler installed');

pointerdown({target:outside});
scoringWrap.classList.remove('open');
menuWrap.classList.add('open');
click({target:outside});
assert.ok(menuWrap.classList.contains('open'),'the scoring-close click cannot immediately close the tutorial-opened Menu');

pointerdown({target:outside});
click({target:outside});
assert.ok(!menuWrap.classList.contains('open'),'a later ordinary outside click still closes Menu');

const renderTableSource=readFileSync(new URL('../src/ui/renderTable.mjs',import.meta.url),'utf8');
assert.ok(!renderTableSource.includes("window.maybeShowHandNavTutorial()"),'the swipe-through-hand tutorial is no longer scheduled');

console.log('Tutorial scoring-close and removed hand-navigation checks passed.');
