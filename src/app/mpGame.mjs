import { MP_PHASES } from '../multiplayer/mpState.mjs';
import { MP_ACTIONS } from '../multiplayer/mpActions.mjs';
import { MP_ABILITY_TYPES } from '../multiplayer/interactionCards.mjs';
import {
  isPlayerTurn, canPlaceCard, canInvokeAbility, canTargetSlot,
  isSlotAnchored, isCardSilenced, canSwapSpread,
  isMatchOver, needsScoring, scores, roundScores,
  personaOf,
} from '../multiplayer/mpSelectors.mjs';
import { applyCardPhoto, CARD_SHEET, title as cardTitle, symbol as cardSymbol } from '../ui/renderCard.mjs';

export function installMpGame(target = window) {
  if (!target || target.__tlrMpGameInstalled) return;
  target.__tlrMpGameInstalled = true;

  let _state      = null;
  let _myIndex    = 0;
  let _invokeCard = null;  // uid awaiting spread target (Banish/Seal)
  let _swapFirst  = null;  // null | -1 | slotIndex (Surgeon swap)
  let _origPlaceCard    = null;
  let _origRenderSpread = null;

  const doc = target.document;
  function el(id) { return doc.getElementById(id); }

  // ── Card inner HTML ──────────────────────────────────────────────────────
  // Matches .title/.art/.sym/.plaque/.seal structure; null-safe ability label.
  function mpCardHTML(card) {
    if (!card) return '';
    if (card.type === 'interaction') {
      const sym  = card.abilityType === MP_ABILITY_TYPES.MP_BANISH ? '⚔' : '🔇';
      const desc = card.abilityType === MP_ABILITY_TYPES.MP_BANISH ? 'Remove' : 'Silence';
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

      <div class="mp-player-row" id="mpOppRow"></div>
      <div class="mp-opp-hand"   id="mpOppHand"></div>

      <div class="mp-opp-spread-clip">
        <div class="mp-opp-spread-transform">
          <div class="spread" id="mpOppSpread"></div>
        </div>
      </div>

      <div class="mp-mid-wrap" id="mpMidWrap">
        <div class="mp-pills-band mp-pills-opp">
          <div class="pill reserve-pill mp-pill-disc"><b id="mpOppDisc">0</b> Discards</div>
          <div class="pill score-pill mp-pill-score"><b id="mpOppScore">0</b> Score</div>
        </div>
        <div class="mp-pills-band mp-pills-mid">
          <div class="pill threshold-pill mp-pill-thresh">Threshold <b id="mpThresh">200</b></div>
          <button class="constellation-pill mp-constellation hidden" id="mpConstellation" type="button"></button>
        </div>
        <div class="mp-pills-band mp-pills-self">
          <div class="pill reserve-pill mp-pill-disc"><b id="mpMyDisc">0</b> Discards</div>
          <div class="pill score-pill mp-pill-score"><b id="mpMyScore">0</b> Score</div>
        </div>
        <div class="mp-pills-band mp-pills-actions">
          <button class="sbtn sbtn-discard" id="mpDiscardBtn" type="button" disabled aria-label="Discard"></button>
          <button class="sbtn sbtn-purge"   id="mpPurgeBtn"   type="button" disabled aria-label="Remove"></button>
        </div>
        <div class="mp-action-panel" id="mpActionPanel"></div>
      </div>

      <div class="mp-overlay mp-ov-hidden" id="mpOverlay">
        <div class="mp-ov-box" id="mpOvBox"></div>
      </div>`;
  }

  // ── Full re-render ───────────────────────────────────────────────────────
  function render() {
    if (!_state) return;
    const s  = _state;
    const my = _myIndex;

    renderTopBar(s, my);
    renderPlayerRow(s, 1 - my, 'mpOppRow');
    renderOppHand(s, 1 - my);
    renderSpread(s, 1 - my, 'mpOppSpread', false);
    renderPills(s, my);
    renderProgress(s);
    renderSelfSpread(s, my);
    renderActionPanel(s, my);

    if (needsScoring(s))   showScoringOverlay(s);
    else if (isMatchOver(s)) showCompleteOverlay(s, my);
    else                   hideOverlay();
  }

  // ── Top bar ──────────────────────────────────────────────────────────────
  function renderTopBar(s, my) {
    const badge = el('mpTurnBadge');
    const round = el('mpRoundLabel');
    if (!badge) return;
    badge.className = 'mp-turn-badge';
    if (s.phase === MP_PHASES.SCORING || s.phase === MP_PHASES.BETWEEN_ROUNDS) {
      badge.textContent = 'Scoring…'; badge.classList.add('scoring');
    } else if (s.phase === MP_PHASES.COMPLETE) {
      badge.textContent = 'Match Over'; badge.classList.add('scoring');
    } else if (s.phase === MP_PHASES.FINAL_TURN) {
      badge.textContent = s.activePlayerIndex === my ? 'Your Final Turn' : "Opponent's Final Turn";
      badge.classList.add(s.activePlayerIndex === my ? 'final-turn' : 'opp-turn');
    } else {
      badge.textContent = s.activePlayerIndex === my ? 'Your Turn' : "Opponent's Turn";
      badge.classList.add(s.activePlayerIndex === my ? 'my-turn' : 'opp-turn');
    }
    if (round) round.textContent = `Round ${s.round ?? 1}`;
  }

  // ── Player info row ──────────────────────────────────────────────────────
  function renderPlayerRow(s, pIdx, rowId) {
    const row = el(rowId);
    if (!row) return;
    const p = s.players[pIdx];
    if (!p) { row.innerHTML = ''; return; }
    const name = personaOf(s, pIdx)?.name ?? p.persona ?? '?';
    let badges = '';
    if (p.swapAvailable)        badges += `<span class="mp-badge mp-badge-swap">Swap</span>`;
    if (p.bonusActionAvailable) badges += `<span class="mp-badge mp-badge-bonus">+1</span>`;
    row.innerHTML = `<span class="mp-persona">${esc(name)}</span>${badges}<span class="mp-discards">${p.discards} disc</span><span class="mp-score">${p.totalScore ?? 0}</span>`;
  }

  // ── Opponent face-down hand pips ─────────────────────────────────────────
  function renderOppHand(s, oppIdx) {
    const wrap = el('mpOppHand');
    if (!wrap) return;
    const count = s.players[oppIdx]?.hand?.length ?? 0;
    const pips = Array.from({ length: Math.min(count, 7) }, () => `<span class="mp-opp-pip"></span>`).join('');
    wrap.innerHTML = `${pips}<span class="mp-opp-hand-label">${count} card${count !== 1 ? 's' : ''}</span>`;
  }

  // ── Generic spread renderer (opponent only — player uses #spread below) ──
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
        if (isSelf) slot.style.setProperty('--a', ((i - 2) * 4) + 'deg');
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
        if (isSlotAnchored(s, pIdx, i))      cls += ' mp-anchored';
        if (isCardSilenced(s, pIdx, card.uid)) cls += ' mp-silenced';
        if (_invokeCard !== null && pIdx === opp && canTargetSlot(s, pIdx, i)) cls += ' mp-targetable';
      } else {
        cls += 'empty';
      }
      slotEl.className = cls;
      slotEl.onclick = (_invokeCard !== null && pIdx === opp && card && canTargetSlot(s, pIdx, i))
        ? () => handleInvokeTarget(pIdx, i)
        : null;

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
        if (isSelf) nm.textContent = String(i + 1);
      }
    }
  }

  // ── My spread: render into the real #spread using same slot structure ────
  // The singleplayer spread-wrap is repositioned via CSS (fixed, above hand).
  // We reuse its .slot elements and wire slot onclick to dispatch MP_PLACE_CARD.
  function renderSelfSpread(s, my) {
    const spreadEl = el('spread');
    if (!spreadEl) return;
    const player = s.players[my];
    if (!player) return;
    const isTurn = isPlayerTurn(s, my) || (s.phase === MP_PHASES.FINAL_TURN && s.activePlayerIndex === my);

    // Reuse or create 5 stable slot elements (mirrors singleplayer _slotEls)
    if (!spreadEl._mpSlots || spreadEl._mpSlots.length !== 5 || !spreadEl.contains(spreadEl._mpSlots[0])) {
      spreadEl._mpSlots = [];
      spreadEl.replaceChildren();
      for (let i = 0; i < 5; i++) {
        const slot = doc.createElement('div');
        slot.style.setProperty('--a', ((i - 2) * 4) + 'deg');
        spreadEl.appendChild(slot);
        spreadEl._mpSlots.push(slot);
      }
      // Also reset singleplayer _slotEls so SP re-inits on next SP render
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
        // Show target highlight when a hand card is selected
        if (isTurn && selUid !== null && _invokeCard === null && _swapFirst === null) {
          cls += ' target';
        }
      }
      slotEl.className = cls;

      // Slot click: place card / swap pick / invoke on self
      if (!card && isTurn && selUid !== null && _invokeCard === null && _swapFirst === null) {
        slotEl.onclick = () => dispatchPlace(selUid, i);
      } else if (card && _swapFirst === -1) {
        slotEl.onclick = () => { _swapFirst = i; render(); };
      } else if (card && _swapFirst >= 0 && _swapFirst !== i) {
        slotEl.onclick = () => dispatchSwap(_swapFirst, i);
      } else {
        slotEl.onclick = null;
      }

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
        nm.textContent = String(i + 1);
      }
    }
  }

  // ── Middle pills ─────────────────────────────────────────────────────────
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

  // ── Progress bar ─────────────────────────────────────────────────────────
  function renderProgress(s) {
    const sc  = scores(s);
    const tgt = s.scoreTarget ?? 200;
    const f0  = el('mpFillP0'), f1 = el('mpFillP1');
    if (f0) f0.style.width = Math.min(100, Math.round(sc[0] / tgt * 100)) + '%';
    if (f1) f1.style.width = Math.min(100, Math.round(sc[1] / tgt * 100)) + '%';
    const lbl = el('mpTargetLabel'); if (lbl) lbl.textContent = `/ ${tgt}`;
  }

  // ── Action panel ─────────────────────────────────────────────────────────
  function renderActionPanel(s, my) {
    const panel = el('mpActionPanel');
    if (!panel) return;
    const p      = s.players[my];
    const isTurn = isPlayerTurn(s, my) || (s.phase === MP_PHASES.FINAL_TURN && s.activePlayerIndex === my);
    const selUid = target.state?.selected ?? null;
    const parts  = [];

    if (_invokeCard !== null) {
      parts.push(`<span class="mp-action-hint">Tap a card on the opponent's spread.</span>`);
      parts.push(`<button class="mp-action-btn cancel" onclick="tlrMpCancelAction()" type="button">Cancel</button>`);
    } else if (_swapFirst !== null) {
      parts.push(`<span class="mp-action-hint">${_swapFirst === -1 ? 'Tap a card to swap.' : 'Tap the second card.'}</span>`);
      parts.push(`<button class="mp-action-btn cancel" onclick="tlrMpCancelAction()" type="button">Cancel</button>`);
    } else if (selUid !== null && isTurn) {
      const card = p?.hand.find(c => c.uid === selUid);
      if (card && (card.ability || card.abilityType) && canInvokeAbility(s, my, selUid)) {
        parts.push(`<button class="mp-action-btn invoke" onclick="tlrMpInvoke()" type="button">Invoke</button>`);
      }
      parts.push(`<span class="mp-action-hint">Drag or tap a spread slot to place.</span>`);
    } else if (isTurn) {
      if (canSwapSpread(s, my)) {
        parts.push(`<button class="mp-action-btn swap" onclick="tlrMpStartSwap()" type="button">Swap Spread</button>`);
      }
      parts.push(`<span class="mp-action-hint">Select a card from your hand.</span>`);
    } else {
      parts.push(`<span class="mp-action-hint">Waiting for opponent…</span>`);
    }
    panel.innerHTML = parts.join('');
  }

  // ── Dispatch helpers ─────────────────────────────────────────────────────
  function dispatchPlace(cardUid, slotIndex) {
    if (!_state) return;
    target.tlrMpDispatch?.({
      type: MP_ACTIONS.MP_PLACE_CARD,
      playerIndex: _myIndex, cardUid, slotIndex,
    });
    if (target.state) target.state.selected = null;
    target.refreshHandState?.();
  }

  function dispatchSwap(slotA, slotB) {
    _swapFirst = null;
    target.tlrMpDispatch?.({
      type: MP_ACTIONS.MP_SWAP_SPREAD,
      playerIndex: _myIndex, slotA, slotB,
    });
  }

  function handleInvokeTarget(playerIdx, slotIdx) {
    if (_invokeCard === null) return;
    target.tlrMpDispatch?.({
      type: MP_ACTIONS.MP_INVOKE_ABILITY,
      playerIndex: _myIndex, cardUid: _invokeCard,
      target: { playerIndex: playerIdx, slotIndex: slotIdx },
    });
    _invokeCard = null;
    if (target.state) target.state.selected = null;
    target.refreshHandState?.();
  }

  // ── Overlays ─────────────────────────────────────────────────────────────
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
      ${_myIndex === 0
        ? `<button class="mp-ov-btn" onclick="tlrMpNextRound()" type="button">Next Round</button>`
        : `<p class="mp-ov-waiting">Waiting for host…</p>`}`;
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

  // ── Auto-score (host) ────────────────────────────────────────────────────
  let _autoScoreTimer = null;
  function scheduleAutoScore() {
    if (!needsScoring(_state) || _myIndex !== 0 || _autoScoreTimer) return;
    _autoScoreTimer = target.setTimeout(() => {
      _autoScoreTimer = null;
      if (_state && _myIndex === 0 && needsScoring(_state))
        target.tlrMpDispatch?.({ type: MP_ACTIONS.MP_SCORE_ROUND });
    }, 400);
  }

  // ── Intercept placeCard so drag-to-slot dispatches MP action ────────────
  function installPlaceCardOverride() {
    _origPlaceCard = target.placeCard;
    target.placeCard = function (slotIndex) {
      if (!_state) { _origPlaceCard?.call(target, slotIndex); return; }
      const uid = target.state?.selected ?? null;
      if (uid !== null) dispatchPlace(uid, slotIndex);
    };
  }

  function restorePlaceCard() {
    if (_origPlaceCard !== null) {
      target.placeCard = _origPlaceCard;
      _origPlaceCard = null;
    }
  }

  // ── Block SP renderSpread from overwriting MP slots ───────────────────────
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

  // ── Public API ────────────────────────────────────────────────────────────
  target.tlrMpOnMatchStart = function (state, { role }) {
    _state      = state;
    _myIndex    = role === 'host' ? 0 : 1;
    _invokeCard = null;
    _swapFirst  = null;
    mount();
    el('mpGame')?.classList.remove('mp-hidden');
    doc.body.classList.add('mp-game-active');
    installPlaceCardOverride();
    installRenderSpreadOverride();
    render();
    scheduleAutoScore();
  };

  target.tlrMpOnLocalAction = function (_action, state) {
    _state = state; _invokeCard = null; _swapFirst = null;
    render(); scheduleAutoScore();
  };

  target.tlrMpOnPeerAction = function (_action, state) {
    _state = state; render(); scheduleAutoScore();
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

  target.tlrMpInvoke = function () {
    const my  = _myIndex;
    const uid = target.state?.selected ?? null;
    if (!_state || uid === null) return;
    const card = _state.players[my].hand.find(c => c.uid === uid);
    if (!card) return;
    if (card.abilityType === MP_ABILITY_TYPES.MP_BANISH || card.abilityType === MP_ABILITY_TYPES.MP_SEAL) {
      _invokeCard = uid; render();
    } else {
      target.tlrMpDispatch?.({ type: MP_ACTIONS.MP_INVOKE_ABILITY, playerIndex: my, cardUid: uid });
      if (target.state) target.state.selected = null;
      target.refreshHandState?.();
    }
  };

  target.tlrMpCancelAction = function () {
    _invokeCard = null; _swapFirst = null;
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
    _state = null; _invokeCard = null; _swapFirst = null;
    restorePlaceCard();
    restoreRenderSpread();
    doc.body.classList.remove('mp-game-active');
    el('mpGame')?.classList.add('mp-hidden');
    // Reset singleplayer spread so it re-inits on next SP game
    target._slotEls = null;
    const sp = el('spread'); if (sp) { sp._mpSlots = null; sp.replaceChildren(); }
    target.tlrHideMatchmaking?.();
    if (typeof target.tlrShowMainMenu === 'function') target.tlrShowMainMenu();
  };
}

function esc(str) {
  return String(str ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
