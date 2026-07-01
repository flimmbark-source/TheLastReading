import { MP_PHASES, handSizeForPersona } from '../multiplayer/mpState.mjs';
import { MP_ACTIONS } from '../multiplayer/mpActions.mjs';
import { applyImmediateAction } from '../multiplayer/mpReducer.mjs';
import { MP_ABILITY_TYPES } from '../multiplayer/interactionCards.mjs';
import {
  isPlayerTurn, canInvokeAbility, canTargetSlot,
  isSlotAnchored, isCardSilenced, canSwapSpread,
  isMatchOver, needsScoring, scores, roundScores,
  hasSubmittedAction,
} from '../multiplayer/mpSelectors.mjs';
import { ABILITY_TYPES, getAbility } from '../data/abilities.mjs';
import { shuffleDeck } from '../systems/deck.mjs';
import { buildAbilityChoiceAsync } from './abilityFlowAsync.mjs';
import { computeScore } from '../systems/scoring.mjs';
import { getPersona } from '../multiplayer/personas.mjs';
import { applyCardPhoto, CARD_SHEET, title as cardTitle, symbol as cardSymbol } from '../ui/renderCard.mjs';

const OPPONENT_REVEAL_DELAY_MS = 750;
const EFFECT_WINDOW_MS = 2600;
const COURT_RANKS = ['Page', 'Knight', 'Queen', 'King'];
const MINOR_SUITS = ['Cups', 'Wands', 'Swords', 'Pentacles'];

export function installMpGame(target = window) {
  if (!target || target.__tlrMpGameInstalled) return;
  target.__tlrMpGameInstalled = true;

  let _state      = null;
  let _myIndex    = 0;
  let _invokeCard = null;  // uid awaiting opponent-spread target (Seal)
  let _swapFirst  = null;  // null | -1 | slotIndex (Surgeon swap)
  let _purgeSelect = null; // null | uid[]
  let _selected = null;    // multiplayer's own hand-selection store (uid | null)
  let _abilityResolving = false;
  let _abilityTargeting = null; // visible hand/spread anchor-pick sub-phase
  let _abilityConfirmOriginalOnclick = null;
  // Mirrors singleplayer's abilityTargetBridge.mjs: once a tap fills the
  // last required pick, auto-confirm after a short beat instead of waiting
  // for a manual Confirm tap. No card movement happens during MP targeting
  // either (same shared .ability-target/.ability-picked CSS as singleplayer),
  // so there's no animation for this delay to race or cut off.
  const MP_AUTO_CONFIRM_DELAY_MS = 120;
  let _abilityAutoConfirmTimer = null;
  function clearAbilityAutoConfirmTimer() {
    if (_abilityAutoConfirmTimer) { target.clearTimeout?.(_abilityAutoConfirmTimer); _abilityAutoConfirmTimer = null; }
  }
  let _personaSwapRequested = false;
  let _origPlaceCard    = null;
  let _origRenderSpread = null;
  let _origRenderHand   = null;
  let _origTogglePurgeCard = null;
  let _origRefreshHandState = null;
  let _oppRevealPending = new Set();
  let _oppRevealShown = new Set();
  let _oppRevealTimers = new Set();
  let _lastShownScores = [0, 0];
  let _lastScoringState = null;
  let _latestEffectsUntil = 0;
  let _delayedNextRoundQueued = false;
  let _localPlacementFeedbackKeys = new Set();
  // Cards submitted for discard/purge/invoke stay in _state until the round
  // resolves, causing a one-frame flash where they reappear as unselected cards.
  // Track them here and filter in selfHandView until _state catches up.
  let _pendingRemovalUids = new Set();
  // Optimistic local resolution of MY own card ability. Card abilities only
  // affect the acting player's own piles, so we apply the effect to a local
  // snapshot the instant it is submitted — the player sees the drawn/taken card
  // immediately rather than waiting for the simultaneous cycle to resolve. The
  // opponent still sees it when the cycle reveals. Cleared once the canonical
  // _state catches up (resolution done).
  let _optimisticSelf = null;

  const doc = target.document;
  function el(id) { return doc.getElementById(id); }
  installMpGameStyle(doc);
  patchMatchmakingBack(target, doc);
  installFlushGuard(target, doc);
  installOpponentPopTuning(target, doc);
  installDispatchEffectDelay();
  installMultPillObserver();
  installAbilityTargetClicks();

  // The shared #abilityConfirm button drives singleplayer targeting via its
  // inline onclick. While a match is active we repoint it at the multiplayer
  // confirm; remember the original so tlrMpLeave can restore it.
  _abilityConfirmOriginalOnclick = el('abilityConfirm')?.getAttribute('onclick') || '';

  function isMyActionTurn(s = _state) {
    if (!s) return false;
    return isPlayerTurn(s, _myIndex);
  }

  function mySubmitted(s = _state) {
    return !!s && hasSubmittedAction(s, _myIndex);
  }

  function opponentSubmitted(s = _state) {
    return !!s && hasSubmittedAction(s, 1 - _myIndex);
  }

  function mpCardHTML(card) {
    if (!card) return '';
    if (card.type === 'interaction') {
      const sym  = card.abilityType === MP_ABILITY_TYPES.MP_BANISH ? '⚔' : '🔇';
      const desc = card.abilityType === MP_ABILITY_TYPES.MP_BANISH ? 'Last Card' : 'Silence';
      return `<div class="title">${esc(card.name)}</div><div class="art"><div class="sym">${sym}</div><div class="plaque">${desc}</div><div class="seal tr">${card.points}</div></div>`;
    }
    const label = (card.ability && target.TXT?.[card.ability]) || '';
    return `<div class="title">${cardTitle(card)}</div><div class="art"><div class="sym">${cardSymbol(card)}</div>${label ? `<div class="plaque">${label}</div>` : ''}<div class="seal tr">${card.points}</div></div>`;
  }

  function mount() {
    const g = el('mpGame');
    if (!g || g.dataset.mpMounted) return;
    g.dataset.mpMounted = '1';
    g.innerHTML = `
      <div class="mp-bar">
        <button class="mp-leave-btn" onclick="tlrMpLeave()" type="button">← Leave</button>
        <div class="mp-turn-badge" id="mpTurnBadge"></div>
        <div class="mp-round-label" id="mpRoundLabel"></div>
      </div>

      <div class="mp-opp-hand" id="mpOppHand"></div>

      <div class="mp-opp-spread-clip">
        <div class="mp-opp-spread-transform">
          <div class="spread" id="mpOppSpread"></div>
        </div>
      </div>

      <div class="mp-mid-wrap" id="mpMidWrap">
        <div class="mp-pills-band mp-pills-opp">
          <div class="pill score-pill mp-pill-score mp-pill-opp-score">Score <b id="mpOppScore">0</b></div>
          <div class="pill reserve-pill mp-pill-disc mp-pill-opp-disc">Discards <b id="mpOppDisc">0</b></div>
        </div>
        <div class="mp-pills-band mp-pills-mid">
          <span class="mp-side-label mp-you-label">You</span>
          <div class="pill threshold-pill mp-pill-thresh">Threshold <b id="mpThresh">200</b></div>
          <button class="constellation-pill mp-constellation hidden" id="mpConstellation" type="button"></button>
          <span class="mp-side-label mp-foe-label">Foe</span>
        </div>
        <div class="mp-pills-band mp-pills-self">
          <div class="pill score-pill mp-pill-score mp-pill-my-score">Score <b id="mpMyScore">0</b></div>
          <div class="pill reserve-pill mp-pill-disc mp-pill-my-disc">Discards <b id="mpMyDisc">0</b></div>
        </div>
        <div class="mp-pills-band mp-pills-actions">
          <button class="sbtn sbtn-discard" id="mpDiscardBtn" onclick="tlrMpDiscard()" type="button" disabled aria-label="Discard selected card" title="Discard"></button>
          <button class="sbtn sbtn-purge" id="mpPurgeBtn" onclick="tlrMpPurge()" type="button" disabled aria-label="Purge 3 cards" title="Purge"></button>
          <button class="sbtn sbtn-ability mp-action-copy" id="mpAbilityBtn" onclick="tlrMpAbilityButton()" type="button" disabled aria-label="Ability unavailable" title="Ability unavailable">Ability</button>
        </div>
        <div class="mp-action-panel" id="mpActionPanel"></div>
      </div>

      <div class="mp-overlay mp-ov-hidden" id="mpOverlay">
        <div class="mp-ov-box" id="mpOvBox"></div>
      </div>`;
  }

  // Multiplayer owns all of its own UI state now: card piles come from the match
  // state (`_state`) and selection/purge live in module-local vars (`_selected`,
  // `_purgeSelect`). Nothing is written into the legacy global `state`; the
  // renderers receive everything via explicit view models. This keeps the
  // selected card valid when the hand changes underneath it.
  function syncPerspectiveState(s, my) {
    const p = s.players[my];
    if (!p) return;
    // Drop the optimistic ability snapshot once my action has resolved (my
    // pending action is cleared), so the canonical state becomes authoritative.
    if (_optimisticSelf && !hasSubmittedAction(s, my)) {
      const myHand = s.players[my]?.hand || [];
      const optimisticExtra = _optimisticSelf.hand.filter(c => !myHand.some(h => h.uid === c.uid));
      if (!optimisticExtra.length) _optimisticSelf = null;
    }
    if (_selected !== null && !(p.hand || []).some(c => c.uid === _selected)) _selected = null;
  }

  // My player as the local view should show it: the optimistically-resolved
  // snapshot (set when I invoke a card ability) takes precedence over the
  // canonical _state until resolution catches up.
  function effectiveSelf(s, my) {
    return _optimisticSelf || s.players[my];
  }

  function selfHandView(s, my) {
    // When an optimistic ability snapshot is active its hand already reflects
    // the resolved effect (source card gone, drawn/taken cards added), so use it
    // directly. Otherwise fall back to the canonical hand minus pending removals.
    if (_optimisticSelf) {
      return { hand: _optimisticSelf.hand || [], selected: _selected, purgeSelect: _purgeSelect, onToggleSelect: handleSelectToggle };
    }
    const rawHand = s.players[my]?.hand || [];
    if (_pendingRemovalUids.size) {
      // Auto-evict UIDs that have already left the hand (action resolved in _state)
      // so the set doesn't grow stale between the submit and the next match start.
      for (const uid of _pendingRemovalUids) {
        if (!rawHand.some(c => c.uid === uid)) _pendingRemovalUids.delete(uid);
      }
    }
    const hand = _pendingRemovalUids.size
      ? rawHand.filter(c => !_pendingRemovalUids.has(c.uid))
      : rawHand;
    return {
      hand,
      selected: _selected,
      purgeSelect: _purgeSelect,
      onToggleSelect: handleSelectToggle,
    };
  }

  function handleSelectToggle(uid) {
    if (!_state || mySubmitted(_state) || _abilityResolving) return;
    if (swapSlotChosen()) {
      dispatchSwap(_swapFirst, uid);
      return;
    }
    _selected = _selected === uid ? null : uid;
    renderSelfHand(_state, _myIndex);
    refreshSelectionUi();
  }

  function renderSelfHand(s, my) {
    syncPerspectiveState(s, my);
    if (typeof target.renderHand === 'function') target.renderHand(null, _purgeSelect !== null, selfHandView(s, my));
  }

  function render() {
    if (!_state) return;
    const s  = _state;
    const my = _myIndex;

    syncPerspectiveState(s, my);
    renderTopBar(s, my);
    renderOppHand(s, 1 - my);
    renderSpread(s, 1 - my, 'mpOppSpread', false);
    renderPills(s, my);
    renderActionButtons(s, my);
    renderSelfSpread(s, my);
    renderSelfHand(s, my);
    renderActionPanel(s, my);
    syncPersonaPrompt();
    syncMpActionPresentation(s, my);
    renderMpPurgePrompt();
    applyPendingPlacementPreview();

    if (needsScoring(s))   showScoringOverlay(s);
    else if (isMatchOver(s)) showCompleteOverlay(s, my);
    else                   hideOverlay();

    // Re-apply the ability prompt and target glows: render() rebuilds the hand
    // and spread, which would otherwise wipe the selection classes mid-pick.
    if (_abilityTargeting) { renderAbilityPrompt(); refreshAbilityTargets(); }
  }

  function refreshSelectionUi() {
    if (!_state) return;
    const s = _state;
    const my = _myIndex;
    syncPerspectiveState(s, my);
    renderActionButtons(s, my);
    renderSelfSpread(s, my);
    renderActionPanel(s, my);
    // The MP refreshHandState override runs the singleplayer refreshHandState
    // first, which calls the SP renderAbilityPrompt and strips the `show` class
    // off #abilityPrompt. Re-reconcile the persona prompt here (as the full
    // render() does) so the swap directions aren't silently hidden mid-flow.
    syncPersonaPrompt();
  }

  function renderTopBar(s, my) {
    const badge = el('mpTurnBadge');
    const round = el('mpRoundLabel');
    if (!badge) return;
    badge.className = 'mp-turn-badge';
    if (_abilityResolving) {
      badge.textContent = 'Resolving Ability…'; badge.classList.add('my-turn');
    } else if (s.phase === MP_PHASES.SCORING) {
      badge.textContent = 'Scoring…'; badge.classList.add('scoring');
    } else if (s.phase === MP_PHASES.BETWEEN_ROUNDS) {
      badge.textContent = 'Next Set…'; badge.classList.add('scoring');
    } else if (s.phase === MP_PHASES.COMPLETE) {
      badge.textContent = 'Match Over'; badge.classList.add('scoring');
    } else if (mySubmitted(s)) {
      badge.textContent = 'Action Submitted'; badge.classList.add('opp-turn');
    } else if (opponentSubmitted(s)) {
      badge.textContent = 'Opponent Ready'; badge.classList.add('my-turn');
    } else {
      badge.textContent = 'Choose Action'; badge.classList.add('my-turn');
    }
    if (round) round.textContent = `Round ${s.round ?? 1}`;
  }

  function renderOppHand(s, oppIdx) {
    const wrap = el('mpOppHand');
    if (!wrap) return;
    const count = s.players[oppIdx]?.hand?.length ?? 0;
    const pips = Array.from({ length: Math.min(count, 7) }, () => `<span class="mp-opp-pip"></span>`).join('');
    wrap.innerHTML = `${pips}<span class="mp-opp-hand-label">${count} card${count !== 1 ? 's' : ''}</span>`;
  }

  function opponentRevealKey(pIdx, slotIndex, card) { return `${pIdx}:${slotIndex}:${card?.uid ?? 'x'}`; }

  function shouldDelayOpponentCard(spreadEl, pIdx, slotIndex, card) {
    if (!card || pIdx === _myIndex) return false;
    const key = opponentRevealKey(pIdx, slotIndex, card);
    if (_oppRevealShown.has(key)) return false;
    if (_oppRevealPending.has(key)) return true;
    const slotEl = spreadEl?._mpSlots?.[slotIndex];
    const alreadyVisible = !!slotEl?.querySelector?.('.card');
    if (alreadyVisible) { _oppRevealShown.add(key); return false; }
    _oppRevealPending.add(key);
    const timer = target.setTimeout(() => {
      _oppRevealTimers.delete(timer);
      _oppRevealPending.delete(key);
      _oppRevealShown.add(key);
      render();
      target.requestAnimationFrame?.(() => popOpponentCard(pIdx, slotIndex));
    }, OPPONENT_REVEAL_DELAY_MS);
    _oppRevealTimers.add(timer);
    return true;
  }

  function popOpponentCard(pIdx, slotIndex) {
    const spread = pIdx === _myIndex ? el('spread') : el('mpOppSpread');
    const cardEl = spread?._mpSlots?.[slotIndex]?.querySelector?.('.card');
    if (!cardEl?.animate) return;
    cardEl.animate([
      { transform: 'translateY(-12px) scale(.78)', opacity: .15, filter: 'brightness(1.45)' },
      { transform: 'translateY(2px) scale(1.08)', opacity: 1, filter: 'brightness(1.18)' },
      { transform: 'translateY(0) scale(1)', opacity: 1, filter: 'brightness(1)' },
    ], { duration: 320, easing: 'cubic-bezier(.16,.9,.22,1)' });
  }

  function clearOpponentRevealQueues() {
    for (const timer of _oppRevealTimers) target.clearTimeout(timer);
    _oppRevealTimers.clear(); _oppRevealPending.clear(); _oppRevealShown.clear();
  }

  function renderSpread(s, pIdx, spreadId, isSelf) {
    const spreadEl = el(spreadId);
    if (!spreadEl) return;
    const player = s.players[pIdx];
    if (!player) return;
    const my  = _myIndex;
    const opp = 1 - my;
    if (!spreadEl._mpSlots || spreadEl._mpSlots.length !== 5 || !spreadEl.contains(spreadEl._mpSlots[0])) {
      spreadEl._mpSlots = [];
      spreadEl.replaceChildren();
      for (let i = 0; i < 5; i++) {
        const slot = doc.createElement('div');
        slot.style.setProperty('--a', ((i - 2) * 4 * (isSelf ? 1 : -1)) + 'deg');
        spreadEl.appendChild(slot);
        spreadEl._mpSlots.push(slot);
      }
    }
    for (let i = 0; i < 5; i++) {
      const slotEl = spreadEl._mpSlots[i];
      const card = player.spread[i];
      const delayOpponentCard = !isSelf && shouldDelayOpponentCard(spreadEl, pIdx, i, card);
      const displayCard = delayOpponentCard ? null : card;
      let cls = 'slot ';
      if (displayCard) {
        cls += 'filled';
        if (isSlotAnchored(s, pIdx, i)) cls += ' mp-anchored';
        if (isCardSilenced(s, pIdx, displayCard.uid)) cls += ' mp-silenced';
        if (_invokeCard !== null && pIdx === opp && canTargetSlot(s, pIdx, i)) cls += ' mp-targetable';
      } else {
        cls += 'empty';
        if (delayOpponentCard) cls += ' mp-reveal-pending';
      }
      slotEl.className = cls;
      slotEl.onclick = (_invokeCard !== null && pIdx === opp && displayCard && canTargetSlot(s, pIdx, i) && isMyActionTurn(s))
        ? () => handleInvokeTarget(pIdx, i)
        : null;
      renderSlotCard(slotEl, displayCard, isSelf ? i : null);
    }
  }

  function renderSelfSpread(s, my) {
    const spreadEl = el('spread');
    if (!spreadEl) return;
    const player = s.players[my];
    if (!player) return;
    const isTurn = isMyActionTurn(s) && !_abilityResolving;
    if (!spreadEl._mpSlots || spreadEl._mpSlots.length !== 5 || !spreadEl.contains(spreadEl._mpSlots[0])) {
      spreadEl._mpSlots = [];
      spreadEl.replaceChildren();
      for (let i = 0; i < 5; i++) {
        const slot = doc.createElement('div');
        slot.style.setProperty('--a', ((i - 2) * 4) + 'deg');
        spreadEl.appendChild(slot);
        spreadEl._mpSlots.push(slot);
      }
      target._slotEls = null;
    }
    const selUid = _selected;
    for (let i = 0; i < 5; i++) {
      const slotEl = spreadEl._mpSlots[i];
      const card = player.spread[i];
      let cls = 'slot ';
      if (card) {
        cls += 'filled';
        if (isSlotAnchored(s, my, i)) cls += ' mp-anchored';
        if (isCardSilenced(s, my, card.uid)) cls += ' mp-silenced';
        if (_swapFirst === i) cls += ' mp-swap-a';
        else if (swapSlotChosen()) cls += ' mp-swap-pick';
      } else {
        cls += 'empty';
        if (isTurn && selUid !== null && _invokeCard === null && _swapFirst === null && _purgeSelect === null) cls += ' target';
      }
      slotEl.className = cls;
      if (!card && isTurn && selUid !== null && _invokeCard === null && _swapFirst === null && _purgeSelect === null) slotEl.onclick = () => dispatchPlace(selUid, i);
      else if (card && isTurn && _swapFirst === -1) slotEl.onclick = () => { _swapFirst = i; render(); };
      else if (card && isTurn && swapSlotChosen() && _swapFirst !== i) slotEl.onclick = () => dispatchSwap(_swapFirst, i);
      else slotEl.onclick = null;
      renderSlotCard(slotEl, card, i);
    }
  }

  function renderSlotCard(slotEl, card, emptyNumber) {
    if (card) {
      let cardEl = slotEl.firstElementChild;
      if (!cardEl?.classList?.contains('card') || Number(cardEl.dataset.uid) !== card.uid) {
        slotEl.replaceChildren();
        cardEl = doc.createElement('div');
        cardEl.dataset.uid = card.uid;
        cardEl.innerHTML = mpCardHTML(card);
        if (card.type !== 'interaction') applyCardPhoto(cardEl, card);
        slotEl.appendChild(cardEl);
      }
      cardEl.className = 'card' + (card.type === 'major' ? ' major' : '') + (CARD_SHEET[card.id] ? ' photo' : '') + (card.type === 'interaction' ? ' mp-interaction' : '');
      return cardEl;
    }
    let nm = slotEl.firstElementChild;
    if (!nm?.classList?.contains('num')) {
      slotEl.replaceChildren();
      nm = doc.createElement('div');
      nm.className = 'num';
      slotEl.appendChild(nm);
    }
    nm.textContent = emptyNumber === null ? '' : String(emptyNumber + 1);
    return null;
  }

  function localPendingPlace(s = _state, my = _myIndex) {
    const action = s?.pendingActions?.[my];
    if (!s || action?.type !== MP_ACTIONS.MP_PLACE_CARD) return null;
    const player = s.players?.[my];
    const slotIndex = Number(action.slotIndex);
    if (!player || !Number.isInteger(slotIndex) || slotIndex < 0 || slotIndex >= (player.spread?.length || 0)) return null;
    if (player.spread?.[slotIndex]) return null;
    const card = player.hand?.find(item => item.uid === action.cardUid);
    if (!card) return null;
    return { card, cardUid: action.cardUid, slotIndex };
  }

  function renderMpPurgePrompt() {
    const prompt = el('purgePrompt');
    if (!prompt) return;
    doc.body.classList.toggle('mp-purge-flow-active', _purgeSelect !== null);
    if (_purgeSelect === null) {
      prompt.classList.remove('show');
      return;
    }
    const count = el('purgeCount');
    const confirm = el('purgeConfirm');
    const cancel = el('purgeCancel');
    if (count) count.textContent = String(_purgeSelect.length);
    if (confirm) {
      confirm.disabled = _purgeSelect.length !== 3;
      confirm.onclick = () => target.tlrMpConfirmPurge?.();
    }
    if (cancel) cancel.onclick = () => target.tlrMpCancelAction?.();
    prompt.classList.add('show');
  }

  function clearPendingPlacementPreview() {
    doc.querySelectorAll('.mp-local-pending-card').forEach(node => node.remove());
    doc.querySelectorAll('.mp-local-pending-slot').forEach(slot => {
      slot.classList.remove('mp-local-pending-slot', 'filled');
      slot.style.removeProperty('opacity');
      slot.style.removeProperty('filter');
      if (!slot.querySelector('.card')) slot.classList.add('empty');
    });
    doc.querySelectorAll('.mp-local-pending-hidden').forEach(card => card.classList.remove('mp-local-pending-hidden'));
  }

  function buildPendingSpreadCard(card) {
    const cardEl = doc.createElement('div');
    cardEl.dataset.uid = card.uid;
    cardEl.className = 'card'
      + (card.type === 'major' ? ' major' : '')
      + (CARD_SHEET[card.id] ? ' photo' : '')
      + (card.type === 'interaction' ? ' mp-interaction' : '')
      + ' mp-local-pending-card';
    cardEl.innerHTML = mpCardHTML(card);
    if (card.type !== 'interaction') applyCardPhoto(cardEl, card);
    cardEl.style.setProperty('opacity', '1', 'important');
    cardEl.style.setProperty('filter', 'none', 'important');
    cardEl.onclick = null;
    return cardEl;
  }

  function applyPendingPlacementPreview() {
    if (!doc.body?.classList?.contains('mp-game-active')) return;
    const pending = localPendingPlace();
    clearPendingPlacementPreview();
    if (!pending) return;
    const handCard = doc.querySelector(`body.mp-game-active #hand .card[data-uid="${pending.cardUid}"]`);
    const slot = doc.querySelectorAll('body.mp-game-active #spread .slot')[pending.slotIndex];
    if (!slot) return;
    if (handCard) handCard.classList.add('mp-local-pending-hidden');
    slot.replaceChildren(buildPendingSpreadCard(pending.card));
    slot.classList.remove('empty', 'target');
    slot.classList.add('filled', 'mp-local-pending-slot');
    slot.style.setProperty('opacity', '1', 'important');
    slot.style.setProperty('filter', 'none', 'important');
  }

  function renderPills(s, my) {
    const opp = 1 - my;
    // Reflect the optimistic ability snapshot in my own discards pill so the
    // spent discard shows immediately alongside the drawn/taken cards.
    const mp  = effectiveSelf(s, my), op = s.players[opp];
    const e = (id, val) => { const n = el(id); if (n) n.textContent = val; };
    e('mpOppScore', visibleScoreForPlayer(s, opp, { allowOpponentAdvance: !opponentRevealPending() }));
    e('mpOppDisc', op?.discards ?? 0);
    e('mpMyScore', visibleScoreForPlayer(s, my, { allowOpponentAdvance: true }));
    e('mpMyDisc', mp?.discards ?? 0);
    e('mpThresh', s.scoreTarget ?? 200);
    moveMultPillsOutside();
  }

  function opponentRevealPending() {
    return !!el('mpOppSpread')?.querySelector?.('.slot.mp-reveal-pending');
  }

  function scoredCards(player) {
    const silenced = new Set(player?.silencedCardUids || []);
    return (player?.spread || []).filter(card => card && !silenced.has(card.uid));
  }

  function normalizeMult(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return 1;
    return Math.max(1, Number(number.toFixed(2)));
  }

  function liveSpreadScore(player) {
    const cards = scoredCards(player);
    if (!cards.length) return 0;
    const score = computeScore(cards, { skipFlatBonuses: true, skipRelics: true });
    return Math.floor((score.chips || 0) * normalizeMult(player?.roundMult ?? 1));
  }

  function scoreSpreadRaw(player) {
    const cards = scoredCards(player);
    if (!cards.length) return emptyScore();
    return computeScore(cards, { skipFlatBonuses: true, skipRelics: true });
  }

  function scoreWithRoundMult(player) {
    const score = scoreSpreadRaw(player);
    return Math.floor((score.chips || 0) * normalizeMult(player?.roundMult ?? 1));
  }

  function scoreForPlayer(s, playerIndex) {
    const player = s?.players?.[playerIndex];
    if (!player) return 0;
    const total = player.totalScore ?? 0;
    if (s.phase === MP_PHASES.PLACEMENT || s.phase === MP_PHASES.SCORING) return total + liveSpreadScore(player);
    return total;
  }

  function visibleScoreForPlayer(s, playerIndex, options = {}) {
    const isOpponent = playerIndex === 1 - _myIndex;
    const keepOpponentHidden = isOpponent && !options.allowOpponentAdvance;
    const expected = keepOpponentHidden
      ? (_lastShownScores[playerIndex] ?? s.players[playerIndex]?.totalScore ?? 0)
      : scoreForPlayer(s, playerIndex);
    const numeric = Number(expected);
    if (Number.isFinite(numeric)) _lastShownScores[playerIndex] = numeric;
    return expected;
  }

  function ensureRoundMults(state, before = null, reset = false) {
    if (!state?.players) return;
    state.players.forEach((player, index) => {
      const previous = before?.players?.[index]?.roundMult;
      player.roundMult = reset ? 1 : normalizeMult(player.roundMult ?? previous ?? 1);
    });
  }

  function applyDerivedScoringState(before, state, action) {
    if (!state?.players) return;
    ensureRoundMults(state, before, action?.type === MP_ACTIONS.MP_INIT);
    if (action?.type === MP_ACTIONS.MP_SUBMIT_ACTION) accumulateNewPlacementMult(before, state);
    else if (action?.type === MP_ACTIONS.MP_SCORE_ROUND) correctScoreRoundWithAccumulatedMult(before, state);
    else if (action?.type === MP_ACTIONS.MP_NEW_ROUND) ensureRoundMults(state, before, false);
  }

  function accumulateNewPlacementMult(before, state) {
    if (!before?.players || !state?.players) return;
    for (let playerIndex = 0; playerIndex < state.players.length; playerIndex += 1) {
      if (!spreadChangedByPlacement(before.players[playerIndex], state.players[playerIndex])) continue;
      const beforeScore = scoreSpreadRaw(before.players[playerIndex]);
      const afterScore = scoreSpreadRaw(state.players[playerIndex]);
      const delta = Math.max(0, (afterScore.mult || 1) - (beforeScore.mult || 1));
      if (delta > 0) state.players[playerIndex].roundMult = normalizeMult((state.players[playerIndex].roundMult ?? 1) + delta);
    }
  }

  function correctScoreRoundWithAccumulatedMult(before, state) {
    if (!before?.players || !state?.players) return;
    for (let playerIndex = 0; playerIndex < state.players.length; playerIndex += 1) {
      const beforePlayer = before.players[playerIndex];
      const player = state.players[playerIndex];
      const adjusted = scoreWithRoundMult(beforePlayer);
      const beforeTotal = beforePlayer?.totalScore ?? 0;
      player.roundMult = normalizeMult(player.roundMult ?? beforePlayer?.roundMult ?? 1);
      player.roundScore = adjusted;
      player.totalScore = beforeTotal + adjusted;
    }
    const [p0, p1] = state.players;
    const targetScore = state.scoreTarget ?? 200;
    if ((p0.totalScore ?? 0) >= targetScore || (p1.totalScore ?? 0) >= targetScore) {
      state.phase = MP_PHASES.COMPLETE;
      if (p0.totalScore === p1.totalScore) state.winner = 'draw';
      else state.winner = p0.totalScore > p1.totalScore ? 0 : 1;
    } else {
      state.phase = MP_PHASES.BETWEEN_ROUNDS;
      state.winner = null;
    }
  }

  function spreadChangedByPlacement(beforePlayer, afterPlayer) {
    const beforeSpread = beforePlayer?.spread || [];
    const afterSpread = afterPlayer?.spread || [];
    return afterSpread.some((card, index) => card && !beforeSpread[index]);
  }

  function renderActionButtons(s, my) {
    const p = s.players[my];
    const isTurn = isMyActionTurn(s) && !_abilityResolving;
    const selUid = _selected;
    const selectedCard = selUid !== null ? p?.hand.find(c => c.uid === selUid) : null;
    const discardBtn = el('mpDiscardBtn');
    const purgeBtn = el('mpPurgeBtn');
    const abilityBtn = el('mpAbilityBtn');
    if (discardBtn) {
      discardBtn.disabled = !isTurn || _purgeSelect !== null || _invokeCard !== null || _swapFirst !== null || !selectedCard || (p?.discards ?? 0) <= 0;
      discardBtn.classList.toggle('mp-active-action', !discardBtn.disabled);
      // Refresh the inline button art here (not only in the full render pass) so
      // the enabled/disabled look tracks selection changes routed through
      // refreshSelectionUi(); otherwise the stale ".38 opacity" disabled styling
      // sticks and the button reads as disabled even when it is clickable.
      syncMpButtonArt('mpDiscardBtn');
    }
    if (purgeBtn) {
      const canStartPurge = isTurn && _invokeCard === null && _swapFirst === null && (p?.hand?.length ?? 0) >= 3;
      purgeBtn.disabled = _purgeSelect === null ? !canStartPurge : _purgeSelect.length !== 3;
      purgeBtn.classList.toggle('mp-active-action', _purgeSelect !== null);
      syncMpButtonArt('mpPurgeBtn');
    }
    if (abilityBtn) {
      // The Ability button is dedicated to the player's PERSONA ability (e.g. the
      // Surgeon's swap). Card abilities are invoked through the Discard button
      // (tlrMpDiscard → invokeSelectedCard), matching singleplayer where
      // discarding a card with an ability triggers it. So this button only shows
      // when the persona has an active ability available this turn.
      const personaAction = currentPersonaAbilityAction(s, my);
      const isVisible = !!personaAction && _purgeSelect === null && _invokeCard === null && _swapFirst === null && !_abilityResolving;
      const action = personaAction?.type || '';
      const label = personaAction?.title || 'Persona ability unavailable';
      abilityBtn.disabled = !isVisible;
      abilityBtn.textContent = 'Ability';
      abilityBtn.title = label;
      abilityBtn.setAttribute('aria-label', label);
      abilityBtn.dataset.mpAbilityAction = action;
      abilityBtn.classList.toggle('mp-visible', isVisible);
      abilityBtn.setAttribute('aria-hidden', isVisible ? 'false' : 'true');
    }
  }

  function renderActionPanel(s, my) {
    const panel = el('mpActionPanel');
    if (!panel) return;
    const p = s.players[my];
    const isTurn = isMyActionTurn(s) && !_abilityResolving;
    const selUid = _selected;
    const parts = [];
    if (_abilityResolving) parts.push(`<span class="mp-action-hint">Resolve the ability choice.</span>`);
    else if (mySubmitted(s)) parts.push(`<span class="mp-action-hint">Action submitted. Waiting for opponent…</span>`);
    else if (_purgeSelect !== null) {
      parts.push(`<span class="mp-action-hint">Select 3 cards to purge. ${_purgeSelect.length}/3 selected.</span>`);
      if (_purgeSelect.length === 3) parts.push(`<button class="mp-action-btn invoke" onclick="tlrMpConfirmPurge()" type="button">Purge</button>`);
      parts.push(`<button class="mp-action-btn cancel" onclick="tlrMpCancelAction()" type="button">Cancel</button>`);
    } else if (_invokeCard !== null) {
      parts.push(`<span class="mp-action-hint">Tap a card on the opponent's spread.</span><button class="mp-action-btn cancel" onclick="tlrMpCancelAction()" type="button">Cancel</button>`);
    } else if (_swapFirst !== null) {
      parts.push(`<span class="mp-action-hint">${_swapFirst === -1 ? 'Tap a card in your Spread.' : 'Tap a card in your Hand.'}</span><button class="mp-action-btn cancel" onclick="tlrMpCancelAction()" type="button">Cancel</button>`);
    } else if (selUid !== null && isTurn) {
      const card = p?.hand.find(c => c.uid === selUid);
      if (card && (card.ability || card.abilityType) && canInvokeAbility(s, my, selUid)) parts.push(`<button class="mp-action-btn invoke" onclick="tlrMpInvoke()" type="button">Invoke</button>`);
      if (card?.abilityType === MP_ABILITY_TYPES.MP_BANISH) parts.push(`<span class="mp-action-hint">Discard invokes Banish and removes the opponent's last played card.</span>`);
      else parts.push(`<span class="mp-action-hint">Place it, discard it, or purge 3 cards for +1 discard.</span>`);
    } else if (isTurn && (p?.spread || []).every(Boolean)) {
      parts.push(`<span class="mp-action-hint">Spread complete — waiting for opponent…</span>`);
    } else if (isTurn) {
      if (opponentSubmitted(s)) parts.push(`<span class="mp-action-hint">Opponent is ready. Choose your action.</span>`);
      if (canSwapSpread(s, my)) parts.push(`<button class="mp-action-btn swap" onclick="tlrMpStartSwap()" type="button">Swap Card</button>`);
      if (!opponentSubmitted(s)) parts.push(`<span class="mp-action-hint">Select a card from your hand.</span>`);
    } else if (s.phase === MP_PHASES.BETWEEN_ROUNDS) parts.push(`<span class="mp-action-hint">Starting next set…</span>`);
    else parts.push(`<span class="mp-action-hint">Waiting…</span>`);
    panel.innerHTML = parts.join('');
  }

  function currentPersona() {
    const personaId = _state?.players?.[_myIndex]?.persona;
    return getPersona(personaId);
  }

  function currentPersonaAbilityAction(s = _state, my = _myIndex) {
    const player = s?.players?.[my];
    if (!s || !player || !isMyActionTurn(s)) return null;
    const persona = getPersona(player.persona);
    if (player.swapAvailable && persona?.passives?.freeSpreadSwap) {
      return {
        type: 'persona-swap',
        title: `${persona.ability?.name || 'Persona Ability'}: ${stripMarkup(persona.ability?.rules || 'Swap a card in your Spread with a card in your Hand.')}`,
      };
    }
    return null;
  }

  // A real spread slot index is chosen as the swap source. `_swapFirst` is null
  // when not swapping and -1 while awaiting the first pick; guard against null so
  // the JS `null >= 0` coercion (which is true) does not misfire as "slot chosen".
  function swapSlotChosen() { return Number.isInteger(_swapFirst) && _swapFirst >= 0; }

  function canDispatchSwap(slotIndex, cardUid) {
    const player = _state?.players?.[_myIndex];
    if (!_state || !player || !isMyActionTurn(_state)) return false;
    if (!player.swapAvailable) return false;
    if (!Number.isInteger(slotIndex) || slotIndex < 0 || !player.spread?.[slotIndex]) return false;
    return player.hand?.some(card => card.uid === cardUid);
  }

  function selectedSwapSpreadCard() {
    if (_swapFirst === null || _swapFirst < 0) return null;
    return _state?.players?.[_myIndex]?.spread?.[_swapFirst] || null;
  }

  function syncPersonaPrompt() {
    // During any stage of ability resolution the MP ability flow owns #abilityPrompt
    // and the confirm button. Returning early prevents the persona-swap UI from
    // overriding button.onclick (which would fire cancel instead of confirm) or
    // adding/removing .show from #abilityPrompt (which would trigger the host's
    // MutationObserver and potentially call showOnlyAnchorPrompt mid-flow).
    if (_abilityResolving || _abilityTargeting) return;
    const promptBox = el('abilityPrompt');
    const title = el('abilityPromptTitle');
    const text = el('abilityPromptText');
    const button = el('abilityConfirm');
    if (!promptBox || !title || !text || !button) return;

    if (!_personaSwapRequested || _swapFirst === null) {
      doc.body.classList.remove('mp-persona-ability-active');
      if (promptBox.dataset.mpPersonaPrompt === '1') {
        promptBox.classList.remove('show');
        promptBox.dataset.mpPersonaPrompt = '';
        title.textContent = '';
        text.textContent = '';
        button.disabled = true;
        button.textContent = 'Choose';
        button.onclick = null;
      }
      return;
    }

    const persona = currentPersona();
    const ability = persona?.ability;
    const chosenSpreadCard = selectedSwapSpreadCard();
    const firstStep = !chosenSpreadCard;

    doc.body.classList.add('mp-persona-ability-active');
    promptBox.dataset.mpPersonaPrompt = '1';
    promptBox.classList.add('show');
    title.textContent = ability?.name || 'Persona Ability';
    text.innerHTML = firstStep
      ? `<b>${esc(persona?.name || 'Persona')}:</b> Choose a card in your <b>Spread</b>. Then choose a card in your <b>Hand</b> to swap with it.`
      : `Selected <b>${esc(cleanCardName(chosenSpreadCard))}</b>. Now choose a card in your <b>Hand</b> to swap with it.`;
    button.disabled = false;
    button.textContent = 'Cancel';
    button.onclick = () => target.tlrMpCancelAction?.();
  }

  function syncMpActionPresentation(s = _state, my = _myIndex) {
    if (!doc.body.classList.contains('mp-game-active')) return;
    hideSwipeTutorialInMultiplayer();

    const personaAction = currentPersonaAbilityAction(s, my);
    el('mpActionPanel')?.classList.toggle('mp-hide-mobile-ability-panel', !!personaAction);

    const hasSelectedSwapSlot = swapSlotChosen();
    doc.querySelectorAll('body.mp-game-active #hand .card[data-uid]').forEach(cardEl => {
      cardEl.classList.toggle('mp-surgeon-swap-target', hasSelectedSwapSlot);
    });
    doc.querySelectorAll('body.mp-game-active #spread .slot.mp-swap-pick').forEach(slotEl => {
      slotEl.classList.toggle('mp-surgeon-swap-blocked', hasSelectedSwapSlot);
    });
    // Button art is refreshed in renderActionButtons so it tracks selection
    // changes (which only run refreshSelectionUi, not this presentation pass).
  }

  function syncMpButtonArt(id) {
    const button = el(id);
    if (!button) return;
    const active = !button.disabled;
    button.classList.toggle('mp-active-action', active);
    button.style.setProperty('opacity', active ? '1' : '.38', 'important');
    button.style.setProperty('cursor', active ? 'pointer' : 'default', 'important');
    button.style.setProperty('filter', active ? 'brightness(1.06)' : 'none', 'important');
    button.style.setProperty('color', active ? '#f0d58a' : '#8a7551', 'important');
    button.style.setProperty('border-color', active ? 'rgba(220,176,92,.78)' : 'rgba(180,140,90,.28)', 'important');
    button.style.setProperty('background', active ? 'rgba(74,46,18,.92)' : 'rgba(28,18,10,.68)', 'important');
    button.style.setProperty('background-color', active ? 'rgba(74,46,18,.92)' : 'rgba(28,18,10,.68)', 'important');
    button.style.setProperty('box-shadow', active
      ? '0 0 0 1px rgba(255,217,120,.16), 0 7px 18px rgba(0,0,0,.42), inset 0 1px rgba(255,255,255,.08)'
      : '0 4px 12px rgba(0,0,0,.28)', 'important');
  }

  function hideSwipeTutorialInMultiplayer() {
    doc.querySelectorAll('.hand-swipe-hint').forEach(node => {
      node.hidden = true;
      node.setAttribute('aria-hidden', 'true');
      node.style.setProperty('display', 'none', 'important');
      node.style.setProperty('opacity', '0', 'important');
    });
  }

  function moveMultPillsOutside() {
    if (!doc.body.classList.contains('mp-game-active')) return;
    const isDesktop = target.matchMedia?.('(min-width: 641px)').matches ?? false;
    doc.querySelectorAll('.mp-pill-score').forEach(pill => {
      const parent = pill.parentElement;
      if (!parent) return;
      const embedded = pill.querySelector(':scope > .mp-mult-inline');
      const putRight = isDesktop && pill.classList.contains('mp-pill-opp-score');
      const adjacent = putRight
        ? (pill.nextElementSibling?.classList?.contains('mp-mult-inline') ? pill.nextElementSibling : null)
        : (pill.previousElementSibling?.classList?.contains('mp-mult-inline') ? pill.previousElementSibling : null);
      let mult = adjacent || embedded;
      if (!mult) return;
      if (embedded && embedded !== mult) embedded.remove();
      if (putRight) {
        if (mult.parentElement !== parent || pill.nextElementSibling !== mult) parent.insertBefore(mult, pill.nextSibling);
        mult.classList.add('mp-mult-right');
        mult.classList.remove('mp-mult-left');
      } else {
        if (mult.parentElement !== parent || mult.nextElementSibling !== pill) parent.insertBefore(mult, pill);
        mult.classList.add('mp-mult-left');
        mult.classList.remove('mp-mult-right');
      }
      const cleanText = mult.textContent.replace(/[()]/g, '').trim();
      if (mult.textContent !== cleanText) mult.textContent = cleanText;
      if (!putRight) parent.classList.add('mp-has-left-mult');
      pill.style.setProperty('width', '118px', 'important');
      pill.style.setProperty('gap', '5px', 'important');
    });
  }

  function updateScoreMultPills(state = _state, options = {}) {
    if (!state?.players) return;
    if (Number.isInteger(options.onlyPlayerIndex)) {
      const id = options.onlyPlayerIndex === _myIndex ? 'mpMyScore' : 'mpOppScore';
      updateOneScorePill(id, state, options.onlyPlayerIndex);
      return;
    }
    updateOneScorePill('mpMyScore', state, _myIndex);
    if (options.includeOpponent !== false) updateOneScorePill('mpOppScore', state, 1 - _myIndex);
  }

  function updateOneScorePill(scoreId, state, playerIndex) {
    const scoreNode = el(scoreId);
    if (!scoreNode) return;
    const player = state.players[playerIndex];
    const score = String(scoreForPlayer(state, playerIndex));
    if (scoreNode.textContent !== score) scoreNode.textContent = score;
    const pill = scoreNode.closest('.mp-pill-score') || scoreNode.parentElement;
    if (!pill) return;
    let mult = pill.querySelector('.mp-mult-inline');
    if (!mult) {
      mult = doc.createElement('span');
      mult.className = 'mp-mult-inline';
      pill.appendChild(mult);
    }
    const multText = `${formatMult(player?.roundMult ?? 1)}x`;
    if (mult.textContent !== multText) mult.textContent = multText;
    moveMultPillsOutside();
  }

  // Safety net: if the score pills are rebuilt or reordered by any render path
  // outside the action callbacks, re-sync the mult spans. Writes are guarded to
  // only mutate on real changes, so this observer settles instead of looping.
  function installMultPillObserver() {
    const MutationObserverCtor = target.MutationObserver || globalThis.MutationObserver;
    if (!MutationObserverCtor) return;
    let queued = false;
    const observer = new MutationObserverCtor(records => {
      if (!_state || !doc.body.classList.contains('mp-game-active')) return;
      if (!records.some(record => {
        const node = record.target?.nodeType === 1 ? record.target : record.target?.parentElement;
        return node?.closest?.('#mpMidWrap,.mp-pill-score,.mp-mult-inline');
      })) return;
      if (queued) return;
      queued = true;
      target.requestAnimationFrame?.(() => { queued = false; updateScoreMultPills(); });
    });
    observer.observe(doc.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
  }

  function playPlacementFeedback(before, state) {
    if (!before?.players || !state?.players) return;
    const placements = findPlacements(before, state);
    if (!placements.length) return;

    _latestEffectsUntil = Math.max(_latestEffectsUntil, Date.now() + EFFECT_WINDOW_MS + OPPONENT_REVEAL_DELAY_MS);
    target.holdEffects?.(EFFECT_WINDOW_MS + OPPONENT_REVEAL_DELAY_MS);

    target.requestAnimationFrame?.(() => {
      placements.forEach((placement, index) => {
        const localDelay = placement.playerIndex === _myIndex ? 0 : OPPONENT_REVEAL_DELAY_MS;
        target.setTimeout(() => playSinglePlacementFeedback(before, state, placement), localDelay + index * 120);
      });
    });
  }

  function playSinglePlacementFeedback(before, state, placement) {
    const { playerIndex, slotIndex, card } = placement;
    const slotEl = slotElementForPlayer(playerIndex, slotIndex);
    if (!slotEl) return;

    const localAlreadyPlayed = playerIndex === _myIndex && _localPlacementFeedbackKeys.delete(`${slotIndex}:${card?.uid}`);
    const cardEl = slotEl.querySelector('.card');
    if (cardEl && !localAlreadyPlayed) {
      cardEl.classList.add('landing');
      cardEl.addEventListener('animationend', () => cardEl.classList.remove('landing'), { once: true });
    }

    updateScoreMultPills(state, { onlyPlayerIndex: playerIndex });
    slotGhost(slotEl, `+${card.points || 0}`);
    const _scoreDelta = Math.max(0, liveSpreadScore(state.players[playerIndex]) - liveSpreadScore(before.players[playerIndex]));
    for (let _i = 0; _i < _scoreDelta; _i += 1) {
      target.setTimeout(() => scoreGhost(playerIndex, '+1'), 28 * _i);
    }
    if (!localAlreadyPlayed) {
      target.playSound?.('place');
      target.haptic?.(12);
    }

    const beforeScore = scoreSpreadRaw(before.players[playerIndex]);
    const afterScore = scoreSpreadRaw(state.players[playerIndex]);
    const newMelds = diffMelds(beforeScore, afterScore);
    let delay = 420;
    let announceOffset = 0;

    for (const meld of newMelds) {
      const slots = slotsForMeld(state.players[playerIndex]?.spread || [], meld.name);
      const visualSlots = slots.map(index => slotElementForPlayer(playerIndex, index)).filter(Boolean);
      visualSlots.forEach((slot, index) => target.setTimeout(() => bumpSlot(slot), delay + index * 130));

      const anchor = visualSlots[visualSlots.length - 1] || slotEl;
      const ghostDelay = delay + visualSlots.length * 130 + 120;
      target.setTimeout(() => slotGhost(anchor, meldText(meld), true), ghostDelay);

      if (!meld.name.startsWith('⚷') && meld.name !== 'Omen' && meld.name !== 'Resonance') {
        target.setTimeout(() => {
          target.centerGhost?.(normMeldName(meld.name), meld.mult > 1.5 || (meld.mode === 'add' && meld.mult >= 1.5));
          target.playSound?.('meld');
          target.haptic?.([0, 10, 35, 12]);
        }, delay + announceOffset);
      }

      if (meld.mult > 0) {
        const shownMult = meld.mode === 'add' ? meld.mult : meld.mult - 1;
        target.setTimeout(() => scoreGhost(playerIndex, signed(shownMult), true), ghostDelay + 200);
      }

      delay += visualSlots.length * 130 + 700;
      announceOffset += 600;
      _latestEffectsUntil = Math.max(_latestEffectsUntil, Date.now() + delay + 1100);
      target.holdEffects?.(delay + 1100);
    }

    target.setTimeout(() => updateScoreMultPills(state, { onlyPlayerIndex: playerIndex }), Math.min(delay + 180, EFFECT_WINDOW_MS));
  }

  function findPlacements(before, state) {
    const out = [];
    for (let playerIndex = 0; playerIndex < state.players.length; playerIndex += 1) {
      const beforeSpread = before.players[playerIndex]?.spread || [];
      const afterSpread = state.players[playerIndex]?.spread || [];
      for (let slotIndex = 0; slotIndex < afterSpread.length; slotIndex += 1) {
        const beforeCard = beforeSpread[slotIndex];
        const afterCard = afterSpread[slotIndex];
        if (!beforeCard && afterCard) out.push({ playerIndex, slotIndex, card: afterCard });
      }
    }
    return out;
  }

  function slotElementForPlayer(playerIndex, slotIndex) {
    const spreadId = playerIndex === _myIndex ? 'spread' : 'mpOppSpread';
    const spread = el(spreadId);
    return spread?._mpSlots?.[slotIndex] || spread?.querySelectorAll?.('.slot')?.[slotIndex] || null;
  }

  function bumpSlot(slot) {
    slot.classList.remove('bump');
    requestAnimationFrame(() => requestAnimationFrame(() => slot.classList.add('bump')));
  }

  function slotGhost(slot, text, big = false) {
    if (!slot) return;
    target.holdEffects?.(1700);
    const rect = slot.getBoundingClientRect();
    const ghost = doc.createElement('div');
    ghost.className = `ghost ${big ? 'big' : ''}`;
    ghost.textContent = text;
    ghost.style.setProperty('--dx', `${(Math.random() * 20 - 10).toFixed(1)}px`);
    ghost.style.setProperty('--rot', `${(Math.random() * 8 - 4).toFixed(1)}deg`);
    ghost.style.position = 'fixed';
    ghost.style.left = `${rect.left + rect.width / 2}px`;
    ghost.style.top = `${rect.top - 10}px`;
    ghost.style.zIndex = '99999';
    doc.body.appendChild(ghost);
    const card = slot.querySelector('.card');
    if (card?.animate && !prefersReducedMotion()) {
      card.animate([{ filter: 'brightness(1)' }, { filter: 'brightness(1.22)' }, { filter: 'brightness(1)' }], { duration: 220, easing: 'ease-out' });
    }
    target.setTimeout(() => ghost.remove(), 1700);
  }

  function scoreGhost(playerIndex, label, isMult = false) {
    const id = playerIndex === _myIndex ? 'mpMyScore' : 'mpOppScore';
    const scoreNode = el(id);
    const pill = scoreNode?.closest?.('.mp-pill-score') || scoreNode;
    if (!pill) return;
    const rect = pill.getBoundingClientRect();
    const ghost = doc.createElement('span');
    ghost.className = `score-ghost ${isMult ? 'mult' : ''}`;
    ghost.textContent = label;
    ghost.style.left = `${rect.left + 8 + Math.random() * Math.max(1, rect.width - 16)}px`;
    ghost.style.top = `${rect.top + rect.height * 0.25}px`;
    doc.body.appendChild(ghost);
    if (pill.animate && !prefersReducedMotion()) {
      pill.animate([{ filter: 'brightness(1)' }, { filter: 'brightness(1.25)' }, { filter: 'brightness(1)' }], { duration: 260, easing: 'ease-out' });
    }
    target.setTimeout(() => ghost.remove(), 950);
  }

  function diffMelds(beforeScore, afterScore) {
    const before = new Map((beforeScore.melds || []).map(meld => [meld.name, meld]));
    const out = [];
    for (const meld of afterScore.melds || []) {
      const old = before.get(meld.name);
      if (!old) {
        out.push(meld);
        continue;
      }
      const chips = (meld.chips || 0) - (old.chips || 0);
      const mult = (meld.mult || 0) - (old.mult || 0);
      if (chips > 0 || mult > 0) out.push({ ...meld, chips, mult });
    }
    return out;
  }

  function slotsForMeld(spread, name) {
    const filled = (spread || []).map((card, index) => card ? { card, index } : null).filter(Boolean);
    if (name.startsWith('Three of a Kind') || name.startsWith('Four of a Kind')) {
      const rank = COURT_RANKS.find(rankName => name.includes(`${rankName}s`));
      const limit = name.startsWith('Three') ? 3 : 4;
      return rank ? filled.filter(item => item.card.type === 'court' && item.card.rank === rank).slice(0, limit).map(item => item.index) : [];
    }
    if (name.startsWith('Full Court')) {
      const limit = tierFrom(name) || 4;
      const seen = new Set();
      const out = [];
      for (const item of filled) {
        if (out.length >= limit) break;
        if (item.card.type === 'court' && COURT_RANKS.includes(item.card.rank) && !seen.has(item.card.rank)) {
          seen.add(item.card.rank);
          out.push(item.index);
        }
      }
      return out;
    }
    if (name.startsWith('Royal Court')) {
      const suit = MINOR_SUITS.find(suitName => name.includes(suitName));
      const limit = tierFrom(name) || 4;
      return suit ? filled.filter(item => item.card.suit === suit).slice(0, limit).map(item => item.index) : [];
    }
    if (name.startsWith('Sequence')) {
      const majors = filled
        .filter(item => item.card.type === 'major')
        .sort((a, b) => majorNumber(a.card) - majorNumber(b.card));
      if (!majors.length) return [];
      let bestStart = 0, bestLen = 1, curStart = 0, curLen = 1;
      for (let i = 1; i < majors.length; i += 1) {
        if (majorNumber(majors[i].card) === majorNumber(majors[i - 1].card) + 1) {
          curLen += 1;
          if (curLen > bestLen) { bestLen = curLen; bestStart = curStart; }
        } else {
          curStart = i;
          curLen = 1;
        }
      }
      const want = tierFrom(name) || bestLen;
      return majors.slice(bestStart, bestStart + want).map(item => item.index);
    }
    if (name === 'Path of the Magi') {
      const ids = new Set(['I', 'II', 'V']);
      return filled.filter(item => ids.has(item.card.id)).map(item => item.index);
    }
    return filled.map(item => item.index);
  }

  function meldText(meld) {
    if (typeof target.meldStr === 'function') return target.meldStr([meld.name, meld.chips || 0, meld.mult || 0, meld.mode]);
    const shown = meld.mode === 'add' ? meld.mult : meld.mult - 1;
    if (meld.chips && meld.mult) return `${signed(meld.chips)} ${signed(shown)}`;
    if (meld.chips) return signed(meld.chips);
    if (meld.mult) return signed(shown);
    return '';
  }

  function normMeldName(name) {
    if (typeof target.normMeldName === 'function') return target.normMeldName(name);
    if (name.startsWith('Sequence')) return 'Sequence';
    if (name.startsWith('Royal Court')) return 'Royal Court';
    if (name.startsWith('Full Court')) return 'Full Court';
    if (name.startsWith('Three of a Kind')) return 'Three of a Kind';
    if (name.startsWith('Four of a Kind')) return 'Four of a Kind';
    return name;
  }

  function tierFrom(name) {
    const match = String(name).match(/\((\d+)/) || String(name).match(/of (\d+)/);
    return match ? Number(match[1]) : 0;
  }

  function majorNumber(card) {
    return card.number ?? card.num ?? 0;
  }

  function signed(value) {
    const number = Number(value || 0);
    return `${number >= 0 ? '+' : ''}${number.toFixed(2).replace(/\.?0+$/, '')}`;
  }

  function formatMult(value) {
    return normalizeMult(value).toFixed(2).replace(/\.?0+$/, '');
  }

  function emptyScore() {
    return { baseChips: 0, chips: 0, mult: 1, melds: [], finalScore: 0 };
  }

  function cloneState(state) {
    if (!state) return null;
    try { return structuredClone(state); }
    catch (_) { return JSON.parse(JSON.stringify(state)); }
  }

  function prefersReducedMotion() {
    try { return !!target.matchMedia?.('(prefers-reduced-motion: reduce)').matches; }
    catch (_) { return false; }
  }

  function submitAction(action, options = {}) {
    if (!_state || mySubmitted(_state)) return;
    const fullAction = { ...action, playerIndex: _myIndex };
    // Optimistically resolve my own card ability locally so its effect (drawn or
    // taken cards, spent discard) shows immediately, instead of waiting for the
    // simultaneous cycle to resolve. Card abilities only touch my own piles, and
    // applyImmediateAction is deterministic, so this snapshot matches what the
    // canonical resolution will produce. Cleared once _state catches up.
    if (action.type === MP_ACTIONS.MP_INVOKE_ABILITY) {
      const resolved = applyImmediateAction(_state, fullAction);
      if (resolved && !resolved.error) _optimisticSelf = resolved.players[_myIndex];
    }
    // Mark cards being removed so selfHandView hides them immediately, preventing
    // a one-frame flash where they reappear as unselected before _state updates.
    if (action.type === MP_ACTIONS.MP_DISCARD_CARD && action.cardUid != null) _pendingRemovalUids.add(action.cardUid);
    else if (action.type === MP_ACTIONS.MP_INVOKE_ABILITY && action.cardUid != null) _pendingRemovalUids.add(action.cardUid);
    else if (action.type === MP_ACTIONS.MP_PURGE_CARDS) action.cardUids?.forEach(uid => _pendingRemovalUids.add(uid));
    target.tlrMpDispatch?.({ type: MP_ACTIONS.MP_SUBMIT_ACTION, playerIndex: _myIndex, action: fullAction });
    _invokeCard = null; _swapFirst = null; _purgeSelect = null; _abilityResolving = false;
    if (!options.keepSelected) _selected = null;
    target.refreshHandState?.();
    render();
  }

  function dispatchPlace(cardUid, slotIndex) {
    submitAction({ type: MP_ACTIONS.MP_PLACE_CARD, cardUid, slotIndex }, { keepSelected: true });
    playLocalPlacementSubmitFeedback(cardUid, slotIndex);
  }
  function playLocalPlacementSubmitFeedback(cardUid, slotIndex) {
    if (!_state || cardUid == null || !Number.isInteger(slotIndex)) return;
    _localPlacementFeedbackKeys.add(`${slotIndex}:${cardUid}`);
    const runFeedback = () => {
      applyPendingPlacementPreview();
      const slotEl = slotElementForPlayer(_myIndex, slotIndex);
      const cardEl = slotEl?.querySelector?.('.card');
      if (cardEl) {
        cardEl.classList.add('landing');
        cardEl.addEventListener('animationend', () => cardEl.classList.remove('landing'), { once: true });
      }
      target.playSound?.('place');
      target.haptic?.(12);
    };
    if (typeof target.requestAnimationFrame === 'function') target.requestAnimationFrame(runFeedback);
    else target.setTimeout?.(runFeedback, 0);
  }

  function dispatchSwap(slotIndex, cardUid) {
    if (!canDispatchSwap(slotIndex, cardUid)) return;
    target.tlrMpDispatch?.({
      type: MP_ACTIONS.MP_SUBMIT_ACTION,
      playerIndex: _myIndex,
      action: {
        type: MP_ACTIONS.MP_SWAP_SPREAD,
        playerIndex: _myIndex,
        slotIndex,
        cardUid,
      },
    });
    _swapFirst = null;
    _selected = null;
    _personaSwapRequested = false;
    target.refreshHandState?.();
  }
  function handleInvokeTarget(playerIdx, slotIdx) {
    if (_invokeCard === null) return;
    submitAction({ type: MP_ACTIONS.MP_INVOKE_ABILITY, cardUid: _invokeCard, target: { playerIndex: playerIdx, slotIndex: slotIdx } });
  }

  async function invokeSelectedCard() {
    const my = _myIndex;
    const uid = _selected;
    if (!_state || uid === null || mySubmitted(_state) || _abilityResolving) return;
    const card = _state.players[my].hand.find(c => c.uid === uid);
    if (!card) return;
    if (card.abilityType === MP_ABILITY_TYPES.MP_SEAL) { _invokeCard = uid; render(); return; }
    if (card.ability || card.abilityType) {
      let abilityChoice = null;
      if (card.ability && !card.abilityType) {
        _abilityResolving = true;
        render();
        try { abilityChoice = await buildMpAbilityChoice(card); }
        // renderAbilityPrompt() must run once resolution ends: render() only
        // reconciles the prompt while _abilityTargeting is set, so without this
        // the mp-ability-flow-active body class (which the injected style uses to
        // show #abilityPrompt) stays on and the targeting box never disappears.
        finally { _abilityResolving = false; renderAbilityPrompt(); render(); }
        if (abilityChoice === null) return;
      }
      submitAction({ type: MP_ACTIONS.MP_INVOKE_ABILITY, cardUid: uid, abilityChoice });
    } else submitAction({ type: MP_ACTIONS.MP_DISCARD_CARD, cardUid: uid });
  }

  function startPurgeMode() {
    if (!_state || !isMyActionTurn() || _abilityResolving) return;
    const p = _state.players[_myIndex];
    if (!p || p.hand.length < 3) return;
    _purgeSelect = [];
    _selected = null;
    render();
  }
  function confirmPurge() { if (_state && _purgeSelect?.length === 3 && !mySubmitted(_state)) submitAction({ type: MP_ACTIONS.MP_PURGE_CARDS, cardUids: _purgeSelect.slice() }); }
  function toggleMpPurgeCard(uid) {
    if (_purgeSelect === null || mySubmitted(_state)) return;
    const idx = _purgeSelect.indexOf(uid);
    if (idx >= 0) _purgeSelect.splice(idx, 1); else if (_purgeSelect.length < 3) _purgeSelect.push(uid);
    render();
  }

  async function buildMpAbilityChoice(sourceCard) {
    const player = _state?.players?.[_myIndex];
    const ability = sourceCard?.ability ? getAbility(sourceCard.ability) : null;
    if (!player || !ability) return {};
    if (ability.type === ABILITY_TYPES.DRAW) return {};
    if (ability.type === ABILITY_TYPES.WORLD) {
      const afterHand = player.hand.filter(card => card.uid !== sourceCard.uid);
      const pool = [...player.deck, ...player.discard, ...player.spread.filter(Boolean), ...afterHand, sourceCard];
      const shuffled = shuffleDeck(pool);
      const handSize = handSizeForPersona(player.persona);
      return { handUids: shuffled.slice(0, handSize).map(card => card.uid), deckUids: shuffled.slice(handSize).map(card => card.uid) };
    }
    // PEEK: MP takes from top of deck without reshuffle (no shared discard behaviour needed).
    // renderAbilityPrompt() is called here (without _abilityTargeting) to push
    // mp-ability-flow-active onto the body — disabling action buttons while the
    // card-choice modal is open, exactly as NEIGHBOR/BETWEEN do during targeting.
    if (ability.type === ABILITY_TYPES.PEEK) {
      renderAbilityPrompt();
      const held = player.deck.slice(0, ability.count ?? 1);
      if (!held.length) return fallbackChoice('Peek — no cards');
      const picked = await showMpCardChoice(`Peek ${held.length}`, 'Pick one. The rest go to the bottom.', held);
      return picked ? { takenCardUid: picked.uid } : null;
    }

    // Shared async flow for SEARCH, NEIGHBOR, KIN, MIRROR, BETWEEN.
    // renderAbilityPrompt() here ensures mp-ability-flow-active is on the body
    // before any async step: SEARCH goes straight to showMpCardChoice with no
    // anchor phase, so without this call it would show the modal without the
    // class (leaving action buttons enabled). NEIGHBOR/KIN/MIRROR/BETWEEN also
    // call renderAbilityPrompt() inside selectAbilityTargets, so this is harmless.
    renderAbilityPrompt();
    const choice = await buildAbilityChoiceAsync(
      ability,
      { deck: player.deck, hand: player.hand, spread: player.spread.filter(Boolean), sourceCardUid: sourceCard.uid },
      {
        showChoice:    showMpCardChoice,
        selectTargets: selectAbilityTargets,
        sortCards:     sortChoiceCards,
        cleanName:     cleanCardName,
        shuffleDeck,
        isTargetable:  card => card.type === 'major' || card.type === 'court',
      },
    );

    if (!choice) return null;
    if (choice.kind === 'fallback') return fallbackChoice(`${ability.title ?? ability.type} — no valid targets`);
    if (choice.kind === 'take') return { takenCardUid: choice.takenCardUid, ...(choice.anchorUids?.length ? { anchorUids: choice.anchorUids } : {}) };
    if (choice.kind === 'search') return { takenCardUid: choice.takenCardUid, deckOrderUids: choice.deckOrderUids };
    return {};
  }

  async function fallbackChoice(title) { await showMpNotice(title, 'No valid target was available. Draw 1 instead.'); return { fallbackDraw: 1 }; }

  // ── Visible hand/spread anchor selection (folded from mpSingleplayerAbilityFlow) ──
  function selectAbilityTargets(title, prompt, cards, count, previewFn = null) {
    clearAbilityAutoConfirmTimer();
    return new Promise(resolve => {
      _abilityTargeting = {
        title,
        prompt,
        validIds: new Set(cards.map(card => card.uid)),
        picked: [],
        count,
        previewFn,
        resolve,
      };
      renderAbilityPrompt();
      refreshAbilityTargets();
    });
  }

  function abilityTargetingCards() {
    const player = _state?.players?.[_myIndex];
    return [...(player?.hand || []), ...((player?.spread || []).filter(Boolean))];
  }

  function handleAbilityTargetCard(card) {
    if (!_abilityTargeting || !_abilityTargeting.validIds.has(card.uid)) return;
    const picked = _abilityTargeting.picked;
    const index = picked.indexOf(card.uid);
    if (index >= 0) picked.splice(index, 1);
    else {
      if (picked.length >= _abilityTargeting.count) picked.shift();
      picked.push(card.uid);
    }
    renderAbilityPrompt();
    refreshAbilityTargets();

    // If this tap just filled the last required pick (added, not removed),
    // resolve automatically instead of waiting for a separate Confirm tap.
    clearAbilityAutoConfirmTimer();
    const justPicked = index < 0;
    if (justPicked && _abilityTargeting.picked.length >= _abilityTargeting.count) {
      _abilityAutoConfirmTimer = target.setTimeout(() => {
        _abilityAutoConfirmTimer = null;
        confirmAbilityTargeting();
      }, MP_AUTO_CONFIRM_DELAY_MS);
    }
  }

  function confirmAbilityTargeting() {
    clearAbilityAutoConfirmTimer();
    if (!_abilityTargeting || _abilityTargeting.picked.length < _abilityTargeting.count) return;
    const allCards = abilityTargetingCards();
    const pickedCards = _abilityTargeting.picked.map(uid => allCards.find(card => card.uid === uid)).filter(Boolean);
    const resolve = _abilityTargeting.resolve;
    clearAbilityTargeting();
    resolve(pickedCards);
  }

  function cancelAbilityTargeting() {
    clearAbilityAutoConfirmTimer();
    if (!_abilityTargeting) return;
    const resolve = _abilityTargeting.resolve;
    clearAbilityTargeting();
    if (resolve) resolve(null);
  }

  function clearAbilityTargeting() {
    _abilityTargeting = null;
    renderAbilityPrompt();
    clearAbilityTargetClasses();
  }

  function restoreAbilityConfirm() {
    const button = el('abilityConfirm');
    if (!button) return;
    button.onclick = null;
    if (_abilityConfirmOriginalOnclick) button.setAttribute('onclick', _abilityConfirmOriginalOnclick);
  }

  function renderAbilityPrompt() {
    const promptBox = el('abilityPrompt');
    doc.body.classList.toggle('mp-ability-flow-active', !!_abilityTargeting || _abilityResolving);
    if (!promptBox) return;

    if (!_abilityTargeting) {
      promptBox.classList.remove('show');
      return;
    }

    const title = el('abilityPromptTitle');
    const text = el('abilityPromptText');
    const button = el('abilityConfirm');
    if (title) title.textContent = _abilityTargeting.title;

    let preview = '';
    if (_abilityTargeting.previewFn && _abilityTargeting.picked.length) {
      const allCards = abilityTargetingCards();
      const picked = _abilityTargeting.picked.map(uid => allCards.find(card => card.uid === uid)).filter(Boolean);
      preview = _abilityTargeting.previewFn(...picked) || '';
    }

    if (text) text.innerHTML = preview ? `${escAbility(_abilityTargeting.prompt)}<br><b>${escAbility(preview)}</b>` : escAbility(_abilityTargeting.prompt);
    if (button) {
      button.disabled = _abilityTargeting.picked.length < _abilityTargeting.count;
      button.onclick = confirmAbilityTargeting;
    }
    promptBox.classList.add('show');
  }

  function refreshAbilityTargets() {
    clearAbilityTargetClasses();
    if (!_abilityTargeting) return;
    const player = _state?.players?.[_myIndex];
    const picked = new Set(_abilityTargeting.picked);

    doc.querySelectorAll('body.mp-game-active #hand .card[data-uid]').forEach(cardEl => {
      const uid = Number(cardEl.dataset.uid);
      const valid = _abilityTargeting.validIds.has(uid);
      const isPicked = valid && picked.has(uid);
      cardEl.classList.toggle('ability-target', valid && !isPicked);
      cardEl.classList.toggle('ability-picked', isPicked);
      cardEl.classList.toggle('ability-disabled', !valid);
    });

    doc.querySelectorAll('body.mp-game-active #spread .slot').forEach((slot, index) => {
      const card = player?.spread?.[index] || null;
      const cardEl = slot.querySelector('.card[data-uid]');
      if (!card || !cardEl) {
        slot.classList.add('ability-empty-slot');
        return;
      }
      const valid = _abilityTargeting.validIds.has(card.uid);
      const isPicked = valid && picked.has(card.uid);
      slot.classList.toggle('ability-target-slot', valid && !isPicked);
      slot.classList.toggle('ability-picked-slot', isPicked);
      slot.classList.toggle('ability-disabled-slot', !valid);
      cardEl.classList.toggle('ability-target', valid && !isPicked);
      cardEl.classList.toggle('ability-picked', isPicked);
      cardEl.classList.toggle('ability-disabled', !valid);
    });
  }

  function clearAbilityTargetClasses() {
    doc.querySelectorAll('body.mp-game-active #hand .card, body.mp-game-active #spread .card').forEach(cardEl => {
      cardEl.classList.remove('ability-target', 'ability-picked', 'ability-disabled');
    });
    doc.querySelectorAll('body.mp-game-active #spread .slot').forEach(slot => {
      slot.classList.remove('ability-target-slot', 'ability-picked-slot', 'ability-disabled-slot', 'ability-empty-slot');
    });
    doc.body.classList.toggle('mp-ability-flow-active', !!_abilityTargeting || _abilityResolving);
  }

  function escAbility(value) {
    return String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  }

  // Capture-phase listener: while an anchor pick is active, tapping a hand or
  // spread card toggles it as a target instead of falling through to the normal
  // selection/placement handlers.
  function installAbilityTargetClicks() {
    doc.addEventListener('click', event => {
      if (!_abilityTargeting || !doc.body.classList.contains('mp-game-active')) return;
      const cardEl = event.target.closest?.('body.mp-game-active #hand .card[data-uid], body.mp-game-active #spread .card[data-uid]');
      if (!cardEl) return;

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation?.();

      const uid = Number(cardEl.dataset.uid);
      const card = abilityTargetingCards().find(item => item.uid === uid);
      if (card) handleAbilityTargetCard(card);
    }, true);
  }
  function sortChoiceCards(cards) { if (typeof target.sortCards === 'function') return target.sortCards(cards.slice()); return cards.slice().sort((a, b) => cleanCardName(a).localeCompare(cleanCardName(b))); }
  function cleanCardName(card) { try { return cardTitle(card).replace(/<[^>]+>/g, ''); } catch (_) { return card?.name || card?.id || 'Card'; } }

  function showMpNotice(title, prompt) {
    return new Promise(resolve => {
      const modal = el('modal'), titleEl = el('modalTitle'), promptEl = el('modalPrompt'), choices = el('choices'), toggle = el('modalToggle');
      if (!modal || !titleEl || !promptEl || !choices) { resolve(); return; }
      titleEl.textContent = title; promptEl.textContent = prompt; if (toggle) toggle.textContent = 'Hide'; choices.innerHTML = '';
      const btn = doc.createElement('button'); btn.className = 'mp-action-btn invoke'; btn.type = 'button'; btn.textContent = 'Continue';
      btn.onclick = () => { modal.classList.remove('show', 'collapsed'); resolve(); };
      choices.appendChild(btn); modal.classList.remove('collapsed'); modal.classList.add('show'); target.playSound?.('flip');
    });
  }
  function showMpCardChoice(title, prompt, cards) {
    return new Promise(resolve => {
      // A single candidate isn't a choice — hand it over without popping the modal.
      if ((cards || []).length === 1) { target.playSound?.('flip'); resolve(cards[0]); return; }
      const modal = el('modal'), titleEl = el('modalTitle'), promptEl = el('modalPrompt'), choices = el('choices'), toggle = el('modalToggle');
      if (!modal || !titleEl || !promptEl || !choices) { resolve(null); return; }
      titleEl.textContent = title; promptEl.textContent = prompt; if (toggle) toggle.textContent = 'Hide'; choices.innerHTML = '';
      const finish = card => { modal.classList.remove('show', 'collapsed'); resolve(card || null); };
      for (const card of cards || []) {
        const cardEl = doc.createElement('div'); cardEl.className = 'card ' + (card.type === 'major' ? 'major' : ''); cardEl.innerHTML = mpCardHTML(card);
        if (card.type !== 'interaction') applyCardPhoto(cardEl, card);
        cardEl.onclick = () => finish(card); choices.appendChild(cardEl);
      }
      const cancel = doc.createElement('button'); cancel.className = 'mp-action-btn cancel'; cancel.type = 'button'; cancel.textContent = 'Cancel'; cancel.onclick = () => finish(null); choices.appendChild(cancel);
      modal.classList.remove('collapsed'); modal.classList.add('show'); target.playSound?.('flip');
    });
  }

  function showScoringOverlay(s) {
    const overlay = el('mpOverlay'), box = el('mpOvBox');
    if (!box || !overlay) return;
    const rs = roundScores(s), ts = scores(s);
    const my = _myIndex, opp = 1 - my;
    box.innerHTML = `<h2 class="mp-ov-title">Round ${s.round ?? 1} Complete</h2><div class="mp-ov-scores"><div><div class="mp-ov-score-val">${rs[my]}</div><div class="mp-ov-score-label">You</div></div><div class="mp-ov-vs">vs</div><div><div class="mp-ov-score-val">${rs[opp]}</div><div class="mp-ov-score-label">Opponent</div></div></div><div class="mp-ov-totals">Total: ${ts[my]} – ${ts[opp]} / ${s.scoreTarget ?? 200}</div><p class="mp-ov-waiting">Starting next set…</p>`;
    overlay.classList.remove('mp-ov-hidden');
    doc.body.classList.add('mp-overlay-active');
  }
  function showCompleteOverlay(s, my) {
    const overlay = el('mpOverlay'), box = el('mpOvBox');
    if (!box || !overlay) return;
    const ts = scores(s), w = s.winner, result = w === 'draw' ? 'Draw' : (w === my ? 'Victory' : 'Defeat'), cls = w === 'draw' ? 'draw' : (w === my ? 'win' : 'lose');
    box.innerHTML = `<h2 class="mp-ov-title">Match Over</h2><p class="mp-ov-winner ${cls}">${result}</p><div class="mp-ov-scores"><div><div class="mp-ov-score-val">${ts[my]}</div><div class="mp-ov-score-label">You</div></div><div class="mp-ov-vs">vs</div><div><div class="mp-ov-score-val">${ts[1-my]}</div><div class="mp-ov-score-label">Opponent</div></div></div><button class="mp-ov-btn" onclick="tlrMpLeave()" type="button">Return to Menu</button>`;
    overlay.classList.remove('mp-ov-hidden');
    doc.body.classList.add('mp-overlay-active');
  }
  function hideOverlay() { el('mpOverlay')?.classList.add('mp-ov-hidden'); doc.body.classList.remove('mp-overlay-active'); }

  let _autoScoreTimer = null, _autoRoundTimer = null;
  // Either client may drive scoring once the spreads are full — a duplicate
  // MP_SCORE_ROUND is harmless (the reducer rejects it outside the SCORING
  // phase). This keeps the set from stalling if the host's client doesn't fire.
  function scheduleAutoScore() { if (!needsScoring(_state) || _autoScoreTimer) return; _autoScoreTimer = target.setTimeout(() => { _autoScoreTimer = null; if (_state && needsScoring(_state)) target.tlrMpDispatch?.({ type: MP_ACTIONS.MP_SCORE_ROUND }); }, 950); }
  function scheduleAutoNextRound() { if (!_state || _state.phase !== MP_PHASES.BETWEEN_ROUNDS || _myIndex !== 0 || _autoRoundTimer) return; _autoRoundTimer = target.setTimeout(() => { _autoRoundTimer = null; if (_state && _myIndex === 0 && _state.phase === MP_PHASES.BETWEEN_ROUNDS) { clearOpponentRevealQueues(); target.tlrMpDispatch?.({ type: MP_ACTIONS.MP_NEW_ROUND, playerIndex: 0 }); } }, 120); }

  // placeCard is only reached via the drag-to-place path (tap-to-place calls
  // dispatchPlace directly). The drag gesture in gestureCard.mjs communicates the
  // dragged card through the global `state.selected`, so honor that here and fall
  // back to our own selection store.
  function installPlaceCardOverride() {
    _origPlaceCard = { placeCard: target.placeCard, placeCardUid: target.placeCardUid };
    target.placeCard = function (slotIndex) {
      if (!_state) { _origPlaceCard?.placeCard?.call(target, slotIndex); return; }
      const uid = target.state?.selected != null ? target.state.selected : _selected;
      if (uid != null && _purgeSelect === null && !_abilityResolving && !mySubmitted(_state)) dispatchPlace(uid, slotIndex);
    };
    target.placeCardUid = function (cardUid, slotIndex) {
      if (!_state) return _origPlaceCard?.placeCardUid?.call(target, cardUid, slotIndex);
      if (cardUid != null && _purgeSelect === null && !_abilityResolving && !mySubmitted(_state)) dispatchPlace(cardUid, slotIndex);
    };
  }
  function restorePlaceCard() { if (_origPlaceCard !== null) { target.placeCard = _origPlaceCard.placeCard; target.placeCardUid = _origPlaceCard.placeCardUid; _origPlaceCard = null; } }
  function installRenderSpreadOverride() { _origRenderSpread = target.renderSpread; target.renderSpread = function () { if (_state) return; _origRenderSpread?.apply(target, arguments); }; }
  function restoreRenderSpread() { if (_origRenderSpread !== null) { target.renderSpread = _origRenderSpread; _origRenderSpread = null; } }
  // While a match is active the hand piles live in match state, not the legacy
  // global. Any stray singleplayer renderHand() call (e.g. from a shared render)
  // is redirected to the multiplayer view so it can never draw a stale hand.
  function installRenderHandOverride() { if (_origRenderHand !== null) return; _origRenderHand = target.renderHand; if (typeof _origRenderHand !== 'function') return; target.renderHand = function (ability, inPurge, view) { if (_state && !view) return _origRenderHand.call(target, ability, inPurge, selfHandView(_state, _myIndex)); return _origRenderHand.call(target, ability, inPurge, view); }; }
  function restoreRenderHandOverride() { if (_origRenderHand !== null) { target.renderHand = _origRenderHand; _origRenderHand = null; } }
  function installPurgeOverride() { if (_origTogglePurgeCard !== null) return; _origTogglePurgeCard = target.togglePurgeCard; target.togglePurgeCard = toggleMpPurgeCard; }
  function restorePurgeOverride() { if (_origTogglePurgeCard !== null) { target.togglePurgeCard = _origTogglePurgeCard; _origTogglePurgeCard = null; } }
  // The singleplayer refreshHandState (also wrapped by the surgeon patch for its
  // sync) still runs during a match for its side effects, but it toggles hand
  // classes from the now-unused global `state`. Re-render the multiplayer hand
  // afterwards so MP's view model is authoritative for selection/purge classes.
  // SP's refreshHandState internally calls SP renderAbilityPrompt(), which strips
  // .show from #abilityPrompt when the SP store has no active targeting (which is
  // always true during MP). Re-apply MP targeting state afterwards so the anchor
  // prompt is not hidden mid-flow by a swipe or drag gesture.
  function installRefreshHandStateOverride() { if (_origRefreshHandState !== null) return; _origRefreshHandState = target.refreshHandState; if (typeof _origRefreshHandState !== 'function') return; target.refreshHandState = function () { const result = _origRefreshHandState.apply(target, arguments); if (_state) renderSelfHand(_state, _myIndex); refreshSelectionUi(); if (_abilityTargeting) { renderAbilityPrompt(); refreshAbilityTargets(); } return result; }; }
  function restoreRefreshHandStateOverride() { if (_origRefreshHandState !== null) { target.refreshHandState = _origRefreshHandState; _origRefreshHandState = null; } }

  function installDispatchEffectDelay() {
    const original = target.tlrMpDispatch;
    if (typeof original !== 'function' || target.__tlrMpScoringFeedbackDispatchWrapped) return;
    target.__tlrMpScoringFeedbackDispatchWrapped = true;
    target.tlrMpDispatch = function (action) {
      if (action?.type === MP_ACTIONS.MP_NEW_ROUND && target.tlrMpGetState?.()?.phase === MP_PHASES.BETWEEN_ROUNDS) {
        const remaining = Math.max(0, _latestEffectsUntil - Date.now());
        if (remaining > 40) {
          if (!_delayedNextRoundQueued) {
            _delayedNextRoundQueued = true;
            target.setTimeout(() => {
              _delayedNextRoundQueued = false;
              if (target.tlrMpGetState?.()?.phase === MP_PHASES.BETWEEN_ROUNDS) original.call(this, action);
            }, remaining);
          }
          return target.tlrMpGetState?.() ?? null;
        }
      }
      return original.call(this, action);
    };
  }

  function resetTransientActionState() {
    // _pendingRemovalUids is intentionally NOT cleared here. tlrMpOnLocalAction
    // calls this before render(), but when the local player submits first (waiting
    // for the opponent), _state still has the card in hand. Clearing here would
    // let the card flash back into the hand during that intermediate render.
    // selfHandView auto-evicts entries once they leave the hand; tlrMpOnMatchStart
    // clears the set explicitly at match start.
    //
    // _abilityResolving is intentionally NOT reset here. Its lifecycle is owned by
    // invokeSelectedCard's try/finally block (and tlrMpCancelAction for user cancel).
    // Resetting it here would clear the flag when a peer action arrives mid-PEEK,
    // corrupting the UI state while showMpCardChoice is still awaiting user input.
    _invokeCard = null; _swapFirst = null; _purgeSelect = null; _selected = null; _personaSwapRequested = false;
    renderMpPurgePrompt();
  }

  target.tlrMpOnMatchStart = function (state, { role }) { ensureRoundMults(state, null, true); _lastScoringState = cloneState(state); _state = state; _myIndex = role === 'host' ? 0 : 1; _pendingRemovalUids.clear(); _optimisticSelf = null; _abilityResolving = false; resetTransientActionState(); _lastShownScores = [state?.players?.[0]?.totalScore ?? 0, state?.players?.[1]?.totalScore ?? 0]; clearOpponentRevealQueues(); doc.body.classList.add('mp-game-active'); mount(); el('mpGame')?.classList.remove('mp-hidden'); installPlaceCardOverride(); installRenderSpreadOverride(); installRenderHandOverride(); installPurgeOverride(); installRefreshHandStateOverride(); render(); updateScoreMultPills(state); scheduleAutoScore(); scheduleAutoNextRound(); };
  target.tlrMpOnLocalAction = function (action, state) { const before = _lastScoringState ? cloneState(_lastScoringState) : cloneState(state); applyDerivedScoringState(before, state, action); if (action?.type === MP_ACTIONS.MP_NEW_ROUND) clearOpponentRevealQueues(); _state = state; resetTransientActionState(); render(); updateScoreMultPills(state, { includeOpponent: false }); playPlacementFeedback(before, state); _lastScoringState = cloneState(state); scheduleAutoScore(); scheduleAutoNextRound(); };
  target.tlrMpOnPeerAction = function (action, state) { const before = _lastScoringState ? cloneState(_lastScoringState) : cloneState(state); applyDerivedScoringState(before, state, action); if (action?.type === MP_ACTIONS.MP_NEW_ROUND) clearOpponentRevealQueues(); _state = state; resetTransientActionState(); render(); updateScoreMultPills(state, { includeOpponent: false }); playPlacementFeedback(before, state); _lastScoringState = cloneState(state); scheduleAutoScore(); scheduleAutoNextRound(); };
  target.tlrMpHandlePeerLeft = function () { const overlay = el('mpOverlay'), box = el('mpOvBox'); if (!box || !overlay) return; box.innerHTML = `<h2 class="mp-ov-title">Opponent Left</h2><p style="color:#b09060;font:400 12px/1.5 system-ui,sans-serif">Your opponent disconnected.</p><button class="mp-ov-btn" onclick="tlrMpLeave()" type="button">Return to Menu</button>`; overlay.classList.remove('mp-ov-hidden'); };
  target.tlrMpInvoke = function () { invokeSelectedCard(); };
  target.tlrMpDiscard = function () { invokeSelectedCard(); };
  target.tlrMpAbilityButton = function () {
    // Dedicated to the persona ability. Card abilities are fired via Discard.
    if (el('mpAbilityBtn')?.dataset?.mpAbilityAction === 'persona-swap') target.tlrMpStartSwap();
  };
  target.tlrMpPurge = function () { _purgeSelect === null ? startPurgeMode() : confirmPurge(); };
  target.tlrMpConfirmPurge = function () { confirmPurge(); };
  target.tlrMpConfirmAbilitySelection = function () { confirmAbilityTargeting(); };
  target.tlrMpCancelAction = function () { if (mySubmitted(_state)) return; cancelAbilityTargeting(); _invokeCard = null; _swapFirst = null; _purgeSelect = null; _selected = null; _abilityResolving = false; _personaSwapRequested = false; target.refreshHandState?.(); render(); };
  target.tlrMpStartSwap = function () { if (!_state || !canSwapSpread(_state, _myIndex)) return; _swapFirst = -1; _personaSwapRequested = true; render(); };
  target.tlrMpNextRound = function () { if (_state && _myIndex === 0) { clearOpponentRevealQueues(); target.tlrMpDispatch?.({ type: MP_ACTIONS.MP_NEW_ROUND, playerIndex: 0 }); } };
  function closeSharedChromeForMpLeave() {
    doc.getElementById('settingsPanel')?.classList.add('hidden');
    for (const name of ['menu', 'scoring', 'abilities']) {
      const wrap = doc.getElementById(`${name}PullWrap`);
      if (wrap) wrap.classList.remove('open');
      const tab = doc.getElementById(`${name}PullTab`);
      if (tab) tab.innerHTML = `&#9660; ${name.charAt(0).toUpperCase()}${name.slice(1)}`;
    }
    target.closeRefs?.();
    target.tutResetTransient?.();
  }

  target.tlrMpLeave = function () { if (_autoScoreTimer) { target.clearTimeout(_autoScoreTimer); _autoScoreTimer = null; } if (_autoRoundTimer) { target.clearTimeout(_autoRoundTimer); _autoRoundTimer = null; } closeSharedChromeForMpLeave(); cancelAbilityTargeting(); restoreAbilityConfirm(); _state = null; resetTransientActionState(); _lastScoringState = null; _latestEffectsUntil = 0; _delayedNextRoundQueued = false; clearOpponentRevealQueues(); restorePlaceCard(); restoreRenderSpread(); restoreRenderHandOverride(); restorePurgeOverride(); restoreRefreshHandStateOverride(); clearPendingPlacementPreview(); syncPersonaPrompt(); doc.body.classList.remove('mp-game-active', 'mp-ability-flow-active', 'mp-persona-ability-active', 'mp-purge-flow-active'); el('mpGame')?.classList.add('mp-hidden'); target._slotEls = null; const sp = el('spread'); if (sp) { sp._mpSlots = null; sp.replaceChildren(); } target.tlrHideMatchmaking?.(); if (typeof target.tlrReturnToMenu === 'function') target.tlrReturnToMenu(); else if (typeof target.tlrShowMainMenu === 'function') target.tlrShowMainMenu(); };
}

function esc(str) {
  return String(str ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function stripMarkup(value) {
  return String(value ?? '').replace(/\*\*/g, '');
}

function patchMatchmakingBack(target, doc) {
  if (target.__tlrMatchmakingBackToChoicesPatchInstalled) return;
  target.__tlrMatchmakingBackToChoicesPatchInstalled = true;

  const originalBack = target.tlrMmBack;
  target.tlrMmBack = function (...args) {
    const screen = doc.getElementById('matchmakingScreen');
    const isOnMatchmakingScreen = !!screen && !screen.classList.contains('mm-screen-hidden');
    const isPreMatchHostOrJoin = !!target.tlrMpGetRole?.() && !target.tlrMpGetState?.();

    if (isOnMatchmakingScreen && isPreMatchHostOrJoin && typeof target.tlrMmReset === 'function') {
      target.tlrMmReset();
      return;
    }

    return originalBack?.apply(this, args);
  };
}

function installFlushGuard(target, doc) {
  if (target.__tlrMpFlushGuardInstalled) return;
  const original = target.flushHand;
  if (typeof original !== 'function') return;
  target.__tlrMpFlushGuardInstalled = true;
  target.flushHand = function (...args) {
    if (doc.body.classList.contains('mp-game-active')) return false;
    return original.apply(this, args);
  };
}

function installOpponentPopTuning(target, doc) {
  if (target.__tlrMpOpponentPopTuned) return;
  const proto = target.Element?.prototype;
  if (!proto || typeof proto.animate !== 'function') return;
  target.__tlrMpOpponentPopTuned = true;
  const original = proto.animate;
  proto.animate = function (keyframes, options) {
    const isOpponentCard = doc.body.classList.contains('mp-game-active')
      && this?.classList?.contains('card')
      && this.closest?.('#mpOppSpread');
    const firstTransform = Array.isArray(keyframes) ? String(keyframes[0]?.transform || '') : '';
    if (isOpponentCard && firstTransform.includes('scale(.78)')) {
      return original.call(this, [
        { transform: 'translateY(-18px) scale(.28)', opacity: 0, filter: 'brightness(1.6)' },
        { transform: 'translateY(3px) scale(1.12)', opacity: 1, filter: 'brightness(1.22)' },
        { transform: 'translateY(0) scale(1)', opacity: 1, filter: 'brightness(1)' },
      ], { ...(options || {}), duration: 380, easing: 'cubic-bezier(.16,.9,.22,1)' });
    }
    return original.call(this, keyframes, options);
  };
}

function installMpGameStyle(doc) {
  if (!doc || doc.getElementById('mp-game-integrated-style')) return;
  const style = doc.createElement('style');
  style.id = 'mp-game-integrated-style';
  style.textContent = `
    body.mp-game-active #hand .card.mp-local-pending-hidden {
      visibility: hidden !important;
      pointer-events: none !important;
    }
    body.mp-game-active #spread .slot.mp-local-pending-slot {
      opacity: 1 !important;
      filter: none !important;
      box-shadow: 0 0 0 1px rgba(255, 214, 132, .32), 0 0 18px rgba(255, 214, 132, .22) !important;
    }
    body.mp-game-active #spread .slot .card.mp-local-pending-card {
      opacity: 1 !important;
      filter: none !important;
      pointer-events: none !important;
    }
    body.mp-game-active.mp-persona-ability-active #abilityPrompt {
      display: flex !important;
      z-index: 2147482600 !important;
    }
    body.mp-game-active.mp-persona-ability-active #spread .slot.mp-swap-pick {
      border-color: rgba(190, 138, 216, .95) !important;
      box-shadow: 0 0 0 2px rgba(190, 138, 216, .46), 0 0 22px rgba(190, 138, 216, .5) !important;
      cursor: pointer !important;
    }
    body.mp-game-active.mp-persona-ability-active #spread .slot.mp-swap-a {
      border-color: rgba(255, 221, 144, .98) !important;
      box-shadow: 0 0 0 2px rgba(255, 221, 144, .6), 0 0 28px rgba(255, 221, 144, .58) !important;
    }
    body.mp-game-active.mp-persona-ability-active #hand .card.mp-surgeon-swap-target {
      border-color: rgba(120, 220, 150, .95) !important;
      box-shadow: 0 0 0 2px rgba(120, 220, 150, .42), 0 0 22px rgba(120, 220, 150, .5) !important;
      cursor: pointer !important;
    }
    body.mp-game-active #hand .card.mp-surgeon-swap-target {
      cursor: pointer !important;
      border-color: rgba(120,200,120,.68) !important;
      box-shadow: 0 0 14px rgba(100,180,100,.38) !important;
    }
    body.mp-game-active #spread .slot.mp-surgeon-swap-blocked {
      pointer-events: none !important;
      opacity: .72;
      cursor: default !important;
    }
    body.mp-game-active #mpAbilityBtn {
      background: linear-gradient(#ead9b5, #b98948) !important;
      background-image: linear-gradient(#ead9b5, #b98948) !important;
      background-color: #d2ae73 !important;
      border: 1px solid #7a5a2d !important;
      border-radius: 6px !important;
      box-shadow: 0 2px 0 rgba(53, 31, 13, .75), inset 0 1px rgba(255,255,255,.22) !important;
      color: #20130b !important;
      font: 700 12px/1 system-ui, Segoe UI, sans-serif !important;
      letter-spacing: normal !important;
      text-transform: none !important;
    }
    body.mp-game-active #mpAbilityBtn:not(.mp-visible) {
      display: none !important;
    }
    body.mp-game-active #mpAbilityBtn.mp-visible {
      display: inline-flex !important;
      align-items: center !important;
      justify-content: center !important;
    }
    body.mp-game-active #mpAbilityBtn::before,
    body.mp-game-active #mpAbilityBtn::after {
      content: none !important;
      display: none !important;
    }
    body.mp-game-active .mp-pills-opp.mp-has-left-mult,
    body.mp-game-active .mp-pills-self.mp-has-left-mult {
      transform: translateX(-14px) !important;
    }
    body.mp-game-active .mp-mult-inline.mp-mult-left,
    body.mp-game-active .mp-mult-inline.mp-mult-right {
      display: inline-flex !important;
      align-items: center !important;
      min-width: 0 !important;
      flex: 0 0 auto !important;
      color: #ff5a4f !important;
      font-weight: 800 !important;
      white-space: nowrap !important;
    }
    body.mp-game-active .mp-mult-inline.mp-mult-left {
      justify-content: flex-end !important;
      margin-left: 0 !important;
      margin-right: 2px !important;
    }
    body.mp-game-active .mp-mult-inline.mp-mult-right {
      justify-content: flex-start !important;
      margin-left: 2px !important;
      margin-right: 0 !important;
    }
    body.mp-game-active .mp-pill-score {
      gap: 5px !important;
    }
    body.mp-game-active .mp-overlay:not(.mp-ov-hidden) {
      pointer-events: auto;
    }
    body.mp-game-active.mp-ability-flow-active #abilityPrompt.show,
    body.mp-game-active.mp-purge-flow-active #purgePrompt {
      display: flex !important;
      z-index: 2147482600 !important;
    }
    body.mp-game-active.mp-ability-flow-active .mp-pills-actions button {
      pointer-events: none;
    }
  `;
  doc.head.appendChild(style);
}
