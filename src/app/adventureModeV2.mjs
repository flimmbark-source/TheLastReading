// Adventure Mode V2 — one card resolves one Event; five Events fill one Set.
// This controller deliberately reuses the existing table, hand, abilities,
// discard system and card deck while replacing only Adventure resolution and
// progression.

import { installGeneratedSheetAssets } from '../ui/generatedSheetAssets.mjs';
import { createInitialPersist, createInitialState } from './runtimeState.mjs';
import { ALL_CARD_DEFINITIONS } from '../data/cards.mjs';
import { RECOVERY_EVENT } from '../data/adventure/events.mjs';
import { getStatus } from '../data/adventure/statuses.mjs';
import { REWARD_TYPES } from '../data/adventure/rewards.mjs';
import {
  applyResolution,
  generateRewardOffers,
  applyReward,
  applyRecoveryChoice,
  randomUnownedRelic,
} from '../systems/adventure/run.mjs';
import {
  SINGLE_CARD_RESULTS,
  EVENTS_PER_SET,
  TOTAL_SETS,
  createSingleCardRunState,
  currentSingleCardEvent,
  addCardToAdventureDeck,
  removeCardFromAdventureDeck,
  resolveSingleCardEvent,
  recordSingleCardPlay,
  isCurrentSetComplete,
  completeCurrentSet,
  beginNextSet,
  isAdventureRunComplete,
  setEchoText,
} from '../systems/adventure/singleCardRun.mjs';

const STYLE_ID = 'adventure-mode-v2-style';
const MODE_CLASS = 'mode-adventure';
const TABLE_CLASSES = ['single-player-v2', 'generated-sheet-ready', 'mode-reading'];
const CARD_BY_ID = new Map(ALL_CARD_DEFINITIONS.map(card => [card.id, card]));

// Painted Event card faces (sliced from Events-page1-3). Each face already
// carries the title, art and node glyph, so the deck just renders the image.
const EVENT_ART_BASE = '/public/ui/single-player-v2/events/';
const EVENT_ART_IDS = new Set([
  'iron_gate', 'ambush', 'strange_shrine', 'flooded_road',
  'cornered_beast', 'traveling_merchant', 'suspicious_villagers', 'unmarked_grave',
  'beneath_the_floor', 'whispering_tree', 'recovery_camp', 'woman_in_the_well',
]);
function eventArtUrl(id) {
  return EVENT_ART_IDS.has(id) ? `${EVENT_ART_BASE}${id}.webp` : null;
}

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, ch => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]
  ));
}

function ensureStyles(doc) {
  if (!doc || doc.getElementById(STYLE_ID)) return;
  const style = doc.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    body.mode-adventure .score-stack,
    body.mode-adventure #constellationPill,
    body.mode-adventure #scoringBtn{display:none!important}

    #advEventDeck{position:fixed;top:48px;left:50%;transform:translateX(-50%);z-index:26;
      display:none;flex-direction:column;align-items:center;gap:0;pointer-events:none;
      font-family:Georgia,serif;color:#f2dfb8}
    body.mode-adventure #advEventDeck{display:flex}
    .adv-deck{position:relative;width:128px;height:170px}
    .adv-deck__back{position:absolute;width:96px;height:150px;border-radius:8px;left:50%;top:10px;
      background:linear-gradient(160deg,#3a2a1a,#160d07);border:1px solid rgba(228,188,111,.45);box-shadow:0 4px 10px rgba(0,0,0,.5)}
    .adv-deck__top{position:absolute;left:50%;top:0;transform:translateX(-50%);width:110px;height:170px;border-radius:10px;
      overflow:hidden;box-shadow:0 8px 22px rgba(0,0,0,.6),0 0 18px rgba(243,201,105,.18)}
    .adv-deck__art{display:block;width:100%;height:100%;object-fit:cover}
    .adv-deck__top--text{background:linear-gradient(165deg,#2a1810,#140907);border:2px solid #9a7842;
      display:flex;align-items:center;justify-content:center;text-align:center;padding:8px}
    .adv-deck__title{font:800 13px Georgia,serif;line-height:1.1;color:#f2dfb8}
    .adv-event-desc{max-width:310px;text-align:center;font:500 11px Georgia,serif;line-height:1.4;color:#d8c8a6;
      background:rgba(18,12,9,.66);border-radius:8px;padding:6px 10px;margin-top:-14px}
    .adv-next-event{font:700 9px system-ui,sans-serif;color:#d19c51;opacity:.9}

    #advHud{position:fixed;top:10px;left:10px;z-index:42;display:none;flex-direction:column;gap:4px;
      color:#ead9b5;max-width:min(360px,46vw)}
    body.mode-adventure #advHud{display:flex}
    .adv-hud__main{display:flex;align-items:center;gap:11px;
      background:linear-gradient(180deg,rgba(30,21,13,.93),rgba(17,11,7,.92));
      border:1px solid rgba(228,188,111,.34);border-radius:12px;padding:7px 11px;
      box-shadow:0 6px 18px rgba(0,0,0,.55),inset 0 1px 0 rgba(255,225,170,.07)}
    .adv-hud__resolve{display:flex;align-items:center;gap:8px}
    .adv-hud__label{font:800 9px/1 'Cinzel',Georgia,serif;letter-spacing:.17em;text-transform:uppercase;color:#bd9c63}
    .adv-pips{display:flex;gap:3px}
    .adv-pip{width:10px;height:10px;border-radius:50%;border:1px solid rgba(243,201,105,.45)}
    .adv-pip--full{background:radial-gradient(circle at 38% 32%,#ffeab2,#dd9f33);border-color:#f3c969;box-shadow:0 0 6px rgba(243,201,105,.55)}
    .adv-pip--empty{background:rgba(243,201,105,.05)}
    .adv-hud__statuses{display:flex;flex-direction:column;align-items:center;gap:5px}
    .adv-hud__statuses:empty{display:none}
    .adv-hud__status-row{display:flex;gap:5px;justify-content:center}
    #advHud .adv-status{display:inline-flex;align-items:center;gap:6px;border-radius:999px;padding:3px 10px 3px 8px;
      font:700 10px/1 'Cinzel',Georgia,serif;letter-spacing:.05em;border:1px solid;background:rgba(16,11,7,.82)}
    #advHud .adv-status::before{content:'';width:7px;height:7px;border-radius:50%}
    .adv-status--blessed{color:#f6d488;border-color:rgba(243,201,105,.5)}.adv-status--blessed::before{background:#f3c969;box-shadow:0 0 6px #f3c969}
    .adv-status--haunted{color:#c7adef;border-color:rgba(169,139,214,.5)}.adv-status--haunted::before{background:#a98bd6;box-shadow:0 0 6px #a98bd6}
    .adv-status--prepared{color:#9fcdf2;border-color:rgba(127,182,224,.5)}.adv-status--prepared::before{background:#7fb6e0;box-shadow:0 0 6px #7fb6e0}
    .adv-status--distrusted{color:#e89e96;border-color:rgba(210,104,95,.5)}.adv-status--distrusted::before{background:#d2685f;box-shadow:0 0 6px #d2685f}
    .adv-status--exposed{color:#f0b078;border-color:rgba(224,154,90,.5)}.adv-status--exposed::before{background:#e09a5a;box-shadow:0 0 6px #e09a5a}

    .adv-narrative{line-height:1.5;font-size:15px;color:#e6d6b4;margin:8px 0 4px;text-align:center}
    .adv-played-card{text-align:center;color:#a99878;font:700 11px system-ui,sans-serif;letter-spacing:.04em;text-transform:uppercase}
    .adv-statuschg{font:700 12px system-ui,sans-serif;letter-spacing:.04em;text-transform:uppercase;text-align:center;margin-top:4px}
    .adv-statuschg--gain{color:#f3c969}.adv-statuschg--lose{color:#b6a07a}
    .adv-rewards{display:flex;gap:10px;flex-wrap:wrap;justify-content:center;margin:6px 0}
    .adv-reward{flex:1 1 150px;min-width:140px;border:1px solid rgba(228,188,111,.4);border-radius:10px;padding:13px;cursor:pointer;
      background:rgba(255,255,255,.03);text-align:center;font:700 13px system-ui,sans-serif;color:#eadbb9}
    .adv-reward:hover{border-color:#f3c969}
    .adv-reward--picked{border-color:#9fd17f;background:rgba(159,209,127,.12)}
    .adv-reward--disabled{opacity:.35;pointer-events:none}

    @media(max-width:640px){
      #advEventDeck{top:20px}.adv-event-desc{max-width:245px;font-size:10px}
      #advHud{max-width:64vw}.adv-hud__main{padding:6px 9px}
      .adv-deck{transform:scale(.92);transform-origin:top center}
    }
  `;
  doc.head.appendChild(style);
}

export function installAdventureModeV2(target = window) {
  if (!target || target.__tlrAdventureV2Installed) return;
  target.__tlrAdventureV2Installed = true;
  const doc = target.document;
  const rng = () => (target.__tlrAdvRng || Math.random)();

  let session = null;
  let liveBackup = null;

  function setBusy(value) {
    if (target.state) target.state.busy = value;
    if (target.tlrStore && target.tlrActions) {
      target.tlrStore.dispatch({ type: target.tlrActions.SET_BUSY, busy: value });
    }
  }

  function captureLiveBackupOnce() {
    if (liveBackup) return;
    liveBackup = {
      persist: target.persist,
      state: target.state,
      runtimePersist: target.tlrRuntime?.persist,
      runtimeState: target.tlrRuntime?.state,
      storePersist: target.tlrStore?.getState?.().persist || null,
      storeRun: target.tlrStore?.getState?.().run || null,
    };
  }

  function installFreshProfile() {
    target.persist = createInitialPersist();
    target.state = createInitialState();
    if (target.tlrRuntime) {
      target.tlrRuntime.persist = target.persist;
      target.tlrRuntime.state = target.state;
    }
  }

  function restoreLiveBackup() {
    if (!liveBackup) return;
    target.persist = liveBackup.persist;
    target.state = liveBackup.state;
    if (target.tlrRuntime) {
      target.tlrRuntime.persist = liveBackup.runtimePersist || liveBackup.persist;
      target.tlrRuntime.state = liveBackup.runtimeState || liveBackup.state;
    }
    if (target.tlrStore && target.tlrActions) {
      if (liveBackup.storePersist) {
        target.tlrStore.dispatch({ type: target.tlrActions.SYNC_LEGACY_PERSIST, persist: liveBackup.storePersist });
      }
      if (liveBackup.storeRun) {
        target.tlrStore.dispatch({ type: target.tlrActions.SYNC_LEGACY_RUN, run: liveBackup.storeRun });
      }
    }
    liveBackup = null;
  }

  function forceTable() {
    if (!doc || !session) return;
    const body = doc.body;
    body.classList.remove('mp-game-active', 'mode-attic', 'mode-to-attic', 'mode-to-table', 'mode-table-return', 'mode-return-hard-hide');
    session.addedClasses = [];
    for (const cls of [...TABLE_CLASSES, MODE_CLASS]) {
      if (!body.classList.contains(cls)) {
        body.classList.add(cls);
        session.addedClasses.push(cls);
      }
    }
    for (const [id, cls] of [['mpGame', 'mp-hidden'], ['loadoutScreen', 'loadout-hidden'], ['matchmakingScreen', 'mm-screen-hidden']]) {
      doc.getElementById(id)?.classList.add(cls);
    }
    doc.getElementById('atticScene')?.setAttribute('aria-hidden', 'true');
    try { if (target.Image) installGeneratedSheetAssets(target); } catch { /* asset layer is optional */ }
  }

  function ensureChrome() {
    if (!doc) return;
    if (!doc.getElementById('advEventDeck')) {
      const deck = doc.createElement('div');
      deck.id = 'advEventDeck';
      doc.body.appendChild(deck);
    }
    if (!doc.getElementById('advHud')) {
      const hud = doc.createElement('div');
      hud.id = 'advHud';
      doc.body.appendChild(hud);
      hud.addEventListener('click', event => {
        if (event.target.closest('[data-adv-leave]')) leave();
      });
    }
  }

  function currentEvent() {
    return session ? currentSingleCardEvent(session.run) : null;
  }

  function updateChrome() {
    if (!doc || !session) return;
    const run = session.run;
    const event = currentEvent();
    const deck = doc.getElementById('advEventDeck');
    if (deck) {
      // The interaction-FX bridge identifies the Event from here; expose the id
      // directly so it never depends on the card face's rendered text.
      deck.dataset.eventId = event?.id || '';
      if (!event) {
        deck.innerHTML = '';
      } else {
        const remaining = Math.max(1, EVENTS_PER_SET - run.eventIndexInSet);
        const backs = [...Array(Math.min(3, remaining)).keys()]
          .map(i => `<div class="adv-deck__back" style="transform:translate(calc(-50% + ${i * 4}px),${i * 3}px) rotate(${i * 2 - 2}deg)"></div>`)
          .join('');
        const prepared = run.statuses.includes('prepared');
        const nextId = run.eventDeck[run.eventIndexInSet + 1];
        const next = prepared && nextId
          ? `<div class="adv-next-event">Next: ${esc(nextId.replaceAll('_', ' '))}</div>` : '';
        const art = eventArtUrl(event.id);
        const top = art
          ? `<div class="adv-deck__top"><img class="adv-deck__art" src="${art}" alt="${esc(event.title)}" decoding="async"></div>`
          : `<div class="adv-deck__top adv-deck__top--text"><div class="adv-deck__title">${esc(event.title)}</div></div>`;
        deck.innerHTML = `
          <div class="adv-deck">${backs}${top}</div>
          <div class="adv-event-desc">${esc(event.description)}</div>${next}`;
      }
    }

    const hud = doc.getElementById('advHud');
    if (hud) {
      const pips = [...Array(Math.max(0, run.maxResolve)).keys()]
        .map(i => `<span class="adv-pip adv-pip--${i < run.resolve ? 'full' : 'empty'}"></span>`)
        .join('');
      const pill = id => `<span class="adv-status adv-status--${esc(id)}" title="${esc(getStatus(id)?.description || '')}">${esc(getStatus(id)?.name || id)}</span>`;
      const s = run.statuses;
      const rows = s.length === 0 ? [] :
        s.length <= 2 ? [s] :
        s.length === 3 ? [[s[2]], [s[0], s[1]]] :
        [[s[2], s[3]], [s[0], s[1]]];
      const statusHtml = rows.map(row => `<div class="adv-hud__status-row">${row.map(pill).join('')}</div>`).join('');
      hud.innerHTML = `
        <div class="adv-hud__statuses">${statusHtml}</div>
        <div class="adv-hud__main">
          <div class="adv-hud__resolve"><span class="adv-hud__label">Resolve</span><span class="adv-pips" title="Resolve ${run.resolve} / ${run.maxResolve}">${pips}</span></div>
        </div>`;
    }
  }

  function show(html) {
    if (typeof target.showOverlay === 'function') target.showOverlay(html);
    else {
      const summary = doc.getElementById('summary');
      if (summary) { summary.className = 'modal show'; summary.innerHTML = html; }
    }
  }

  function clear() {
    if (typeof target.clearOverlay === 'function') target.clearOverlay();
    else {
      const summary = doc.getElementById('summary');
      if (summary) { summary.className = ''; summary.innerHTML = ''; }
    }
  }

  function showOutcome(resolution, card) {
    const failed = resolution.tier === SINGLE_CARD_RESULTS.FAILURE;
    const great = resolution.tier === SINGLE_CARD_RESULTS.GREAT_SUCCESS;
    const label = failed ? 'Failure' : great ? 'Great Success' : 'Success';
    const statusBits = [
      ...resolution.gainStatuses.map(id => `<span class="adv-statuschg adv-statuschg--gain">+ ${esc(getStatus(id)?.name || id)}</span>`),
      ...resolution.removeStatuses.map(id => `<span class="adv-statuschg adv-statuschg--lose">− ${esc(getStatus(id)?.name || id)}</span>`),
    ].join(' ');
    const resolveBit = resolution.resolveChange
      ? `<div class="adv-statuschg ${resolution.resolveChange > 0 ? 'adv-statuschg--gain' : 'adv-statuschg--lose'}">Resolve ${resolution.resolveChange > 0 ? '+' : ''}${resolution.resolveChange}</div>`
      : '';
    show(`<div class="result-panel ${failed ? 'fail' : 'pass'}">
      <div class="rhead"><h3 class="${failed ? 'fail' : 'pass'}">${label}</h3></div>
      <div class="adv-played-card">${esc(card.name)} · Potency ${card.points}</div>
      <p class="adv-narrative">${esc(resolution.narrative)}</p>
      ${statusBits ? `<div>${statusBits}</div>` : ''}${resolveBit}
      <div class="rbtns"><button class="btn-gold" onclick="tlrAdventureV2AfterOutcome()">Continue</button></div>
    </div>`);
  }

  function showRewards() {
    const { offers, choose, picked } = session.rewardState;
    const cards = offers.map((offer, index) => {
      const selected = picked.includes(index);
      const disabled = !selected && picked.length >= choose;
      return `<div class="adv-reward${selected ? ' adv-reward--picked' : ''}${disabled ? ' adv-reward--disabled' : ''}" onclick="tlrAdventureV2PickReward(${index})">${esc(offer.label)}</div>`;
    }).join('');
    show(`<div class="result-panel pass">
      <div class="rhead"><h3 class="pass">Choose your reward${choose > 1 ? `s (${picked.length}/${choose})` : ''}</h3></div>
      <div class="adv-rewards">${cards}</div>
      <div class="rbtns"><button class="btn-gold" onclick="tlrAdventureV2ConfirmRewards()" ${picked.length === choose ? '' : 'disabled'}>Confirm</button></div>
    </div>`);
  }

  function showRecovery() {
    const choices = RECOVERY_EVENT.choices
      .map(choice => `<div class="adv-reward" onclick="tlrAdventureV2Recovery('${choice.id}')">${esc(choice.label)}</div>`)
      .join('');
    show(`<div class="result-panel pass">
      <div class="rhead"><h3 class="pass">${esc(RECOVERY_EVENT.title)}</h3></div>
      <p class="adv-narrative">${esc(RECOVERY_EVENT.description)}</p>
      <div class="adv-rewards">${choices}</div>
    </div>`);
  }

  function showSetTransition(profile) {
    show(`<div class="result-panel pass">
      <div class="rhead"><h3 class="pass">The Spread Is Complete</h3></div>
      <p class="adv-narrative">${esc(setEchoText(profile))}</p>
      <div class="rbtns"><button class="btn-gold" onclick="tlrAdventureV2ShowRecovery()">Continue</button></div>
    </div>`);
  }

  function showEnd(won) {
    setBusy(true);
    show(`<div class="result-panel ${won ? 'pass' : 'fail'}">
      <div class="rhead"><h3 class="${won ? 'pass' : 'fail'}">${won ? 'The Road Remembers You' : 'Your Resolve Fails'}</h3></div>
      <p class="adv-narrative">${won
        ? 'Two completed spreads have changed the road behind you and the road ahead.'
        : 'The journey ends here, but the cards remember how you travelled.'}</p>
      <div class="rbtns"><button class="btn-gold" onclick="tlrAdventureV2Restart()">New Run</button><button onclick="tlrAdventureV2Leave()">Leave</button></div>
    </div>`);
  }

  function buildAdventureDeckCards() {
    return session.run.deck.map((id, uid) => ({ ...CARD_BY_ID.get(id), uid }));
  }

  function addPool(size = 3) {
    const pool = [];
    const used = new Set();
    let guard = 0;
    while (pool.length < size && guard < 100) {
      guard += 1;
      const definition = ALL_CARD_DEFINITIONS[Math.floor(rng() * ALL_CARD_DEFINITIONS.length)];
      if (!definition || used.has(definition.id)) continue;
      used.add(definition.id);
      pool.push({ ...definition, uid: 9000 + pool.length });
    }
    return pool;
  }

  function pickCardToRemove(done) {
    const cards = buildAdventureDeckCards();
    if (typeof target.choice !== 'function' || !cards.length) { done(); return; }
    const ordered = typeof target.sortCards === 'function' ? target.sortCards(cards) : cards;
    clear();
    target.choice('Remove a Card', 'Choose a card to remove from your deck.', ordered, picked => {
      removeCardFromAdventureDeck(session.run, picked.id);
      updateChrome();
      done();
    });
  }

  function pickCardToAdd(done) {
    const pool = addPool();
    if (typeof target.choice !== 'function' || !pool.length) { done(); return; }
    clear();
    target.choice('Add a Card', 'Choose a card to add to your deck.', pool, picked => {
      addCardToAdventureDeck(session.run, picked.id);
      updateChrome();
      done();
    });
  }

  function applyRewardsSequentially(rewards, index) {
    if (index >= rewards.length) { session.rewardState = null; advanceAfterResolution(); return; }
    const reward = rewards[index];
    const next = () => applyRewardsSequentially(rewards, index + 1);
    if (reward.type === REWARD_TYPES.REMOVE_CARD) { pickCardToRemove(next); return; }
    if (reward.type === REWARD_TYPES.ADD_CARD) { pickCardToAdd(next); return; }
    applyReward(session.run, reward, { relicId: randomUnownedRelic(session.run, rng) }, rng);
    updateChrome();
    next();
  }

  function advanceAfterResolution() {
    if (!session) return;
    if (session.run.lost || session.run.resolve <= 0) { showEnd(false); return; }

    if (isCurrentSetComplete(session.run)) {
      const profile = completeCurrentSet(session.run);
      session.pendingSetProfile = profile;
      if (isAdventureRunComplete(session.run)) { showEnd(true); return; }
      showSetTransition(profile);
      return;
    }

    session.awaitingOutcome = false;
    clear();
    updateChrome();
    setBusy(false);
  }

  function afterOutcome() {
    if (!session?.lastResolution) return;
    const resolution = session.lastResolution;
    if (resolution.rewardTier && resolution.rewardShow > 0) {
      const offers = generateRewardOffers(session.run, resolution.rewardShow, rng);
      session.rewardState = {
        offers,
        choose: Math.min(resolution.rewardChoose, offers.length),
        picked: [],
      };
      showRewards();
      return;
    }
    advanceAfterResolution();
  }

  function pickReward(index) {
    const state = session?.rewardState;
    if (!state) return;
    const at = state.picked.indexOf(index);
    if (at >= 0) state.picked.splice(at, 1);
    else if (state.picked.length < state.choose) state.picked.push(index);
    showRewards();
  }

  function confirmRewards() {
    const state = session?.rewardState;
    if (!state || state.picked.length !== state.choose) return;
    const chosen = state.picked.map(index => state.offers[index]);
    applyRewardsSequentially(chosen, 0);
  }

  function chooseRecovery(choiceId) {
    if (!session?.pendingSetProfile) return;
    applyRecoveryChoice(session.run, choiceId, rng);
    const profile = session.pendingSetProfile;
    session.pendingSetProfile = null;
    beginNextSet(session.run, profile, rng);
    session.awaitingOutcome = false;
    clear();
    updateChrome();
    setBusy(false);
    if (typeof target.startReading === 'function') target.startReading();
  }

  function onCardPlaced(card, slotIndex) {
    if (!session || session.awaitingOutcome || !card) return false;
    const event = currentEvent();
    if (!event) return false;
    session.awaitingOutcome = true;
    setBusy(true);
    const resolution = resolveSingleCardEvent({ event, card, run: session.run });
    applyResolution(session.run, resolution);
    recordSingleCardPlay(session.run, event, card, resolution);
    session.lastEvent = event;
    session.lastResolution = resolution;
    session.lastSlotIndex = slotIndex;
    updateChrome();
    showOutcome(resolution, card);
    return true;
  }

  function newSession() {
    return {
      run: createSingleCardRunState(rng),
      lastEvent: null,
      lastResolution: null,
      rewardState: null,
      pendingSetProfile: null,
      awaitingOutcome: false,
      addedClasses: [],
    };
  }

  function wrapReturnToMenuOnce() {
    if (target.__tlrAdventureV2ReturnWrapped || typeof target.tlrReturnToMenu !== 'function') return;
    target.__tlrAdventureV2ReturnWrapped = true;
    const original = target.tlrReturnToMenu;
    target.__tlrAdventureV2ReturnOriginal = original;
    target.tlrReturnToMenu = function (...args) {
      cleanupAdventure();
      return original.apply(this, args);
    };
  }

  function startRun() {
    captureLiveBackupOnce();
    wrapReturnToMenuOnce();
    target.__tlrAdventureActive = true;
    installFreshProfile();
    session = newSession();
    ensureStyles(doc);
    ensureChrome();
    forceTable();
    updateChrome();
    clear();
    setBusy(false);
    if (typeof target.startReading === 'function') target.startReading();
  }

  function restartRun() {
    if (!target.__tlrAdventureActive) { startRun(); return; }
    installFreshProfile();
    session = newSession();
    ensureChrome();
    forceTable();
    updateChrome();
    clear();
    setBusy(false);
    if (typeof target.startReading === 'function') target.startReading();
  }

  function cleanupAdventure() {
    if (!target.__tlrAdventureActive) return;
    target.__tlrAdventureActive = false;
    restoreLiveBackup();
    if (doc) {
      doc.body.classList.remove(MODE_CLASS);
      for (const cls of session?.addedClasses || []) if (cls !== MODE_CLASS) doc.body.classList.remove(cls);
      doc.getElementById('advEventDeck')?.remove();
      doc.getElementById('advHud')?.remove();
    }
    session = null;
    clear();
  }

  function leave() {
    cleanupAdventure();
    const navigate = target.__tlrAdventureV2ReturnOriginal || target.tlrReturnToMenu || target.tlrShowMainMenu;
    if (typeof navigate === 'function') navigate();
  }

  // Override the original Adventure public surface after adventureMode.mjs has
  // installed. Score Mode remains untouched because placement checks the active
  // flag before calling the one-card hook.
  target.tlrStartAdventure = startRun;
  target.tlrAdventureBuildDeck = () => (session ? buildAdventureDeckCards() : null);
  target.tlrAdventureOnCardPlaced = onCardPlaced;
  target.tlrAdventureResolveReading = () => {};
  target.tlrAdventureV2AfterOutcome = afterOutcome;
  target.tlrAdventureV2PickReward = pickReward;
  target.tlrAdventureV2ConfirmRewards = confirmRewards;
  target.tlrAdventureV2ShowRecovery = showRecovery;
  target.tlrAdventureV2Recovery = chooseRecovery;
  target.tlrAdventureV2Restart = restartRun;
  target.tlrAdventureV2Leave = leave;
  target.tlrAdventureRestart = restartRun;
  target.tlrAdventureLeave = leave;
}

if (typeof window !== 'undefined') installAdventureModeV2(window);
