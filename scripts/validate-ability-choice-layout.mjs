import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const dom=new JSDOM(`<!doctype html><html><body>
  <div id="modal" class="modal">
    <div class="box">
      <div class="modalHead"><h2 id="modalTitle"></h2><button id="modalToggle" type="button">Hide</button></div>
      <p id="modalPrompt"></p>
      <div id="choices" class="choices"></div>
    </div>
  </div>
</body></html>`);

globalThis.window=dom.window;
globalThis.document=dom.window.document;
globalThis.$=selector=>dom.window.document.querySelector(selector);
globalThis.state={spread:[],hand:[]};
globalThis.uniqueCards=cards=>cards;
globalThis.applyHint=()=>{};
globalThis.cardHTML=card=>`<span>${card.name}</span>`;
globalThis.applyCardPhoto=()=>{};
globalThis.playSound=()=>{};
globalThis.tlrArchitectureSync=()=>{};

const { choice }=await import('../src/ui/renderAbility.mjs');
const card=(uid,name)=>({uid,id:`major_${uid}`,type:'major',name});

choice('Neighbor','Take 1.',[card(1,'One'),card(2,'Two')],()=>{});
const choices=document.querySelector('#choices');
assert.equal(choices.children.length,2,'the reveal renders both candidate cards');
assert.equal(choices.style.gridTemplateColumns,'repeat(2, minmax(0, 1fr))','a two-card reveal uses two explicit columns');
assert.equal(choices.style.maxWidth,'272px','the compact row stays centered instead of spreading across a desktop modal');
// The layout is pinned inline so a cascade-layer conflict (mobile carousel
// padding on a grid container) can no longer collapse the tracks and stack the
// cards on top of each other.
assert.equal(choices.style.display,'grid','the choice grid owns its display inline');
assert.equal(choices.style.padding,'4px 2px 8px','the reveal neutralizes the carousel padding that collapsed the grid');

choice('Mirror','Take 1.',[card(3,'Three'),card(4,'Four'),card(5,'Five')],()=>{});
assert.equal(choices.style.gridTemplateColumns,'repeat(2, minmax(0, 1fr))','a three-card reveal wraps through the same two-column grid');
assert.equal(choices.lastElementChild.style.gridColumn,'1 / -1','an odd final choice is centered across both columns');

choice('Search','Take 1.',[card(6,'Six'),card(7,'Seven'),card(8,'Eight'),card(9,'Nine'),card(10,'Ten')],()=>{});
assert.equal(choices.style.gridTemplateColumns,'repeat(auto-fit, minmax(104px, 1fr))','larger reveals use an explicit responsive grid, immune to the layered carousel CSS');
assert.equal(choices.style.maxWidth,'','larger card browsers are not constrained to the compact reveal width');

console.log('Ability choice layout checks passed.');
