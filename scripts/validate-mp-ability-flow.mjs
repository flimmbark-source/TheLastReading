// Headless DOM smoke test for the multiplayer singleplayer-style ability flow.
//
// This flow was folded out of the old mpSingleplayerAbilityFlow extension into
// mpGame.mjs. It drives a full relation-ability resolution through the real
// installed game: select a card, pick visible hand/spread anchors via the
// #abilityPrompt, take a revealed card from the shared modal, and assert the
// MP_INVOKE_ABILITY action the game dispatches carries the right choice payload.

import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

import { installDataGlobals } from '../src/app/dataGlobals.mjs';
import { buildDeck } from '../src/systems/deck.mjs';
import { createMatchState } from '../src/multiplayer/mpState.mjs';
import { mpReducer } from '../src/multiplayer/mpReducer.mjs';
import { MP_ACTIONS } from '../src/multiplayer/mpActions.mjs';

const HTML = `<!DOCTYPE html><html><head></head><body>
<div id="mpGame"></div><div id="spread"></div><div id="hand"></div>
<div id="abilityPrompt" class="ability-prompt"><div><h3 id="abilityPromptTitle"></h3><p id="abilityPromptText"></p></div><button id="abilityConfirm" onclick="confirmAbilitySelection()" disabled>Choose</button></div>
<div id="modal" class="modal"><div class="box"><h2 id="modalTitle"></h2><button id="modalToggle">Hide</button><p id="modalPrompt"></p><div id="choices" class="choices"></div></div></div>
</body></html>`;

const dom = new JSDOM(HTML, { pretendToBeVisual: true });
const w = dom.window;
w.matchMedia = () => ({ matches: false });
w.requestAnimationFrame = cb => w.setTimeout(() => cb(Date.now()), 0);
w.playSound = () => {};
// renderCard reads the shared card tables (ROMAN/GLYPH/…) as bare globals,
// resolved against globalThis in Node; mpGame reads them as target.* off the
// window. Install on both. These tables are read-only, so sharing globalThis
// with the other jsdom validators is safe; this script never reassigns the
// shared globalThis.window/document, keeping their jsdom worlds intact.
installDataGlobals(globalThis);
installDataGlobals(w);

// Minimal hand renderer mirroring renderHand's selection contract: one
// .card[data-uid] per card, routing taps to the view's onToggleSelect so the
// game's own selection store (_selected) drives the ability flow.
w.renderHand = function (ability, inPurge, view) {
  const handEl = w.document.getElementById('hand');
  if (!handEl || !view) return;
  handEl.innerHTML = '';
  for (const card of view.hand || []) {
    const el = w.document.createElement('div');
    el.className = 'card' + (view.selected === card.uid ? ' sel' : '');
    el.dataset.uid = card.uid;
    el.onclick = () => view.onToggleSelect?.(card.uid);
    handEl.appendChild(el);
  }
};

const { installMpGame } = await import('../src/app/mpGameHost.mjs');
installMpGame(w);

const cardById = (id, uid) => ({ ...buildDeck().find(c => c.id === id), uid });
const wait = () => new Promise(r => w.setTimeout(r, 5));
const click = el => el?.dispatchEvent(new w.MouseEvent('click', { bubbles: true, cancelable: true }));
const handCard = uid => w.document.querySelector(`#hand .card[data-uid="${uid}"]`);

function startMatch(player0) {
  let s = mpReducer(createMatchState({ scoreTarget: 200 }), { type: MP_ACTIONS.MP_INIT, scoreTarget: 200 });
  s = { ...s, players: [{ ...s.players[0], ...player0 }, s.players[1]] };
  let dispatched = null;
  w.tlrMpGetState = () => s;
  w.tlrMpGetRole = () => 'host';
  w.tlrMpDispatch = a => { dispatched = a; };
  w.tlrMpOnMatchStart(s, { role: 'host' });
  return () => dispatched;
}

// --- NEIGHBOR: single visible anchor (count 1) ---
{
  const source = { ...cardById('major_9', 9010), ability: 'NEIGHBOR_2' }; // anchor major_10 -> neighbors major_9/major_11
  const anchor = cardById('major_10', 9011);
  const found = cardById('major_11', 9012);
  const getDispatched = startMatch({ hand: [source, anchor], deck: [found], discards: 2 });
  await wait();

  click(handCard(source.uid));
  await wait();
  w.tlrMpInvoke();
  await wait();

  assert.ok(w.document.getElementById('abilityPrompt').classList.contains('show'), 'NEIGHBOR shows the ability prompt');
  assert.ok(handCard(anchor.uid).classList.contains('ability-target'), 'NEIGHBOR glows the valid anchor');
  assert.ok(handCard(source.uid).classList.contains('ability-disabled'), 'NEIGHBOR disables the source card');

  click(handCard(anchor.uid));
  await wait();
  assert.ok(handCard(anchor.uid).classList.contains('ability-picked'), 'tapping the anchor marks it picked');
  assert.ok(!w.document.getElementById('abilityConfirm').disabled, 'confirm enables once the anchor is picked');

  click(w.document.getElementById('abilityConfirm'));
  await wait();
  const choices = [...w.document.querySelectorAll('#choices .card')];
  assert.ok(choices.length >= 1, 'take modal lists the revealed card');
  click(choices.find(el => Number(el.querySelector?.('[data-uid]')?.dataset?.uid) === found.uid) || choices[0]);
  await wait();

  const dispatched = getDispatched();
  assert.equal(dispatched?.type, MP_ACTIONS.MP_SUBMIT_ACTION, 'NEIGHBOR submits an action');
  assert.equal(dispatched?.action?.type, MP_ACTIONS.MP_INVOKE_ABILITY, 'NEIGHBOR invokes the ability');
  assert.equal(dispatched?.action?.cardUid, source.uid, 'NEIGHBOR invokes the source card');
  assert.deepEqual(dispatched?.action?.abilityChoice?.anchorUids, [anchor.uid], 'NEIGHBOR carries the chosen anchor');
  assert.equal(dispatched?.action?.abilityChoice?.takenCardUid, found.uid, 'NEIGHBOR carries the taken card');
}

// --- BETWEEN: two visible anchors (count 2) ---
{
  const source = { ...cardById('major_14', 9020), ability: 'BETWEEN_2' };
  const low = cardById('major_5', 9021);
  const high = cardById('major_8', 9022);
  const found = cardById('major_7', 9023); // between major_5 and major_8
  const getDispatched = startMatch({ hand: [source, low, high], deck: [found], discards: 2 });
  await wait();

  click(handCard(source.uid));
  await wait();
  w.tlrMpInvoke();
  await wait();

  assert.ok(w.document.getElementById('abilityPrompt').classList.contains('show'), 'BETWEEN shows the ability prompt');
  click(handCard(low.uid));
  await wait();
  assert.ok(w.document.getElementById('abilityConfirm').disabled, 'BETWEEN keeps confirm disabled with one anchor');
  click(handCard(high.uid));
  await wait();
  assert.ok(!w.document.getElementById('abilityConfirm').disabled, 'BETWEEN enables confirm with both anchors');

  click(w.document.getElementById('abilityConfirm'));
  await wait();
  const choices = [...w.document.querySelectorAll('#choices .card')];
  click(choices.find(el => Number(el.querySelector?.('[data-uid]')?.dataset?.uid) === found.uid) || choices[0]);
  await wait();

  const dispatched = getDispatched();
  assert.equal(dispatched?.action?.type, MP_ACTIONS.MP_INVOKE_ABILITY, 'BETWEEN invokes the ability');
  assert.deepEqual(dispatched?.action?.abilityChoice?.anchorUids?.slice().sort(), [low.uid, high.uid].sort(), 'BETWEEN carries both anchors');
  assert.equal(dispatched?.action?.abilityChoice?.takenCardUid, found.uid, 'BETWEEN carries the taken card');
}

console.log('Multiplayer ability flow checks passed.');
// The installed game keeps a MutationObserver and jsdom timers alive, so exit
// explicitly once the assertions pass. This script is spawned as its own
// process by validate-all.mjs, so the hard exit does not affect other checks.
process.exit(0);
