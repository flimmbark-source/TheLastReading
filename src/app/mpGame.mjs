import { MP_PHASES } from '../multiplayer/mpState.mjs';
import { MP_ACTIONS } from '../multiplayer/mpActions.mjs';
import { MP_ABILITY_TYPES } from '../multiplayer/interactionCards.mjs';
import {
  isPlayerTurn, canInvokeAbility, canTargetSlot,
  isSlotAnchored, isCardSilenced, canSwapSpread,
  isMatchOver, needsScoring, scores, roundScores,
  hasSubmittedAction,
} from '../multiplayer/mpSelectors.mjs';
import { applyCardPhoto, CARD_SHEET, title as cardTitle, symbol as cardSymbol } from '../ui/renderCard.mjs';

export function installMpGame(target = window) {
  if (!target || target.__tlrMpGameInstalled) return;
  target.__tlrMpGameInstalled = true;

  let _state      = null;
  let _myIndex    = 0;
  let _invokeCard = null;  // uid awaiting opponent-spread target (Seal)
  let _swapFirst  = null;  // null | -1 | slotIndex (Surgeon swap)
  let _purgeSelect = null; // null | uid[]
  let _origPlaceCard    = null;
  let _origRenderSpread = null;
  let _origTogglePurgeCard = null;
  let _origRefreshHandState = null;

  const doc = target.document;
  function el(id) { return doc.getElementById(id); }

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

  // ── Card inner HTML ──────────────────────────────────────────────────────
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

  // ── Mount overlay skeleton ───────────────────────────────────────────────
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
          <div class="pill score-pill mp-pill-score">Score <b id="mpOppScore">0</b></div>
          <div class="pill reserve-pill mp-pill-disc">Discards <b id="mpOppDisc">0</b></div>
        </div>
        <div class="mp-pills-band mp-pills-mid">
          <div class="pill threshold-pill mp-pill-thresh">Threshold <b id="mpThresh">200</b></div>
          <button class="constellation-pill mp-constellation hidden" id="mpConstellation" type="button"></button>
        </div>
        <div class="mp-pills-band mp-pills-self">
          <div class="pill score-pill mp-pill-score">Score <b id="mpMyScore">0</b></div>
          <div class="pill reserve-pill mp-pill-disc">Discards <b id="mpMyDisc">0</b></div>
        </div>
        <div class="mp-pills-band mp-pills-actions">
          <button class="sbtn sbtn-discard" id="mpDiscardBtn" onclick="tlrMpDiscard()" type="button" disabled aria-label="Discard selected card" title="Discard"></button>
          <button class="sbtn sbtn-purge" id="mpPurgeBtn" onclick="tlrMpPurge()" type="button" disabled aria-label="Purge 3 cards" title="Purge"></button>
        </div>
        <div class="mp-action-panel" id="mpActionPanel"></div>
      </div>

      <div class="mp-overlay mp-ov-hidden" id="mpOverlay">
        <div class="mp-ov-box" id="mpOvBox"></div>
      </div>`;
  }

  function syncPerspectiveState(s, my) {
    const p = s.players[my];
    if (!p || !target.state) return;

    const selected = target.state.selected;
    target.state.hand = (p.hand || []).slice();
    target.state.spread = (p.spread || Array(5).fill(null)).slice();
    target.state.discard = (p.discard || []).slice();
    target.state.discards = p.discards ?? 0;
    target.state.busy = mySubmitted(s);
    target.state.abilitySelect = null;
    target.state.purgeSelect = _purgeSelect;

    if (selected !== null && !target.state.hand.some(c => c.uid === selected)) {
      target.state.selected = null;
    }
  }

  function renderSelfHand(s, my) {
    syncPerspectiveState(s, my);
    if (typeof target.renderHand === 'function') target.renderHand(null, _purgeSelect !== null);
  }

  // ── Full re-render ───────────────────────────────────────────────────────
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

    if (needsScoring(s))   showScoringOverlay(s);
    else if (isMatchOver(s)) showCompleteOverlay(s, my);
    else                   hideOverlay();
  }

  // Cheap refresh used after selecting/deselecting a hand card. The shared
  // single-player hand renderer only knows how to repaint card selection, so
  // multiplayer has to refresh its own discard button, action text, and spread
  // targets as well.
  function refreshSelectionUi() {
    if (!_state) return;
    const s = _state;
    const my = _myIndex;
    syncPerspectiveState(s, my);
    renderActionButtons(s, my);
    renderSelfSpread(s, my);
    renderActionPanel(s, my);
  }

  function renderTopBar(s, my) {
    const badge = el('mpTurnBadge');
    const round = el('mpRoundLabel');
    if (!badge) return;
    badge.className = 'mp-turn-badge';
    if (s.phase === MP_PHASES.SCORING) {
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
      const card   = player.spread[i];
      let cls = 'slot ';

      if (card) {
        cls += 'filled';
        if (isSlotAnchored(s, pIdx, i))        cls += ' mp-anchored';
        if (isCardSilenced(s, pIdx, card.uid)) cls += ' mp-silenced';
        if (_invokeCard !== null && pIdx === opp && canTargetSlot(s, pIdx, i)) cls += ' mp-targetable';
      } else {
        cls += 'empty';
      }
      slotEl.className = cls;
      slotEl.onclick = (_invokeCard !== null && pIdx === opp && card && canTargetSlot(s, pIdx, i) && isMyActionTurn(s))
        ? () => handleInvokeTarget(pIdx, i)
        : null;

      renderSlotCard(slotEl, card, isSelf ? i : null);
    }
  }

  function renderSelfSpread(s, my) {
    const spreadEl = el('spread');
    if (!spreadEl) return;
    const player = s.players[my];
    if (!player) return;
    const isTurn = isMyActionTurn(s);

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

    const selUid = target.state?.selected ?? null;

    for (let i = 0; i < 5; i++) {
      const slotEl = spreadEl._mpSlots[i];
      const card   = player.spread[i];
      let cls = 'slot ';

      if (card) {
        cls += 'filled';
        if (isSlotAnchored(s, my, i))        cls += ' mp-anchored';
        if (isCardSilenced(s, my, card.uid)) cls += ' mp-silenced';
        if (_swapFirst === i)                cls += ' mp-swap-a';
        else if (_swapFirst >= 0)            cls += ' mp-swap-pick';
      } else {
        cls += 'empty';
        if (isTurn && selUid !== null && _invokeCard === null && _swapFirst === null && _purgeSelect === null) {
          cls += ' target';
        }
      }
      slotEl.className = cls;

      if (!card && isTurn && selUid !== null && _invokeCard === null && _swapFirst === null && _purgeSelect === null) {
        slotEl.onclick = () => dispatchPlace(selUid, i);
      } else if (card && isTurn && _swapFirst === -1) {
        slotEl.onclick = () => { _swapFirst = i; render(); };
      } else if (card && isTurn && _swapFirst >= 0 && _swapFirst !== i) {
        slotEl.onclick = () => dispatchSwap(_swapFirst, i);
      } else {
        slotEl.onclick = null;
      }

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
      cardEl.className = 'card'
        + (card.type === 'major' ? ' major' : '')
        + (CARD_SHEET[card.id] ? ' photo' : '')
        + (card.type === 'interaction' ? ' mp-interaction' : '');
    } else {
      let nm = slotEl.firstElementChild;
      if (!nm?.classList?.contains('num')) {
        slotEl.replaceChildren();
        nm = doc.createElement('div');
        nm.className = 'num';
        slotEl.appendChild(nm);
      }
      nm.textContent = emptyNumber === null ? '' : String(emptyNumber + 1);
    }
  }

  function renderPills(s, my) {
    const opp = 1 - my;
    const mp  = s.players[my], op = s.players[opp];
    const e = (id, val) => { const n = el(id); if (n) n.textContent = val; };
    e('mpOppScore', op?.totalScore  ?? 0);
    e('mpOppDisc',  op?.discards    ?? 0);
    e('mpMyScore',  mp?.totalScore  ?? 0);
    e('mpMyDisc',   mp?.discards    ?? 0);
    e('mpThresh',   s.scoreTarget   ?? 200);
  }

  function renderActionButtons(s, my) {
    const p = s.players[my];
    const isTurn = isMyActionTurn(s);
    const selUid = target.state?.selected ?? null;
    const selectedCard = selUid !== null ? p?.hand.find(c => c.uid === selUid) : null;
    const discardBtn = el('mpDiscardBtn');
    const purgeBtn = el('mpPurgeBtn');

    if (discardBtn) {
      discardBtn.disabled = !isTurn || _purgeSelect !== null || _invokeCard !== null || _swapFirst !== null || !selectedCard || (p?.discards ?? 0) <= 0;
      discardBtn.classList.toggle('mp-active-action', !discardBtn.disabled);
    }
    if (purgeBtn) {
      const canStartPurge = isTurn && _invokeCard === null && _swapFirst === null && (p?.hand?.length ?? 0) >= 3;
      purgeBtn.disabled = _purgeSelect === null ? !canStartPurge : _purgeSelect.length !== 3;
      purgeBtn.classList.toggle('mp-active-action', _purgeSelect !== null);
    }
  }

  function renderActionPanel(s, my) {
    const panel = el('mpActionPanel');
    if (!panel) return;
    const p      = s.players[my];
    const isTurn = isMyActionTurn(s);
    const selUid = target.state?.selected ?? null;
    const parts  = [];

    if (mySubmitted(s)) {
      parts.push(`<span class="mp-action-hint">Action submitted. Waiting for opponent…</span>`);
    } else if (_purgeSelect !== null) {
      parts.push(`<span class="mp-action-hint">Select 3 cards to purge. ${_purgeSelect.length}/3 selected.</span>`);
      if (_purgeSelect.length === 3) parts.push(`<button class="mp-action-btn invoke" onclick="tlrMpConfirmPurge()" type="button">Purge</button>`);
      parts.push(`<button class="mp-action-btn cancel" onclick="tlrMpCancelAction()" type="button">Cancel</button>`);
    } else if (_invokeCard !== null) {
      parts.push(`<span class="mp-action-hint">Tap a card on the opponent's spread.</span>`);
      parts.push(`<button class="mp-action-btn cancel" onclick="tlrMpCancelAction()" type="button">Cancel</button>`);
    } else if (_swapFirst !== null) {
      parts.push(`<span class="mp-action-hint">${_swapFirst === -1 ? 'Tap a card in your Spread.' : 'Tap a card in your Hand.'}</span>`);
      parts.push(`<button class="mp-action-btn cancel" onclick="tlrMpCancelAction()" type="button">Cancel</button>`);
    } else if (selUid !== null && isTurn) {
      const card = p?.hand.find(c => c.uid === selUid);
      if (card && (card.ability || card.abilityType) && canInvokeAbility(s, my, selUid)) {
        parts.push(`<button class="mp-action-btn invoke" onclick="tlrMpInvoke()" type="button">Invoke</button>`);
      }
      if (card?.abilityType === MP_ABILITY_TYPES.MP_BANISH) {
        parts.push(`<span class="mp-action-hint">Discard invokes Banish and removes the opponent's last played card.</span>`);
      } else {
        parts.push(`<span class="mp-action-hint">Place it, discard it, or purge 3 cards for +1 discard.</span>`);
      }
    } else if (isTurn) {
      if (opponentSubmitted(s)) parts.push(`<span class="mp-action-hint">Opponent is ready. Choose your action.</span>`);
      if (canSwapSpread(s, my)) {
        parts.push(`<button class="mp-action-btn swap" onclick="tlrMpStartSwap()" type="button">Swap Spread</button>`);
      }
      if (!opponentSubmitted(s)) parts.push(`<span class="mp-action-hint">Select a card from your hand.</span>`);
    } else if (s.phase === MP_PHASES.BETWEEN_ROUNDS) {
      parts.push(`<span class="mp-action-hint">Starting next set…</span>`);
    } else {
      parts.push(`<span class="mp-action-hint">Waiting…</span>`);
    }
    panel.innerHTML = parts.join('');
  }

  function submitAction(action) {
    if (!_state || mySubmitted(_state)) return;
    target.tlrMpDispatch?.({
      type: MP_ACTIONS.MP_SUBMIT_ACTION,
      playerIndex: _myIndex,
      action: { ...action, playerIndex: _myIndex },
    });
    _invokeCard = null;
    _swapFirst = null;
    _purgeSelect = null;
    if (target.state) target.state.selected = null;
    target.refreshHandState?.();
  }

  function dispatchPlace(cardUid, slotIndex) {
    submitAction({ type: MP_ACTIONS.MP_PLACE_CARD, cardUid, slotIndex });
  }

  function dispatchSwap(slotA, slotB) {
    // Deprecated spread-to-spread path kept inert; Surgeon hand swap is handled by the bridge patch.
    _swapFirst = null;
    render();
  }

  function handleInvokeTarget(playerIdx, slotIdx) {
    if (_invokeCard === null) return;
    submitAction({
      type: MP_ACTIONS.MP_INVOKE_ABILITY,
      cardUid: _invokeCard,
      target: { playerIndex: playerIdx, slotIndex: slotIdx },
    });
  }

  function invokeSelectedCard() {
    const my  = _myIndex;
    const uid = target.state?.selected ?? null;
    if (!_state || uid === null || mySubmitted(_state)) return;
    const card = _state.players[my].hand.find(c => c.uid === uid);
    if (!card) return;

    if (card.abilityType === MP_ABILITY_TYPES.MP_SEAL) {
      _invokeCard = uid;
      render();
      return;
    }

    if (card.ability || card.abilityType) {
      submitAction({ type: MP_ACTIONS.MP_INVOKE_ABILITY, cardUid: uid });
    } else {
      submitAction({ type: MP_ACTIONS.MP_DISCARD_CARD, cardUid: uid });
    }
  }

  function startPurgeMode() {
    if (!_state || !isMyActionTurn()) return;
    const p = _state.players[_myIndex];
    if (!p || p.hand.length < 3) return;
    _purgeSelect = [];
    if (target.state) target.state.selected = null;
    render();
  }

  function confirmPurge() {
    if (!_state || !_purgeSelect || _purgeSelect.length !== 3 || mySubmitted(_state)) return;
    submitAction({ type: MP_ACTIONS.MP_PURGE_CARDS, cardUids: _purgeSelect.slice() });
  }

  function toggleMpPurgeCard(uid) {
    if (_purgeSelect === null || mySubmitted(_state)) return;
    const idx = _purgeSelect.indexOf(uid);
    if (idx >= 0) _purgeSelect.splice(idx, 1);
    else if (_purgeSelect.length < 3) _purgeSelect.push(uid);
    render();
  }

  function showScoringOverlay(s) {
    const overlay = el('mpOverlay'), box = el('mpOvBox');
    if (!box || !overlay) return;
    const rs = roundScores(s), ts = scores(s);
    const my = _myIndex, opp = 1 - my;
    box.innerHTML = `
      <h2 class="mp-ov-title">Round ${s.round ?? 1} Complete</h2>
      <div class="mp-ov-scores">
        <div><div class="mp-ov-score-val">${rs[my]}</div><div class="mp-ov-score-label">You</div></div>
        <div class="mp-ov-vs">vs</div>
        <div><div class="mp-ov-score-val">${rs[opp]}</div><div class="mp-ov-score-label">Opponent</div></div>
      </div>
      <div class="mp-ov-totals">Total: ${ts[my]} – ${ts[opp]} / ${s.scoreTarget ?? 200}</div>
      <p class="mp-ov-waiting">Starting next set…</p>`;
    overlay.classList.remove('mp-ov-hidden');
  }

  function showCompleteOverlay(s, my) {
    const overlay = el('mpOverlay'), box = el('mpOvBox');
    if (!box || !overlay) return;
    const ts = scores(s);
    const w = s.winner;
    const result = w === 'draw' ? 'Draw' : (w === my ? 'Victory' : 'Defeat');
    const cls    = w === 'draw' ? 'draw' : (w === my ? 'win' : 'lose');
    box.innerHTML = `
      <h2 class="mp-ov-title">Match Over</h2>
      <p class="mp-ov-winner ${cls}">${result}</p>
      <div class="mp-ov-scores">
        <div><div class="mp-ov-score-val">${ts[my]}</div><div class="mp-ov-score-label">You</div></div>
        <div class="mp-ov-vs">vs</div>
        <div><div class="mp-ov-score-val">${ts[1-my]}</div><div class="mp-ov-score-label">Opponent</div></div>
      </div>
      <button class="mp-ov-btn" onclick="tlrMpLeave()" type="button">Return to Menu</button>`;
    overlay.classList.remove('mp-ov-hidden');
  }

  function hideOverlay() { el('mpOverlay')?.classList.add('mp-ov-hidden'); }

  let _autoScoreTimer = null;
  let _autoRoundTimer = null;
  function scheduleAutoScore() {
    if (!needsScoring(_state) || _myIndex !== 0 || _autoScoreTimer) return;
    _autoScoreTimer = target.setTimeout(() => {
      _autoScoreTimer = null;
      if (_state && _myIndex === 0 && needsScoring(_state))
        target.tlrMpDispatch?.({ type: MP_ACTIONS.MP_SCORE_ROUND });
    }, 400);
  }

  function scheduleAutoNextRound() {
    if (!_state || _state.phase !== MP_PHASES.BETWEEN_ROUNDS || _myIndex !== 0 || _autoRoundTimer) return;
    _autoRoundTimer = target.setTimeout(() => {
      _autoRoundTimer = null;
      if (_state && _myIndex === 0 && _state.phase === MP_PHASES.BETWEEN_ROUNDS) {
        target.tlrMpDispatch?.({ type: MP_ACTIONS.MP_NEW_ROUND, playerIndex: 0 });
      }
    }, 120);
  }

  function installPlaceCardOverride() {
    _origPlaceCard = target.placeCard;
    target.placeCard = function (slotIndex) {
      if (!_state) { _origPlaceCard?.call(target, slotIndex); return; }
      const uid = target.state?.selected ?? null;
      if (uid !== null && _purgeSelect === null && !mySubmitted(_state)) dispatchPlace(uid, slotIndex);
    };
  }

  function restorePlaceCard() {
    if (_origPlaceCard !== null) {
      target.placeCard = _origPlaceCard;
      _origPlaceCard = null;
    }
  }

  function installRenderSpreadOverride() {
    _origRenderSpread = target.renderSpread;
    target.renderSpread = function () {
      if (_state) return;
      _origRenderSpread?.apply(target, arguments);
    };
  }

  function restoreRenderSpread() {
    if (_origRenderSpread !== null) {
      target.renderSpread = _origRenderSpread;
      _origRenderSpread = null;
    }
  }

  function installPurgeOverride() {
    if (_origTogglePurgeCard !== null) return;
    _origTogglePurgeCard = target.togglePurgeCard;
    target.togglePurgeCard = toggleMpPurgeCard;
  }

  function restorePurgeOverride() {
    if (_origTogglePurgeCard !== null) {
      target.togglePurgeCard = _origTogglePurgeCard;
      _origTogglePurgeCard = null;
    }
  }

  function installRefreshHandStateOverride() {
    if (_origRefreshHandState !== null) return;
    _origRefreshHandState = target.refreshHandState;
    if (typeof _origRefreshHandState !== 'function') return;
    target.refreshHandState = function () {
      const result = _origRefreshHandState.apply(target, arguments);
      refreshSelectionUi();
      return result;
    };
  }

  function restoreRefreshHandStateOverride() {
    if (_origRefreshHandState !== null) {
      target.refreshHandState = _origRefreshHandState;
      _origRefreshHandState = null;
    }
  }

  target.tlrMpOnMatchStart = function (state, { role }) {
    _state      = state;
    _myIndex    = role === 'host' ? 0 : 1;
    _invokeCard = null;
    _swapFirst  = null;
    _purgeSelect = null;
    doc.body.classList.add('mp-game-active');
    mount();
    el('mpGame')?.classList.remove('mp-hidden');
    installPlaceCardOverride();
    installRenderSpreadOverride();
    installPurgeOverride();
    installRefreshHandStateOverride();
    render();
    scheduleAutoScore();
    scheduleAutoNextRound();
  };

  target.tlrMpOnLocalAction = function (_action, state) {
    _state = state; _invokeCard = null; _swapFirst = null; _purgeSelect = null;
    render(); scheduleAutoScore(); scheduleAutoNextRound();
  };

  target.tlrMpOnPeerAction = function (_action, state) {
    _state = state; _invokeCard = null; _swapFirst = null; _purgeSelect = null;
    render(); scheduleAutoScore(); scheduleAutoNextRound();
  };

  target.tlrMpHandlePeerLeft = function () {
    const overlay = el('mpOverlay'), box = el('mpOvBox');
    if (!box || !overlay) return;
    box.innerHTML = `
      <h2 class="mp-ov-title">Opponent Left</h2>
      <p style="color:#b09060;font:400 12px/1.5 system-ui,sans-serif">Your opponent disconnected.</p>
      <button class="mp-ov-btn" onclick="tlrMpLeave()" type="button">Return to Menu</button>`;
    overlay.classList.remove('mp-ov-hidden');
  };

  target.tlrMpInvoke = function () { invokeSelectedCard(); };
  target.tlrMpDiscard = function () { invokeSelectedCard(); };
  target.tlrMpPurge = function () { _purgeSelect === null ? startPurgeMode() : confirmPurge(); };
  target.tlrMpConfirmPurge = function () { confirmPurge(); };

  target.tlrMpCancelAction = function () {
    if (mySubmitted(_state)) return;
    _invokeCard = null; _swapFirst = null; _purgeSelect = null;
    if (target.state) target.state.selected = null;
    target.refreshHandState?.();
    render();
  };

  target.tlrMpStartSwap = function () {
    if (!_state || !canSwapSpread(_state, _myIndex)) return;
    _swapFirst = -1; render();
  };

  target.tlrMpNextRound = function () {
    if (_state && _myIndex === 0)
      target.tlrMpDispatch?.({ type: MP_ACTIONS.MP_NEW_ROUND, playerIndex: 0 });
  };

  target.tlrMpLeave = function () {
    if (_autoScoreTimer) { target.clearTimeout(_autoScoreTimer); _autoScoreTimer = null; }
    if (_autoRoundTimer) { target.clearTimeout(_autoRoundTimer); _autoRoundTimer = null; }
    _state = null; _invokeCard = null; _swapFirst = null; _purgeSelect = null;
    restorePlaceCard();
    restoreRenderSpread();
    restorePurgeOverride();
    restoreRefreshHandStateOverride();
    doc.body.classList.remove('mp-game-active');
    el('mpGame')?.classList.add('mp-hidden');
    target._slotEls = null;
    const sp = el('spread'); if (sp) { sp._mpSlots = null; sp.replaceChildren(); }
    target.tlrHideMatchmaking?.();
    if (typeof target.tlrShowMainMenu === 'function') target.tlrShowMainMenu();
  };
}

function esc(str) {
  return String(str ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
