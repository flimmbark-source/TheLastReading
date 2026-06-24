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
import { getStatus } from '../data/adventure/statuses.mjs';
import { buildDebugPanelHtml, isAdventureDebugEnabled } from '../ui/adventure/adventureHud.mjs';

const STYLE_ID = 'adventure-mode-style';
const MODE_CLASS = 'mode-adventure';
const TABLE_CLASSES = ['single-player-v2', 'generated-sheet-ready', 'mode-reading'];

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
    const event = currentEvent(run);
    const deck = doc.getElementById('advEventDeck');
    if (deck) {
      if (!event) { deck.innerHTML = ''; }
      else {
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
    const event = currentEvent(session.run);
    if (!event) return;
    session.lastEvent = event;
    const resolution = resolveEvent({ event, spread: cards, run: session.run, score });
    applyResolution(session.run, resolution);
    session.lastResolution = resolution;
    updateChrome();
    showOutcome(resolution);
  }

  function afterOutcome() {
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
    for (const i of state.picked) {
      applyReward(session.run, state.offers[i], { relicId: randomUnownedRelic(session.run, rng) }, rng);
    }
    session.rewardState = null;
    updateChrome();
    advance();
  }

  function advance() {
    advanceEvent(session.run, session.lastEvent?.id);
    const run = session.run;
    if (isRunLost(run)) { showEnd(false); return; }
    if (isRecoveryDue(run)) { showRecovery(); return; }
    if (run.currentEventIndex >= run.events.length) { showEnd(true); return; }
    // Next event: refresh the deck card and deal a fresh reading on the table.
    updateChrome();
    clear();
    if (typeof target.startReading === 'function') target.startReading();
  }

  function chooseRecovery(choiceId) {
    applyRecoveryChoice(session.run, choiceId, rng);
    updateChrome();
    const run = session.run;
    if (run.currentEventIndex >= run.events.length) { showEnd(true); return; }
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
    session = { run: createAdventureRunState(), lastEvent: null, lastResolution: null, rewardState: null, addedClasses: [] };
    target.__tlrAdventureActive = true;
    ensureStyles(doc);
    ensureChrome();
    forceTable();
    updateChrome();
    clear();
    if (typeof target.startReading === 'function') target.startReading();
  }

  function leave() {
    target.__tlrAdventureActive = false;
    if (doc) {
      doc.body.classList.remove(MODE_CLASS);
      for (const cls of session?.addedClasses || []) if (cls !== MODE_CLASS) doc.body.classList.remove(cls);
      doc.getElementById('advEventDeck')?.remove();
      doc.getElementById('advHud')?.remove();
    }
    session = null;
    clear();
    if (typeof target.tlrReturnToMenu === 'function') target.tlrReturnToMenu();
    else if (typeof target.tlrShowMainMenu === 'function') target.tlrShowMainMenu();
  }

  // --- Public hooks (called from the menu and the readingFlow scoring hook) --
  target.tlrStartAdventure = function () { startRun(); };
  target.tlrAdventureResolveReading = function (score, cards) { resolveReading(score, cards); };
  target.tlrAdventureAfterOutcome = function () { afterOutcome(); };
  target.tlrAdventurePickReward = function (i) { pickReward(i); };
  target.tlrAdventureConfirmRewards = function () { confirmRewards(); };
  target.tlrAdventureRecovery = function (id) { chooseRecovery(id); };
  target.tlrAdventureRestart = function () { startRun(); };
  target.tlrAdventureLeave = function () { leave(); };
}

if (typeof window !== 'undefined') installAdventureMode(window);
