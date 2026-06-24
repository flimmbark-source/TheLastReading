// Adventure Mode — front-end controller and self-contained play screen.
//
// Reuses the real systems (computeScore, the deck definitions, the hidden
// interpretation + run systems) and the real card art sheets. It runs in its
// own overlay so it never disturbs Score Mode's table flow.
//
// The spread here is a lightweight click-to-place builder rather than the full
// gesture table — enough to exercise the loop end to end for the prototype.

import { ALL_CARD_DEFINITIONS } from '../data/cards.mjs';
import { displayTitle } from '../systems/deck.mjs';
import { applyCardPhoto, CARD_SHEET } from '../ui/renderCard.mjs';
import {
  createAdventureRunState,
  currentEvent,
  resolveEvent,
  applyResolution,
  generateRewardOffers,
  applyReward,
  advanceEvent,
  isRunLost,
  isRecoveryDue,
  applyRecoveryChoice,
  randomUnownedRelic,
  ADVENTURE_RESULTS,
} from '../systems/adventure/run.mjs';
import { RECOVERY_EVENT } from '../data/adventure/events.mjs';
import { REWARD_TYPES } from '../data/adventure/rewards.mjs';
import { getStatus } from '../data/adventure/statuses.mjs';
import { buildHudHtml, buildDebugPanelHtml, isAdventureDebugEnabled } from '../ui/adventure/adventureHud.mjs';

const HAND_SIZE = 8;
const SPREAD_SIZE = 5;
const STYLE_ID = 'adventure-mode-style';
const OVERLAY_ID = 'adventureMode';

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, ch => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]
  ));
}

function shuffle(arr, rng = Math.random) {
  const next = [...arr];
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
}

function ensureStyles(doc) {
  if (!doc || doc.getElementById(STYLE_ID)) return;
  const style = doc.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    #adventureMode{position:fixed;inset:0;z-index:9000;display:none;flex-direction:column;
      background:radial-gradient(120% 120% at 50% 0%,#241a12 0%,#120d0a 70%);
      color:#eadbb9;font-family:Georgia,serif;overflow:auto;padding:18px;gap:14px}
    #adventureMode.adv-open{display:flex}
    .adv-topbar{display:flex;justify-content:space-between;align-items:flex-start;gap:12px}
    .adv-hud{display:flex;flex-wrap:wrap;gap:10px 18px;align-items:center;font:600 14px system-ui,sans-serif}
    .adv-hud__resolve strong{color:#f3c969}
    .adv-hud__statuses{display:flex;gap:6px;flex-wrap:wrap}
    .adv-hud__status{border:1px solid rgba(228,188,111,.5);border-radius:999px;padding:2px 9px;font-size:12px;background:rgba(228,188,111,.08)}
    .adv-hud__status--none{opacity:.5;border-style:dashed}
    .adv-hud__event{font-family:Georgia,serif;font-size:18px;font-weight:800;letter-spacing:.03em;width:100%;color:#f2dfb8}
    .adv-hud__scores{font:700 12px system-ui,sans-serif;color:#d19c51;text-transform:uppercase;letter-spacing:.06em}
    .adv-leave{border:1px solid rgba(228,188,111,.5);background:transparent;color:#e7c07c;border-radius:8px;padding:6px 12px;cursor:pointer;font:700 12px system-ui,sans-serif}
    .adv-desc{max-width:760px;line-height:1.5;color:#d8c8a6;font-size:15px}
    .adv-spread{display:flex;gap:10px;flex-wrap:wrap;min-height:150px;padding:10px;border:1px dashed rgba(228,188,111,.32);border-radius:12px}
    .adv-spread .adv-slot{width:96px;height:140px;border-radius:10px;border:1px solid rgba(228,188,111,.22);
      display:flex;align-items:center;justify-content:center;color:#7d6b4d;font-size:28px;background:rgba(255,255,255,.02)}
    .adv-handlabel,.adv-spreadlabel{font:700 11px system-ui,sans-serif;letter-spacing:.1em;text-transform:uppercase;color:#b89a63;margin-bottom:4px}
    .adv-hand{display:flex;gap:8px;flex-wrap:wrap}
    .adv-card{width:96px;height:140px;border-radius:10px;border:1px solid rgba(228,188,111,.4);
      background:linear-gradient(180deg,#2a1f17,#171008);position:relative;cursor:pointer;overflow:hidden;
      box-shadow:0 6px 14px rgba(0,0,0,.5);transition:transform .12s ease}
    .adv-card:hover{transform:translateY(-4px)}
    .adv-card.photo{background-size:200% 200%;background-repeat:no-repeat}
    .adv-card__title{position:absolute;top:0;left:0;right:0;font:700 9px system-ui,sans-serif;text-align:center;
      padding:3px 2px;background:linear-gradient(180deg,rgba(0,0,0,.7),transparent);color:#f2dfb8;line-height:1.1}
    .adv-card__pts{position:absolute;bottom:4px;right:5px;font:800 12px system-ui,sans-serif;color:#f3c969;text-shadow:0 1px 2px #000}
    .adv-actions{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-top:6px}
    .adv-btn{border:1px solid rgba(228,188,111,.6);background:linear-gradient(180deg,#3a2a1a,#241810);color:#f2dfb8;
      border-radius:9px;padding:10px 18px;cursor:pointer;font:800 14px system-ui,sans-serif;letter-spacing:.03em}
    .adv-btn:disabled{opacity:.4;cursor:not-allowed}
    .adv-btn--primary{border-color:#f3c969;box-shadow:0 0 16px rgba(243,201,105,.25)}
    .adv-panel{max-width:760px;border:1px solid rgba(228,188,111,.4);border-radius:14px;
      background:linear-gradient(180deg,rgba(38,28,21,.96),rgba(15,12,11,.98));padding:20px;display:flex;flex-direction:column;gap:14px}
    .adv-result{font:800 22px Georgia,serif;letter-spacing:.04em}
    .adv-result--success{color:#9fd17f}.adv-result--triumph{color:#f3c969}.adv-result--failure{color:#d98c7f}
    .adv-result__score{font:700 14px system-ui,sans-serif;color:#c9b890;margin-left:10px}
    .adv-narrative{line-height:1.55;font-size:16px;color:#e6d6b4}
    .adv-statuschg{font:700 12px system-ui,sans-serif;letter-spacing:.04em;text-transform:uppercase}
    .adv-statuschg--gain{color:#f3c969}.adv-statuschg--lose{color:#b6a07a}
    .adv-rewards{display:flex;gap:10px;flex-wrap:wrap}
    .adv-reward{flex:1 1 180px;border:1px solid rgba(228,188,111,.4);border-radius:10px;padding:14px;cursor:pointer;
      background:rgba(255,255,255,.03);text-align:center;font:700 14px system-ui,sans-serif;transition:border-color .12s}
    .adv-reward:hover{border-color:#f3c969}
    .adv-reward.adv-reward--picked{border-color:#9fd17f;background:rgba(159,209,127,.12)}
    .adv-reward.adv-reward--disabled{opacity:.35;pointer-events:none}
    .adv-rewardhint{font:600 12px system-ui,sans-serif;color:#b89a63}
    .adv-debug{margin-top:6px;border:1px dashed rgba(120,200,255,.5);border-radius:10px;padding:10px 12px;
      background:rgba(40,60,90,.18);font:600 12px ui-monospace,monospace;color:#bcd6f0;max-width:420px}
    .adv-debug__title{font-weight:800;color:#8fc2ff;margin-bottom:6px}
    .adv-debug__row{display:flex;justify-content:space-between;gap:18px}
    .adv-debug__outcome{margin-top:6px;color:#8fc2ff}
    .adv-bigmsg{font:800 30px Georgia,serif;text-align:center;margin-top:18px}
  `;
  doc.head.appendChild(style);
}

export function installAdventureMode(target = window) {
  if (!target || target.__tlrAdventureInstalled) return;
  target.__tlrAdventureInstalled = true;
  const doc = target.document;

  // Mutable session state for the active run.
  let session = null;

  function overlay() {
    let el = doc.getElementById(OVERLAY_ID);
    if (!el) {
      el = doc.createElement('div');
      el.id = OVERLAY_ID;
      doc.body.appendChild(el);
    }
    return el;
  }

  function cardTileHtml(card, { inSlot = false } = {}) {
    const cls = `adv-card${CARD_SHEET[card.id] ? ' photo' : ''}`;
    return `<div class="${cls}" data-uid="${card.uid}" data-where="${inSlot ? 'spread' : 'hand'}">`
      + `<div class="adv-card__title">${esc(displayTitle(card))}</div>`
      + `<div class="adv-card__pts">${esc(card.points)}</div></div>`;
  }

  function paintPhotos(root) {
    root.querySelectorAll('.adv-card.photo').forEach(el => {
      const uid = Number(el.getAttribute('data-uid'));
      const card = session.byUid.get(uid);
      if (card) applyCardPhoto(el, card);
    });
  }

  function hudHtml() {
    return buildHudHtml({ run: session.run, event: currentEvent(session.run) });
  }

  function topbar() {
    return `<div class="adv-topbar">${hudHtml()}<button class="adv-leave" type="button" data-act="leave">Leave</button></div>`;
  }

  // --- Event (spread building) screen ---
  function renderEvent() {
    const event = currentEvent(session.run);
    const el = overlay();
    const filled = session.spread.filter(Boolean).length;
    const slots = session.spread
      .map((card, i) => (card ? cardTileHtml(card, { inSlot: true }) : `<div class="adv-slot" data-slot="${i}">+</div>`))
      .join('');
    const hand = session.hand.map(card => cardTileHtml(card)).join('');
    el.innerHTML = `
      ${topbar()}
      <div class="adv-desc">${esc(event.description)}</div>
      <div><div class="adv-spreadlabel">Your Reading (${filled}/${SPREAD_SIZE})</div><div class="adv-spread">${slots}</div></div>
      <div><div class="adv-handlabel">Hand — tap a card to lay it; tap a laid card to take it back</div><div class="adv-hand">${hand}</div></div>
      <div class="adv-actions">
        <button class="adv-btn adv-btn--primary" type="button" data-act="cast" ${filled === SPREAD_SIZE ? '' : 'disabled'}>Cast the Reading</button>
        <button class="adv-btn" type="button" data-act="clear">Clear</button>
      </div>`;
    paintPhotos(el);
  }

  // --- Cast → outcome screen ---
  function renderOutcome(resolution) {
    const el = overlay();
    const tierClass = `adv-result--${resolution.tier}`;
    const label =
      resolution.tier === ADVENTURE_RESULTS.TRIUMPH ? 'Triumph'
      : resolution.tier === ADVENTURE_RESULTS.SUCCESS ? 'Success' : 'Failure';
    const event = session.lastEvent;
    const statusBits = [
      ...resolution.gainStatuses.map(id => `<span class="adv-statuschg adv-statuschg--gain">+ ${esc(getStatus(id)?.name || id)}</span>`),
      ...resolution.removeStatuses.map(id => `<span class="adv-statuschg adv-statuschg--lose">– ${esc(getStatus(id)?.name || id)}</span>`),
    ].join(' ');
    const resolveBit = resolution.resolveChange
      ? `<div class="adv-statuschg ${resolution.resolveChange > 0 ? 'adv-statuschg--gain' : 'adv-statuschg--lose'}">Resolve ${resolution.resolveChange > 0 ? '+' : ''}${resolution.resolveChange}</div>`
      : '';
    const debug = isAdventureDebugEnabled(target)
      ? buildDebugPanelHtml({ meanings: resolution.meanings, outcome: resolution.outcome })
      : '';
    el.innerHTML = `
      ${topbar()}
      <div class="adv-panel">
        <div><span class="adv-result ${tierClass}">${label}</span><span class="adv-result__score">${resolution.score} / ${event.targetScore}</span></div>
        <div class="adv-narrative">${esc(resolution.narrative)}</div>
        ${statusBits ? `<div>${statusBits}</div>` : ''}
        ${resolveBit}
        <div class="adv-actions"><button class="adv-btn adv-btn--primary" type="button" data-act="afterOutcome">Continue</button></div>
        ${debug}
      </div>`;
  }

  // --- Reward screen ---
  function renderRewards() {
    const el = overlay();
    const { offers, choose, picked } = session.rewardState;
    const cards = offers.map((offer, i) => {
      const isPicked = picked.includes(i);
      const disabled = !isPicked && picked.length >= choose;
      return `<div class="adv-reward${isPicked ? ' adv-reward--picked' : ''}${disabled ? ' adv-reward--disabled' : ''}" data-reward="${i}">${esc(offer.label)}</div>`;
    }).join('');
    el.innerHTML = `
      ${topbar()}
      <div class="adv-panel">
        <div class="adv-result adv-result--success">Choose your reward${choose > 1 ? `s (${picked.length}/${choose})` : ''}</div>
        <div class="adv-rewards">${cards}</div>
        <div class="adv-actions">
          <button class="adv-btn adv-btn--primary" type="button" data-act="confirmRewards" ${picked.length === choose ? '' : 'disabled'}>Confirm</button>
        </div>
      </div>`;
  }

  // --- Recovery screen ---
  function renderRecovery() {
    const el = overlay();
    const choices = RECOVERY_EVENT.choices
      .map(choice => `<div class="adv-reward" data-recovery="${choice.id}">${esc(choice.label)}</div>`)
      .join('');
    el.innerHTML = `
      ${topbar()}
      <div class="adv-panel">
        <div class="adv-result adv-result--triumph">${esc(RECOVERY_EVENT.title)}</div>
        <div class="adv-narrative">${esc(RECOVERY_EVENT.description)}</div>
        <div class="adv-rewards">${choices}</div>
      </div>`;
  }

  function renderEnd(won) {
    const el = overlay();
    el.innerHTML = `
      ${topbar()}
      <div class="adv-panel">
        <div class="adv-bigmsg">${won ? 'The road is yours.' : 'Your Resolve fails.'}</div>
        <div class="adv-narrative" style="text-align:center">${won
          ? 'You read your way through every trial set before you.'
          : 'The journey ends here — but the cards remember.'}</div>
        <div class="adv-actions" style="justify-content:center">
          <button class="adv-btn adv-btn--primary" type="button" data-act="restart">New Run</button>
          <button class="adv-btn" type="button" data-act="leave">Leave</button>
        </div>
      </div>`;
  }

  // --- Flow helpers ---
  function dealHand() {
    session.spread = Array(SPREAD_SIZE).fill(null);
    session.hand = shuffle(session.deckCards, target.__tlrAdvRng || Math.random).slice(0, HAND_SIZE);
  }

  function nextStep() {
    const run = session.run;
    if (isRunLost(run)) { renderEnd(false); return; }
    if (isRecoveryDue(run)) { renderRecovery(); return; }
    if (run.currentEventIndex >= run.events.length) { renderEnd(true); return; }
    dealHand();
    renderEvent();
  }

  function startRun() {
    const run = createAdventureRunState();
    const deckCards = ALL_CARD_DEFINITIONS.map((card, uid) => ({ ...card, uid }));
    session = {
      run,
      deckCards,
      byUid: new Map(deckCards.map(c => [c.uid, c])),
      hand: [],
      spread: Array(SPREAD_SIZE).fill(null),
      lastEvent: null,
      rewardState: null,
    };
    dealHand();
    renderEvent();
  }

  // --- Interaction ---
  function placeFromHand(uid) {
    const idx = session.hand.findIndex(c => c.uid === uid);
    if (idx < 0) return;
    const slot = session.spread.findIndex(c => !c);
    if (slot < 0) return;
    session.spread[slot] = session.hand[idx];
    session.hand.splice(idx, 1);
    renderEvent();
  }

  function returnToHand(uid) {
    const slot = session.spread.findIndex(c => c && c.uid === uid);
    if (slot < 0) return;
    session.hand.push(session.spread[slot]);
    session.spread[slot] = null;
    renderEvent();
  }

  function cast() {
    const event = currentEvent(session.run);
    session.lastEvent = event;
    const resolution = resolveEvent({ event, spread: session.spread, run: session.run });
    applyResolution(session.run, resolution);
    session.lastResolution = resolution;
    renderOutcome(resolution);
  }

  function afterOutcome() {
    const resolution = session.lastResolution;
    if (resolution.rewardTier) {
      const offers = generateRewardOffers(session.run, resolution.rewardShow, target.__tlrAdvRng || Math.random);
      session.rewardState = { offers, choose: Math.min(resolution.rewardChoose, offers.length), picked: [] };
      renderRewards();
    } else {
      advanceAndContinue();
    }
  }

  function confirmRewards() {
    const { offers, picked } = session.rewardState;
    for (const i of picked) {
      const reward = offers[i];
      applyReward(session.run, reward, {
        relicId: randomUnownedRelic(session.run, target.__tlrAdvRng || Math.random),
        onDeckReward: r => applyDeckReward(r),
      }, target.__tlrAdvRng || Math.random);
    }
    session.rewardState = null;
    advanceAndContinue();
  }

  function applyDeckReward(reward) {
    if (reward.type === REWARD_TYPES.ADD_CARD) {
      const base = ALL_CARD_DEFINITIONS[Math.floor((target.__tlrAdvRng || Math.random)() * ALL_CARD_DEFINITIONS.length)];
      const uid = session.deckCards.length ? Math.max(...session.deckCards.map(c => c.uid)) + 1 : 0;
      const card = { ...base, uid };
      session.deckCards.push(card);
      session.byUid.set(uid, card);
    } else if (reward.type === REWARD_TYPES.REMOVE_CARD && session.deckCards.length > SPREAD_SIZE) {
      const removed = session.deckCards.pop();
      if (removed) session.byUid.delete(removed.uid);
    }
  }

  function advanceAndContinue() {
    advanceEvent(session.run, session.lastEvent?.id);
    nextStep();
  }

  function chooseRecovery(choiceId) {
    applyRecoveryChoice(session.run, choiceId, target.__tlrAdvRng || Math.random);
    nextStep();
  }

  function leave() {
    const el = overlay();
    el.classList.remove('adv-open');
    el.innerHTML = '';
    session = null;
    if (typeof target.tlrReturnToMenu === 'function') target.tlrReturnToMenu();
    else if (typeof target.tlrShowMainMenu === 'function') target.tlrShowMainMenu();
  }

  // Single delegated click handler for the whole overlay.
  function onClick(ev) {
    const t = ev.target.closest('[data-act],[data-slot],[data-reward],[data-recovery],.adv-card');
    if (!t) return;
    if (t.dataset.act) {
      switch (t.dataset.act) {
        case 'cast': cast(); return;
        case 'clear': { session.hand.push(...session.spread.filter(Boolean)); session.spread = Array(SPREAD_SIZE).fill(null); renderEvent(); return; }
        case 'afterOutcome': afterOutcome(); return;
        case 'confirmRewards': confirmRewards(); return;
        case 'restart': startRun(); return;
        case 'leave': leave(); return;
        default: return;
      }
    }
    if (t.dataset.reward != null) {
      const i = Number(t.dataset.reward);
      const state = session.rewardState;
      const at = state.picked.indexOf(i);
      if (at >= 0) state.picked.splice(at, 1);
      else if (state.picked.length < state.choose) state.picked.push(i);
      renderRewards();
      return;
    }
    if (t.dataset.recovery) { chooseRecovery(t.dataset.recovery); return; }
    if (t.classList.contains('adv-card')) {
      const uid = Number(t.getAttribute('data-uid'));
      if (t.getAttribute('data-where') === 'spread') returnToHand(uid);
      else placeFromHand(uid);
    }
  }

  // Public entry point used by the main menu button.
  target.tlrStartAdventure = function () {
    ensureStyles(doc);
    const el = overlay();
    if (!el.__advBound) { el.addEventListener('click', onClick); el.__advBound = true; }
    el.classList.add('adv-open');
    startRun();
  };
}

if (typeof window !== 'undefined') installAdventureMode(window);
