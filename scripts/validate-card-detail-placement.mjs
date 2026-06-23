import assert from 'node:assert/strict';
import { placeCard, placeCardByUid } from '../src/app/placementRuntime.mjs';

const card={uid:17,points:5};
const state={hand:[card],spread:[null,null,null,null,null],selected:17};
const target={tlrRuntime:{state},__tlrCardDetailOpen:true};

assert.equal(placeCard(0,target),false,'selected-card placement is blocked while card detail is open');
assert.equal(placeCardByUid(17,0,target),false,'explicit drag placement is blocked while card detail is open');
assert.deepEqual(state.hand,[card],'blocked placement leaves the hand unchanged');
assert.deepEqual(state.spread,[null,null,null,null,null],'blocked placement leaves the spread unchanged');
assert.equal(state.selected,17,'blocked placement preserves the current selection');

console.log('Card-detail placement guard checks passed.');
