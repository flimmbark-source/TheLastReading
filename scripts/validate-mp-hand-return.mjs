import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const dom = new JSDOM(`<!doctype html><html><body class="mp-game-active">
  <div id="spread"><div class="slot"></div><div class="slot"></div><div class="slot"></div></div>
  <div id="hand" class="hand"></div>
</body></html>`, { pretendToBeVisual: true });
const w = dom.window;
const doc = w.document;

const raf = callback => { callback(w.performance.now()); return 1; };
w.requestAnimationFrame = raf;
w.cancelAnimationFrame = () => {};
Object.assign(globalThis, {
  window: w,
  document: doc,
  Element: w.Element,
  MutationObserver: w.MutationObserver,
  requestAnimationFrame: raf,
  cancelAnimationFrame: () => {},
  performance: w.performance,
});

globalThis.state = {
  hand: [{ uid: 999 }],
  spread: [null, null, null],
  selected: null,
  busy: false,
  abilitySelect: null,
  purgeSelect: null,
};
let legacyRenders = 0;
globalThis.refreshHandState = () => { throw new Error('multiplayer drag reached single-player refreshHandState'); };
globalThis.render = () => { legacyRenders += 1; };
globalThis.expandCard = () => {};

const { installHandCardGestures } = await import('../src/ui/gestureCard.mjs');
const { installMpHandGestureAdapter } = await import('../src/app/mpHandGestureAdapter.mjs');

const cards = [1, 2, 3].map(uid => ({ uid, id: `card_${uid}` }));
let selected = null;
let match = {
  phase: 'placement',
  pendingActions: [null, null],
  players: [
    { hand: cards.slice(), spread: [null, null, null] },
    { hand: [], spread: [null, null, null] },
  ],
};
let placed = null;

w.tlrMpGetRole = () => 'host';
w.tlrMpGetState = () => match;
w.__handGetTrackState = () => ({
  handRect: { left: 0, top: 250, width: 300, height: 180 },
  radius: 100,
  spacingDeg: 30,
  offsetDeg: 0,
});
w.__handTriggerLayout = () => {};
w.expandCard = () => {};

function cardRect(uid) {
  const index = match.players[0].hand.findIndex(card => card.uid === uid);
  const left = 100 + Math.max(0, index) * 45;
  return { left, right: left + 80, top: 280, bottom: 400, width: 80, height: 120 };
}

function renderHand(_ability, _inPurge, view) {
  const hand = doc.getElementById('hand');
  const existing = new Map([...hand.querySelectorAll(':scope > .card[data-uid]')]
    .map(node => [Number(node.dataset.uid), node]));
  (view?.hand || []).forEach((card, index) => {
    let node = existing.get(card.uid);
    if (node) existing.delete(card.uid);
    else {
      node = doc.createElement('div');
      node.dataset.uid = card.uid;
      Object.defineProperties(node, {
        offsetWidth: { get: () => 80 },
        offsetHeight: { get: () => 120 },
      });
      node.setPointerCapture = () => {};
      node.releasePointerCapture = () => {};
      node.getBoundingClientRect = () => cardRect(card.uid);
    }
    node.className = `card${selected === card.uid ? ' sel' : ''}`;
    node.onclick = () => {
      selected = selected === card.uid ? null : card.uid;
      w.renderHand(null, false, { hand: match.players[0].hand, selected });
    };
    const current = hand.children[index];
    if (current !== node) hand.insertBefore(node, current || null);
  });
  existing.forEach(node => node.remove());
}
w.renderHand = renderHand;

const spread = doc.getElementById('spread');
spread.getBoundingClientRect = () => ({ left: 50, right: 250, top: 40, bottom: 180, width: 200, height: 140 });
[...spread.querySelectorAll('.slot')].forEach((slot, index) => {
  slot.getBoundingClientRect = () => ({ left: 70 + index * 60, right: 120 + index * 60, top: 70, bottom: 150, width: 50, height: 80 });
});

w.placeCardUid = (uid, slotIndex) => {
  placed = { uid, slotIndex };
  const hand = match.players[0].hand.filter(card => card.uid !== uid);
  const spreadCards = match.players[0].spread.slice();
  spreadCards[slotIndex] = cards.find(card => card.uid === uid);
  match = {
    ...match,
    players: [{ ...match.players[0], hand, spread: spreadCards }, match.players[1]],
  };
  w.renderHand(null, false, { hand, selected: null });
};

installMpHandGestureAdapter(w);
w.renderHand(null, false, { hand: cards, selected: null });
installHandCardGestures(w);

function pointer(target, type, clientX, clientY, pointerId = 1) {
  const event = new w.MouseEvent(type, { bubbles: true, cancelable: true, clientX, clientY });
  Object.defineProperty(event, 'pointerId', { value: pointerId });
  target.dispatchEvent(event);
  return event;
}

function handUids() {
  return [...doc.querySelectorAll('#hand > .card[data-uid]')].map(card => Number(card.dataset.uid));
}

match = { ...match, players: [{ ...match.players[0], hand: [cards[0]] }, match.players[1]] };
selected = null;
w.renderHand(null, false, { hand: [cards[0]], selected: null });
let card = doc.querySelector('#hand > .card[data-uid="1"]');
pointer(card, 'pointerdown', 140, 320);
pointer(card, 'pointermove', 140, 350);
assert.equal(card.parentElement, doc.body, 'active drag temporarily lifts the card to body');
pointer(card, 'pointerup', 140, 350);
assert.equal(card.parentElement, doc.getElementById('hand'), 'same-position drop restores the dragged node to hand');
assert.deepEqual(handUids(), [1], 'same-position return leaves one stable card in hand');
assert.equal(legacyRenders, 0, 'same-position return never invokes single-player render');
assert.deepEqual(globalThis.state.hand.map(item => item.uid), [999], 'single-player hand state remains untouched');

match = { ...match, players: [{ ...match.players[0], hand: cards.slice(), spread: [null, null, null] }, match.players[1]] };
selected = null;
w.renderHand(null, false, { hand: cards, selected: null });
card = doc.querySelector('#hand > .card[data-uid="1"]');
pointer(card, 'pointerdown', 140, 320, 2);
pointer(card, 'pointermove', 245, 330, 2);
pointer(card, 'pointerup', 245, 330, 2);
assert.deepEqual(handUids(), [2, 3, 1], 'duel reorder commits through the multiplayer adapter');
w.renderHand(null, false, { hand: cards, selected: null });
assert.deepEqual(handUids(), [2, 3, 1], 'duel order survives later multiplayer renders');
assert.equal(legacyRenders, 0, 'duel reorder never invokes single-player render');

placed = null;
card = doc.querySelector('#hand > .card[data-uid="2"]');
pointer(card, 'pointerdown', 185, 320, 3);
pointer(card, 'pointermove', 95, 105, 3);
pointer(card, 'pointerup', 95, 105, 3);
assert.deepEqual(placed, { uid: 2, slotIndex: 0 }, 'spread drop commits through multiplayer placeCardUid');
assert.equal(globalThis.state.spread.every(slot => slot === null), true, 'single-player spread state remains untouched');

console.log('Multiplayer hand adapter gesture checks passed.');
