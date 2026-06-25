// Adventure Mode — front-end controller.
//
// Adventure Mode now runs ON the real Single-Player table. It reuses the live
// game completely — the hand, gesture system, spread placement, abilities,
// discard/purge and the scoring engine all behave exactly as in Score Mode,
// because they ARE Score Mode's systems. Adventure only:
//   1. swaps the score/threshold HUD for an Event deck (top-centre), and
//   2. intercepts the scored spread (via the guarded hook in readingFlow's
//      scoreReading) to resolve Events instead of score thresholds.
//
// Score Mode is untouched: every hook is gated on window.__tlrAdventureActive.

import { installGeneratedSheetAssets } from '../ui/generatedSheetAssets.mjs';
import { createInitialPersist, createInitialState } from './runtimeState.mjs';
import { ALL_CARD_DEFINITIONS } from '../data/cards.mjs';
import {
  createAdventureRunState,
  currentEvent,
  resolveEvent,
  applyResolution,
  generateRewardOffers,
  applyReward,
  addCardToDeck,
  removeCardFromDeck,
  advanceEvent,
  isRunLost,
  isRecoveryDue,
  applyRecoveryChoice,
  randomUnownedRelic,
  recordBossPhase,
  resolveBossPhase,
  resolveBossFinal,
  ADVENTURE_RESULTS,
} from '../systems/adventure/run.mjs';
import { calculateSpreadMeanings } from '../systems/adventure/meanings.mjs';
import { REWARD_TYPES } from '../data/adventure/rewards.mjs';
import { RECOVERY_EVENT, ADVENTURE_BOSS } from '../data/adventure/events.mjs';
import { getStatus } from '../data/adventure/statuses.mjs';
import { buildDebugPanelHtml, isAdventureDebugEnabled } from '../ui/adventure/adventureHud.mjs';

const STYLE_ID = 'adventure-mode-style';
const MODE_CLASS = 'mode-adventure';
const TABLE_CLASSES = ['single-player-v2', 'generated-sheet-ready', 'mode-reading'];
const CARD_BY_ID = new Map(ALL_CARD_DEFINITIONS.map(card => [card.id, card]));

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
    /* The Event deck replaces the score/threshold HUD. */
    body.mode-adventure .score-stack,
    body.mode-adventure #constellationPill { display:none !important; }

    #advEventDeck{position:fixed;top:8px;left:50%;transform:translateX(-50%);z-index:26;
      display:none;flex-direction:column;align-items:center;gap:6px;pointer-events:none;
      font-family:Georgia,serif;color:#f2dfb8}
    body.mode-adventure #advEventDeck{display:flex}
    .adv-deck{position:relative;width:128px;height:118px}
    .adv-deck__back{position:absolute;width:84px;height:114px;border-radius:8px;left:50%;top:2px;
      background:linear-gradient(160deg,#3a2a1a,#160d07);border:1px solid rgba(228,188,111,.45);box-shadow:0 4px 10px rgba(0,0,0,.5)}
    .adv-deck__top{position:absolute;left:50%;top:-2px;transform:translateX(-50%);width:98px;height:120px;border-radius:9px;
      background:linear-gradient(165deg,#2a1810,#140907);border:2px solid #9a7842;
      box-shadow:0 8px 20px rgba(0,0,0,.6),0 0 18px rgba(243,201,105,.2);
      display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:8px}
    .adv-deck__trait{font:800 8px system-ui,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:#d19c51}
    .adv-deck__title{font:800 13px Georgia,serif;line-height:1.1;margin-top:4px}
    .adv-deck__scores{font:700 10px system-ui,sans-serif;color:#c9b890;margin-top:6px}
    .adv-event-desc{max-width:300px;text-align:center;font:500 11px Georgia,serif;line-height:1.4;color:#d8c8a6;
      background:rgba(18,12,9,.66);border-radius:8px;padding:6px 10px}

    /* Resolve + statuses + Leave, top-left, clear of the utility cluster. */
    #advHud{position:fixed;top:8px;left:8px;z-index:42;display:none;gap:8px;align-items:center;flex-wrap:wrap;
      font:700 12px system-ui,sans-serif;color:#ead9b5;max-width:46vw}
    body.mode-adventure #advHud{display:flex}
    #advHud .adv-resolve{background:rgba(18,12,9,.82);border:1px solid rgba(228,188,111,.5);border-radius:999px;padding:5px 11px}
    #advHud .adv-resolve b{color:#f3c969}
    #advHud .adv-status{background:rgba(228,188,111,.1);border:1px solid rgba(228,188,111,.5);border-radius:999px;padding:3px 8px;font-size:11px}
    #advHud .adv-leave{border:1px solid rgba(228,188,111,.5);background:rgba(18,12,9,.82);color:#e7c07c;border-radius:999px;
      padding:5px 11px;cursor:pointer;font:700 11px system-ui,sans-serif}

    /* Outcome / reward content reuses the game's .result-panel styling. */
    .adv-narrative{line-height:1.5;font-size:15px;color:#e6d6b4;margin:6px 0 4px;text-align:center}
    .adv-statuschg{font:700 12px system-ui,sans-serif;letter-spacing:.04em;text-transform:uppercase;text-align:center;margin-top:4px}
    .adv-statuschg--gain{color:#f3c969}.adv-statuschg--lose{color:#b6a07a}
    .adv-rewards{display:flex;gap:10px;flex-wrap:wrap;justify-content:center;margin:6px 0}
    .adv-reward{flex:1 1 150px;min-width:140px;border:1px solid rgba(228,188,111,.4);border-radius:10px;padding:13px;cursor:pointer;
      background:rgba(255,255,255,.03);text-align:center;font:700 13px system-ui,sans-serif;color:#eadbb9}
    .adv-reward:hover{border-color:#f3c969}
    .adv-reward--picked{border-color:#9fd17f;background:rgba(159,209,127,.12)}
    .adv-reward--disabled{opacity:.35;pointer-events:none}
    .adv-debug{margin-top:10px;border:1px dashed rgba(120,200,255,.5);border-radius:10px;padding:10px 12px;
      background:rgba(40,60,90,.18);font:600 12px ui-monospace,monospace;color:#bcd6f0;text-align:left}
    .adv-debug__title{font-weight:800;color:#8fc2ff;margin-bottom:6px}
    .adv-debug__row{display:flex;justify-content:space-between;gap:18px}
    .adv-debug__outcome{margin-top:6px;color:#8fc2ff}
  `;
  doc.head.appendChild(style);
}

export function installAdventureMode(target = window) {
  if (!target || target.__tlrAdventureInstalled) return;
  target.__tlrAdventureInstalled = true;
  const doc = target.document;
  const rng = () => (target.__tlrAdvRng || Math.random)();

  let session = null;
  // Snapshot of the live Score Mode persist/run, taken when Adventure starts and
  // restored when it ends. Adventure never reads or writes Score Mode state.
  let liveBackup = null;

  // Stash the live Score Mode profile + run once, on first entry. Adventure
  // swaps the globals to fresh objects rather than mutating these, so keeping the
  // original references is safe and restores them exactly on leave.
  function captureLiveBackupOnce() {
    if (liveBackup) return;
    liveBackup = {
      persist: target.persist,
      state: target.state,
      storeRun: target.tlrStore ? target.tlrStore.getState().run : null,
    };
  }

  // Swap the globals to a fresh, throwaway Adventure profile: default upgrades,
  // no relics, empty reserve. Scoring, hand size and discards all fall back to
  // their defaults — the live deck/upgrades/relics are never used.
  function installFreshProfile() {
    target.persist = createInitialPersist();
    target.state = createInitialState();
    if (target.console && typeof target.console.assert === 'function') {
      const up = target.persist.up || {};
      const clean = !Object.values(up).some(Boolean) && !(target.persist.relics || []).length;
      target.console.assert(clean, '[Adventure] expected a fresh profile with no Score-Mode upgrades/relics');
    }
  }

  // Put the live Score Mode persist/run back exactly as they were, and resync the
  // architecture store. The on-disk save was never touched while Adventure ran.
  function restoreLiveBackup() {
    if (!liveBackup) return;
    target.persist = liveBackup.persist;
    target.state = liveBackup.state;
    if (target.tlrStore && target.tlrActions) {
      if (typeof target.tlrSyncPersistToStore === 'function') target.tlrSyncPersistToStore();
      if (liveBackup.storeRun) {
        target.tlrStore.dispatch({ type: target.tlrActions.SYNC_LEGACY_RUN, run: liveBackup.storeRun });
      }
    }
    liveBackup = null;
  }

  // --- Chrome (Event deck + Resolve HUD) -----------------------------------
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
      hud.addEventListener('click', ev => {
        if (ev.target.closest('[data-adv-leave]')) leave();
      });
    }
  }

  function updateChrome() {
    if (!doc || !session) return;
    const run = session.run;
    // During the boss, the "event" the deck shows is the current phase.
    const bossPhase = (session.boss && session.boss.phaseIndex < ADVENTURE_BOSS.phases.length)
      ? ADVENTURE_BOSS.phases[session.boss.phaseIndex] : null;
    const event = session.boss ? null : currentEvent(run);
    const deck = doc.getElementById('advEventDeck');
    if (deck) {
      if (bossPhase) {
        deck.innerHTML = `
          <div class="adv-deck">
            <div class="adv-deck__back" style="transform:translate(calc(-50% + 4px),3px) rotate(2deg)"></div>
            <div class="adv-deck__top">
              <div class="adv-deck__trait">Boss · ${esc(bossPhase.label)}</div>
              <div class="adv-deck__title">${esc(ADVENTURE_BOSS.title)}</div>
              <div class="adv-deck__scores">▲ ${bossPhase.targetScore} · ★ ${bossPhase.triumphScore}</div>
            </div>
          </div>
          <div class="adv-event-desc">${esc(bossPhase.description)}</div>`;
      } else if (!event) {
        deck.innerHTML = '';
      } else {
        const remaining = Math.max(1, run.events.length - run.currentEventIndex);
        const backs = [...Array(Math.min(3, remaining)).keys()]
          .map(i => `<div class="adv-deck__back" style="transform:translate(calc(-50% + ${i * 4}px),${i * 3}px) rotate(${i * 2 - 2}deg)"></div>`)
          .join('');
        deck.innerHTML = `
          <div class="adv-deck">${backs}
            <div class="adv-deck__top">
              <div class="adv-deck__trait">${esc((event.traits || []).join(' · '))}</div>
              <div class="adv-deck__title">${esc(event.title)}</div>
              <div class="adv-deck__scores">▲ ${event.targetScore} · ★ ${event.triumphScore}</div>
            </div>
          </div>
          <div class="adv-event-desc">${esc(event.description)}</div>`;
      }
    }
    const hud = doc.getElementById('advHud');
    if (hud) {
      const statuses = (run.statuses || [])
        .map(id => `<span class="adv-status">${esc(getStatus(id)?.name || id)}</span>`).join('');
      hud.innerHTML = `<span class="adv-resolve">Resolve <b>${run.resolve}</b> / ${run.maxResolve}</span>`
        + `<span class="adv-resolve" title="Cards in your deck">Deck <b>${run.deck.length}</b></span>`
        + statuses + `<button class="adv-leave" type="button" data-adv-leave>Leave</button>`;
    }
  }

  // --- Overlays (reuse the game's #summary modal via showOverlay) -----------
  function show(html) {
    if (typeof target.showOverlay === 'function') target.showOverlay(html);
    else { const s = doc.getElementById('summary'); if (s) { s.className = 'modal show'; s.innerHTML = html; } }
  }
  function clear() {
    if (typeof target.clearOverlay === 'function') target.clearOverlay();
    else { const s = doc.getElementById('summary'); if (s) { s.className = ''; s.innerHTML = ''; } }
  }

  function showOutcome(resolution) {
    const event = session.lastEvent;
    const win = resolution.tier !== ADVENTURE_RESULTS.FAILURE;
    const label = resolution.tier === ADVENTURE_RESULTS.TRIUMPH ? 'Triumph'
      : resolution.tier === ADVENTURE_RESULTS.SUCCESS ? 'Success' : 'Failure';
    const statusBits = [
      ...resolution.gainStatuses.map(id => `<span class="adv-statuschg adv-statuschg--gain">+ ${esc(getStatus(id)?.name || id)}</span>`),
      ...resolution.removeStatuses.map(id => `<span class="adv-statuschg adv-statuschg--lose">– ${esc(getStatus(id)?.name || id)}</span>`),
    ].join(' ');
    const resolveBit = resolution.resolveChange
      ? `<div class="adv-statuschg ${resolution.resolveChange > 0 ? 'adv-statuschg--gain' : 'adv-statuschg--lose'}">Resolve ${resolution.resolveChange > 0 ? '+' : ''}${resolution.resolveChange}</div>`
      : '';
    const debug = isAdventureDebugEnabled(target)
      ? buildDebugPanelHtml({ meanings: resolution.meanings, outcome: resolution.outcome }) : '';
    show(`<div class="result-panel ${win ? 'pass' : 'fail'}">
      <div class="rhead"><h3 class="${win ? 'pass' : 'fail'}">${label}</h3></div>
      <div class="rscore"><span class="rsf${win ? '' : ' fail'}">${resolution.score}</span><span class="rop">/</span><span class="rsm">${event.targetScore}</span></div>
      <p class="adv-narrative">${esc(resolution.narrative)}</p>
      ${statusBits ? `<div>${statusBits}</div>` : ''}${resolveBit}
      <div class="rbtns"><button class="btn-gold" onclick="tlrAdventureAfterOutcome()">Continue</button></div>
      ${debug}
    </div>`);
  }

  function showRewards() {
    const { offers, choose, picked } = session.rewardState;
    const cards = offers.map((offer, i) => {
      const isPicked = picked.includes(i);
      const disabled = !isPicked && picked.length >= choose;
      return `<div class="adv-reward${isPicked ? ' adv-reward--picked' : ''}${disabled ? ' adv-reward--disabled' : ''}" onclick="tlrAdventurePickReward(${i})">${esc(offer.label)}</div>`;
    }).join('');
    show(`<div class="result-panel pass">
      <div class="rhead"><h3 class="pass">Choose your reward${choose > 1 ? `s (${picked.length}/${choose})` : ''}</h3></div>
      <div class="adv-rewards">${cards}</div>
      <div class="rbtns"><button class="btn-gold" onclick="tlrAdventureConfirmRewards()" ${picked.length === choose ? '' : 'disabled'}>Confirm</button></div>
    </div>`);
  }

  function showRecovery() {
    const choices = RECOVERY_EVENT.choices
      .map(c => `<div class="adv-reward" onclick="tlrAdventureRecovery('${c.id}')">${esc(c.label)}</div>`).join('');
    show(`<div class="result-panel pass">
      <div class="rhead"><h3 class="pass">${esc(RECOVERY_EVENT.title)}</h3></div>
      <p class="adv-narrative">${esc(RECOVERY_EVENT.description)}</p>
      <div class="adv-rewards">${choices}</div>
    </div>`);
  }

  function showEnd(won) {
    show(`<div class="result-panel ${won ? 'pass' : 'fail'}">
      <div class="rhead"><h3 class="${won ? 'pass' : 'fail'}">${won ? 'The road is yours.' : 'Your Resolve fails.'}</h3></div>
      <p class="adv-narrative">${won
        ? 'You read your way through every trial set before you.'
        : 'The journey ends here — but the cards remember.'}</p>
      <div class="rbtns"><button class="btn-gold" onclick="tlrAdventureRestart()">New Run</button><button onclick="tlrAdventureLeave()">Leave</button></div>
    </div>`);
  }

  // --- Flow ----------------------------------------------------------------
  function resolveReading(score, cards) {
    if (!session) return;
    if (session.boss) { resolveBossReading(score, cards); return; }
    const event = currentEvent(session.run);
    if (!event) return;
    session.lastEvent = event;
    const resolution = resolveEvent({ event, spread: cards, run: session.run, score });
    applyResolution(session.run, resolution);
    session.lastResolution = resolution;
    updateChrome();
    showOutcome(resolution);
  }

  // --- Boss (the Woman in the Well) ----------------------------------------
  function enterBoss() {
    session.boss = { phaseIndex: 0, complete: false };
    updateChrome();
    show(`<div class="result-panel">
      <div class="rhead"><span class="rorn">✦ &nbsp; ✦ &nbsp; ✦</span><h3>${esc(ADVENTURE_BOSS.title)}</h3></div>
      <p class="adv-narrative">${esc(ADVENTURE_BOSS.description)}</p>
      <div class="rbtns"><button class="btn-gold" onclick="tlrAdventureAfterOutcome()">Descend into the well</button></div>
    </div>`);
  }

  function resolveBossReading(score, cards) {
    const boss = session.boss;
    const phase = ADVENTURE_BOSS.phases[boss.phaseIndex];
    const meanings = calculateSpreadMeanings(cards, session.run.statuses);
    recordBossPhase(session.run, meanings); // tracked silently for the final outcome
    const tier = resolveBossPhase({ phase, score });
    const debug = isAdventureDebugEnabled(target) ? buildDebugPanelHtml({ meanings }) : '';

    if (tier === ADVENTURE_RESULTS.FAILURE) {
      applyResolution(session.run, { resolveChange: -1, gainStatuses: [], removeStatuses: [], notes: [] });
      updateChrome();
      if (isRunLost(session.run)) { showEnd(false); return; }
      showBossPhaseOutcome(phase, 'Held', 'fail', score, debug); // retry the same phase
      return;
    }

    boss.phaseIndex += 1;
    if (boss.phaseIndex >= ADVENTURE_BOSS.phases.length) boss.complete = true;
    const triumph = tier === ADVENTURE_RESULTS.TRIUMPH;
    showBossPhaseOutcome(phase, triumph ? 'Triumph' : 'Success', triumph ? 'triumph' : 'pass', score,
      debug, triumph && phase.triumphText ? phase.triumphText : phase.text);
  }

  function showBossPhaseOutcome(phase, label, cls, score, debug, narrative) {
    show(`<div class="result-panel ${cls === 'fail' ? 'fail' : 'pass'}">
      <div class="rhead"><h3 class="${cls === 'fail' ? 'fail' : 'pass'}">${esc(label)} · ${esc(phase.label)}</h3></div>
      <div class="rscore"><span class="rsf${cls === 'fail' ? ' fail' : ''}">${score}</span><span class="rop">/</span><span class="rsm">${phase.targetScore}</span></div>
      <p class="adv-narrative">${esc(narrative || phase.failureText)}</p>
      <div class="rbtns"><button class="btn-gold" onclick="tlrAdventureAfterOutcome()">Continue</button></div>
      ${debug}
    </div>`);
  }

  function bossContinue() {
    if (session.boss.complete) {
      const final = resolveBossFinal(session.run, ADVENTURE_BOSS);
      show(`<div class="result-panel pass">
        <div class="rhead"><span class="rorn">✦ &nbsp; ✦ &nbsp; ✦</span><h3 class="pass">${esc(ADVENTURE_BOSS.title)}</h3></div>
        <p class="adv-narrative">${esc(final ? final.text : 'The well is quiet now.')}</p>
        <div class="rbtns"><button class="btn-gold" onclick="tlrAdventureRestart()">New Run</button><button onclick="tlrAdventureLeave()">Leave</button></div>
      </div>`);
      return;
    }
    // Deal the next (or retried) phase on the real table.
    clear();
    updateChrome();
    if (typeof target.startReading === 'function') target.startReading();
  }

  function afterOutcome() {
    if (session.boss) { bossContinue(); return; }
    const resolution = session.lastResolution;
    if (resolution && resolution.rewardTier) {
      const offers = generateRewardOffers(session.run, resolution.rewardShow, rng);
      session.rewardState = { offers, choose: Math.min(resolution.rewardChoose, offers.length), picked: [] };
      showRewards();
    } else {
      advance();
    }
  }

  function pickReward(i) {
    const state = session.rewardState;
    if (!state) return;
    const at = state.picked.indexOf(i);
    if (at >= 0) state.picked.splice(at, 1);
    else if (state.picked.length < state.choose) state.picked.push(i);
    showRewards();
  }

  function confirmRewards() {
    const state = session.rewardState;
    if (!state || state.picked.length !== state.choose) return;
    const chosen = state.picked.map(i => state.offers[i]);
    session.rewardState = null;
    applyRewardsSequentially(chosen, 0);
  }

  // Apply chosen rewards one at a time. Deck rewards open the card picker, so
  // they have to resolve before the next reward / the next event.
  function applyRewardsSequentially(rewards, idx) {
    if (idx >= rewards.length) { updateChrome(); advance(); return; }
    const reward = rewards[idx];
    const next = () => applyRewardsSequentially(rewards, idx + 1);
    if (reward.type === REWARD_TYPES.REMOVE_CARD) { pickCardToRemove(next); return; }
    if (reward.type === REWARD_TYPES.ADD_CARD) { pickCardToAdd(next); return; }
    applyReward(session.run, reward, { relicId: randomUnownedRelic(session.run, rng) }, rng);
    next();
  }

  // The current Adventure deck as renderable card objects (fresh uids per call).
  function buildAdventureDeckCards() {
    return session.run.deck.map((id, uid) => ({ ...CARD_BY_ID.get(id), uid }));
  }

  // A small pool of distinct candidate cards to add to the deck.
  function adventureAddPool(size = 3) {
    const pool = [];
    const used = new Set();
    let guard = 0;
    while (pool.length < size && guard < 80) {
      guard += 1;
      const def = ALL_CARD_DEFINITIONS[Math.floor(rng() * ALL_CARD_DEFINITIONS.length)];
      if (used.has(def.id)) continue;
      used.add(def.id);
      pool.push({ ...def, uid: 9000 + pool.length });
    }
    return pool;
  }

  function pickCardToRemove(done) {
    const cards = buildAdventureDeckCards();
    if (typeof target.choice !== 'function' || !cards.length) { done(); return; }
    const ordered = typeof target.sortCards === 'function' ? target.sortCards(cards) : cards;
    clear();
    target.choice('Remove a Card', 'Choose a card to remove from your deck.', ordered, picked => {
      removeCardFromDeck(session.run, picked.id);
      updateChrome();
      done();
    });
  }

  function pickCardToAdd(done) {
    const pool = adventureAddPool();
    if (typeof target.choice !== 'function' || !pool.length) { done(); return; }
    clear();
    target.choice('Add a Card', 'Choose a card to add to your deck.', pool, picked => {
      addCardToDeck(session.run, picked.id);
      updateChrome();
      done();
    });
  }

  function advance() {
    advanceEvent(session.run, session.lastEvent?.id);
    const run = session.run;
    if (isRunLost(run)) { showEnd(false); return; }
    if (isRecoveryDue(run)) { showRecovery(); return; }
    if (run.currentEventIndex >= run.events.length) { enterBoss(); return; }
    // Next event: refresh the deck card and deal a fresh reading on the table.
    updateChrome();
    clear();
    if (typeof target.startReading === 'function') target.startReading();
  }

  function chooseRecovery(choiceId) {
    applyRecoveryChoice(session.run, choiceId, rng);
    updateChrome();
    const run = session.run;
    if (run.currentEventIndex >= run.events.length) { enterBoss(); return; }
    clear();
    if (typeof target.startReading === 'function') target.startReading();
  }

  // --- Lifecycle -----------------------------------------------------------
  function forceTable() {
    if (!doc) return;
    const body = doc.body;
    body.classList.remove('mp-game-active', 'mode-attic', 'mode-to-attic', 'mode-to-table', 'mode-table-return', 'mode-return-hard-hide');
    session.addedClasses = [];
    for (const cls of [...TABLE_CLASSES, MODE_CLASS]) {
      if (!body.classList.contains(cls)) { body.classList.add(cls); session.addedClasses.push(cls); }
    }
    for (const [id, cls] of [['mpGame', 'mp-hidden'], ['loadoutScreen', 'loadout-hidden'], ['matchmakingScreen', 'mm-screen-hidden']]) {
      doc.getElementById(id)?.classList.add(cls);
    }
    doc.getElementById('atticScene')?.setAttribute('aria-hidden', 'true');
    try { if (target.Image) installGeneratedSheetAssets(target); } catch { /* ignore */ }
  }

  function startRun() {
    // Isolate from Score Mode BEFORE the flag flips on and any reading is dealt:
    // capture the live profile once, then swap to a fresh Adventure profile.
    captureLiveBackupOnce();
    wrapReturnToMenuOnce();
    target.__tlrAdventureActive = true;
    installFreshProfile();
    session = { run: createAdventureRunState(), lastEvent: null, lastResolution: null, rewardState: null, boss: null, addedClasses: [] };
    ensureStyles(doc);
    ensureChrome();
    forceTable();
    updateChrome();
    clear();
    if (typeof target.startReading === 'function') target.startReading();
  }

  // Tear down an active Adventure run and restore Score Mode. Idempotent, so it
  // is safe whether the player exits via the Adventure "Leave" button or the
  // in-game settings "Return to Menu".
  function cleanupAdventure() {
    if (!target.__tlrAdventureActive) return;
    // Flag off first so the restored Score Mode persist autosaves normally again.
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

  // Route the menu's own "Return to Menu" through cleanup, so leaving Adventure
  // by any path restores the Score Mode profile.
  function wrapReturnToMenuOnce() {
    if (target.__tlrAdvReturnWrapped || typeof target.tlrReturnToMenu !== 'function') return;
    target.__tlrAdvReturnWrapped = true;
    const original = target.tlrReturnToMenu;
    target.__tlrReturnToMenuOriginal = original;
    target.tlrReturnToMenu = function (...args) { cleanupAdventure(); return original.apply(this, args); };
  }

  function leave() {
    cleanupAdventure();
    const nav = target.__tlrReturnToMenuOriginal || target.tlrReturnToMenu || target.tlrShowMainMenu;
    if (typeof nav === 'function') nav();
  }

  // --- Public hooks (called from the menu and the readingFlow scoring hook) --
  target.tlrStartAdventure = function () { startRun(); };
  // Used by readingFlow.startReading to deal each Adventure reading from the
  // run's own evolving deck.
  target.tlrAdventureBuildDeck = function () { return session ? buildAdventureDeckCards() : null; };
  target.tlrAdventureResolveReading = function (score, cards) { resolveReading(score, cards); };
  target.tlrAdventureAfterOutcome = function () { afterOutcome(); };
  target.tlrAdventurePickReward = function (i) { pickReward(i); };
  target.tlrAdventureConfirmRewards = function () { confirmRewards(); };
  target.tlrAdventureRecovery = function (id) { chooseRecovery(id); };
  target.tlrAdventureRestart = function () { startRun(); };
  target.tlrAdventureLeave = function () { leave(); };
}

if (typeof window !== 'undefined') installAdventureMode(window);
