import { MP_PHASES } from '../multiplayer/mpState.mjs';
import { MP_ACTIONS } from '../multiplayer/mpActions.mjs';
import { MP_ABILITY_TYPES } from '../multiplayer/interactionCards.mjs';
import {
  isPlayerTurn, canPlaceCard, canInvokeAbility, canTargetSlot,
  isSlotAnchored, isCardSilenced, canSwapSpread,
  isMatchOver, needsScoring, scores, roundScores, winnerName,
  personaOf,
} from '../multiplayer/mpSelectors.mjs';
import { cardHTML, applyCardPhoto, CARD_SHEET } from '../ui/renderCard.mjs';

export function installMpGame(target = window) {
  if (!target || target.__tlrMpGameInstalled) return;
  target.__tlrMpGameInstalled = true;

  // ── local UI state ──────────────────────────────────────────────────────────
  let _state      = null;
  let _myIndex    = 0;
  let _selected   = null;   // uid of selected hand card
  let _invokeCard = null;   // uid of card being invoked (awaiting target)
  let _swapFirst  = null;   // null | -1 (awaiting first tap) | slotIndex

  const doc = target.document;
  function el(id) { return doc.getElementById(id); }

  // ── Interaction-card HTML (they don't have TXT entries) ───────────────────
  function mpInteractionCardHTML(card) {
    const sym = card.abilityType === MP_ABILITY_TYPES.MP_BANISH ? '⚔' : '🔇';
    return `
      <div class="card-type">Interaction</div>
      <div class="card-name">${esc(card.name)}</div>
      <div class="card-glyph">${sym}</div>
      <div class="card-pts">${card.points}</div>`;
  }

  function mpCardHTML(card) {
    if (!card) return '';
    if (card.type === 'interaction') return mpInteractionCardHTML(card);
    return cardHTML(card);
  }

  function mpApplyPhoto(el, card) {
    if (!card || card.type === 'interaction') return;
    applyCardPhoto(el, card);
  }

  // ── Mount skeleton HTML ──────────────────────────────────────────────────
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
      <div class="mp-opp-hand" id="mpOppHand"></div>

      <div class="mp-opp-spread-clip">
        <div class="mp-opp-spread-transform">
          <div class="spread" id="mpOppSpread"></div>
        </div>
      </div>

      <div class="mp-progress-row">
        <span class="mp-progress-score" id="mpScoreP0">0</span>
        <div class="mp-progress-bar">
          <div class="mp-progress-fill p0" id="mpFillP0" style="width:0%"></div>
          <div class="mp-progress-fill p1" id="mpFillP1" style="width:0%"></div>
        </div>
        <span class="mp-progress-score right" id="mpScoreP1">0</span>
        <span class="mp-target-label" id="mpTargetLabel"></span>
      </div>

      <div class="mp-player-row" id="mpSelfRow"></div>

      <div class="mp-self-spread">
        <div class="spread" id="mpSelfSpread"></div>
      </div>

      <div class="mp-action-panel" id="mpActionPanel"></div>

      <div class="handDock">
        <div id="mpHand" class="hand"></div>
      </div>

      <div class="mp-overlay mp-ov-hidden" id="mpOverlay">
        <div class="mp-ov-box" id="mpOvBox"></div>
      </div>`;
  }

  // ── Full re-render ────────────────────────────────────────────────────────
  function render() {
    if (!_state) return;
    const s    = _state;
    const my   = _myIndex;
    const opp  = 1 - my;

    renderTopBar(s, my);
    renderPlayerRow(s, opp, 'mpOppRow');
    renderOppHand(s, opp);
    renderSpread(s, opp, 'mpOppSpread', false);
    renderProgress(s);
    renderPlayerRow(s, my,  'mpSelfRow');
    renderSpread(s, my,  'mpSelfSpread', true);
    renderHand(s, my);
    renderActionPanel(s, my);

    if (needsScoring(s))  showScoringOverlay(s);
    else if (isMatchOver(s)) showCompleteOverlay(s, my);
    else hideOverlay();
  }

  // ── Top bar ───────────────────────────────────────────────────────────────
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
      if (s.activePlayerIndex === my) { badge.textContent = 'Your Final Turn'; badge.classList.add('final-turn'); }
      else                            { badge.textContent = "Opponent's Final Turn"; badge.classList.add('opp-turn'); }
    } else {
      if (s.activePlayerIndex === my) { badge.textContent = 'Your Turn'; badge.classList.add('my-turn'); }
      else                            { badge.textContent = "Opponent's Turn"; badge.classList.add('opp-turn'); }
    }
    if (round) round.textContent = `Round ${s.round ?? 1}`;
  }

  // ── Player info row ───────────────────────────────────────────────────────
  function renderPlayerRow(s, pIdx, rowId) {
    const row = el(rowId);
    if (!row) return;
    const p = s.players[pIdx];
    if (!p) { row.innerHTML = ''; return; }
    const persona = personaOf(s, pIdx)?.name ?? p.persona ?? '?';
    let badges = '';
    if (p.swapAvailable)       badges += `<span class="mp-badge mp-badge-swap">Swap</span>`;
    if (p.bonusActionAvailable) badges += `<span class="mp-badge mp-badge-bonus">+1</span>`;
    row.innerHTML = `
      <span class="mp-persona">${esc(persona)}</span>
      ${badges}
      <span class="mp-discards">${p.discards} disc</span>
      <span class="mp-score">${p.totalScore ?? 0}</span>`;
  }

  // ── Opponent face-down hand count ─────────────────────────────────────────
  function renderOppHand(s, oppIdx) {
    const wrap = el('mpOppHand');
    if (!wrap) return;
    const count = s.players[oppIdx]?.hand?.length ?? 0;
    const pips = Array.from({ length: Math.min(count, 7) }, () => `<span class="mp-opp-pip"></span>`).join('');
    wrap.innerHTML = `${pips}<span class="mp-opp-hand-label">${count} card${count !== 1 ? 's' : ''}</span>`;
  }

  // ── Spread ────────────────────────────────────────────────────────────────
  // Uses the same .slot / .card structure as the singleplayer renderSpread.
  function renderSpread(s, pIdx, spreadId, isSelf) {
    const spreadEl = el(spreadId);
    if (!spreadEl) return;
    const player  = s.players[pIdx];
    if (!player) return;

    const my     = _myIndex;
    const opp    = 1 - my;
    const isTurn = isPlayerTurn(s, my) || (s.phase === MP_PHASES.FINAL_TURN && s.activePlayerIndex === my);

    // Reuse or create 5 stable slot elements
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

      // Determine CSS classes
      let cls = 'slot ';
      if (card) {
        cls += 'filled';
        if (isSelf && isSlotAnchored(s, pIdx, i)) cls += ' mp-anchored';
        if (isSelf && isCardSilenced(s, pIdx, card.uid)) cls += ' mp-silenced';
        // Swap mode highlights
        if (isSelf) {
          if (_swapFirst === i)   cls += ' mp-swap-a';
          else if (_swapFirst >= 0) cls += ' mp-swap-pick';
        }
        // Banish/Seal targetable
        if (_invokeCard !== null && pIdx === opp && canTargetSlot(s, pIdx, i)) cls += ' mp-targetable';
        if (!isSelf && isSlotAnchored(s, pIdx, i)) cls += ' mp-anchored';
        if (!isSelf && isCardSilenced(s, pIdx, card.uid)) cls += ' mp-silenced';
      } else {
        cls += 'empty';
        if (isSelf && isTurn && _selected !== null && !_invokeCard && _swapFirst === null) {
          if (canPlaceCard(s, my, _selected, i)) cls += ' target';
        }
      }
      slotEl.className = cls;

      // onclick
      if (card && _invokeCard !== null && pIdx === opp && canTargetSlot(s, pIdx, i)) {
        slotEl.onclick = () => target.tlrMpClickSlot(pIdx, i);
      } else if (isSelf && card && _swapFirst === -1) {
        slotEl.onclick = () => target.tlrMpClickSlot(pIdx, i);
      } else if (isSelf && card && _swapFirst >= 0 && _swapFirst !== i) {
        slotEl.onclick = () => target.tlrMpClickSlot(pIdx, i);
      } else if (isSelf && !card && isTurn && _selected !== null && canPlaceCard(s, my, _selected, i)) {
        slotEl.onclick = () => target.tlrMpClickSlot(pIdx, i);
      } else {
        slotEl.onclick = null;
      }

      // Card child
      if (card) {
        let cardEl = slotEl.firstElementChild;
        const sameCard = cardEl?.classList?.contains('card') && Number(cardEl.dataset.uid) === card.uid;
        if (!sameCard) {
          slotEl.replaceChildren();
          cardEl = doc.createElement('div');
          cardEl.dataset.uid = card.uid;
          cardEl.innerHTML = mpCardHTML(card);
          mpApplyPhoto(cardEl, card);
          slotEl.appendChild(cardEl);
        }
        cardEl.className = 'card'
          + (card.type === 'major' ? ' major' : '')
          + (CARD_SHEET[card.id] ? ' photo' : '')
          + (card.type === 'interaction' ? ' mp-interaction' : '');
      } else {
        // Empty slot — keep/create .num label
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

  // ── Hand ──────────────────────────────────────────────────────────────────
  function renderHand(s, my) {
    const handEl = el('mpHand');
    if (!handEl) return;
    const player = s.players[my];
    if (!player) { handEl.replaceChildren(); return; }

    const isTurn = isPlayerTurn(s, my) || (s.phase === MP_PHASES.FINAL_TURN && s.activePlayerIndex === my);
    const cards  = player.hand;
    const len    = cards.length;

    // Diff by uid
    const existing = new Map();
    handEl.querySelectorAll(':scope > .card[data-uid]').forEach(e => existing.set(Number(e.dataset.uid), e));

    cards.forEach((c, i) => {
      let cardEl = existing.get(c.uid);
      if (!cardEl) {
        cardEl = doc.createElement('div');
        cardEl.dataset.uid = c.uid;
        cardEl.innerHTML = mpCardHTML(c);
        mpApplyPhoto(cardEl, c);
      } else {
        existing.delete(c.uid);
      }
      cardEl.className = 'card'
        + (c.type === 'major' ? ' major' : '')
        + (CARD_SHEET[c.id] ? ' photo' : '')
        + (c.type === 'interaction' ? ' mp-interaction' : '')
        + (_selected === c.uid ? ' sel' : '');
      cardEl.style.zIndex = len - i;
      cardEl.style.setProperty('--a', ((i - (len - 1) / 2) * 5) + 'deg');
      cardEl.onclick = (isTurn && _swapFirst === null)
        ? () => target.tlrMpClickHandCard(c.uid)
        : null;
      const at = handEl.children[i];
      if (at !== cardEl) handEl.insertBefore(cardEl, at || null);
    });
    existing.forEach(e => e.remove());
  }

  // ── Progress bar ──────────────────────────────────────────────────────────
  function renderProgress(s) {
    const sc  = scores(s);
    const tgt = s.scoreTarget ?? 200;
    const p0e = el('mpScoreP0'), p1e = el('mpScoreP1');
    const f0  = el('mpFillP0'),  f1  = el('mpFillP1');
    const lbl = el('mpTargetLabel');
    if (p0e) p0e.textContent = sc[0];
    if (p1e) p1e.textContent = sc[1];
    if (f0)  f0.style.width = Math.min(100, Math.round(sc[0] / tgt * 100)) + '%';
    if (f1)  f1.style.width = Math.min(100, Math.round(sc[1] / tgt * 100)) + '%';
    if (lbl) lbl.textContent = `/ ${tgt}`;
  }

  // ── Action panel ──────────────────────────────────────────────────────────
  function renderActionPanel(s, my) {
    const panel = el('mpActionPanel');
    if (!panel) return;
    const p      = s.players[my];
    const isTurn = isPlayerTurn(s, my) || (s.phase === MP_PHASES.FINAL_TURN && s.activePlayerIndex === my);
    const parts  = [];

    if (_invokeCard !== null) {
      parts.push(`<span class="mp-action-hint">Tap a card on the opponent's spread.</span>`);
      parts.push(`<button class="mp-action-btn cancel" onclick="tlrMpCancelAction()" type="button">Cancel</button>`);
    } else if (_swapFirst !== null) {
      parts.push(`<span class="mp-action-hint">${_swapFirst === -1 ? 'Tap the first spread card to swap.' : 'Tap the second card.'}</span>`);
      parts.push(`<button class="mp-action-btn cancel" onclick="tlrMpCancelAction()" type="button">Cancel</button>`);
    } else if (_selected !== null) {
      const card = p?.hand.find(c => c.uid === _selected);
      if (card && isTurn && (card.ability || card.abilityType) && canInvokeAbility(s, my, _selected)) {
        parts.push(`<button class="mp-action-btn invoke" onclick="tlrMpInvoke()" type="button">Invoke</button>`);
      }
      parts.push(`<span class="mp-action-hint">${isTurn ? 'Tap a spread slot to place.' : 'Waiting for opponent…'}</span>`);
      parts.push(`<button class="mp-action-btn cancel" onclick="tlrMpCancelAction()" type="button">Deselect</button>`);
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

  // ── Overlays ──────────────────────────────────────────────────────────────
  function showScoringOverlay(s) {
    const overlay = el('mpOverlay'), box = el('mpOvBox');
    if (!box || !overlay) return;
    const rs = roundScores(s);
    const ts = scores(s);
    const my = _myIndex, opp = 1 - _myIndex;
    box.innerHTML = `
      <h2 class="mp-ov-title">Round ${s.round ?? 1} Complete</h2>
      <div class="mp-ov-scores">
        <div><div class="mp-ov-score-val">${rs[my]}</div><div class="mp-ov-score-label">You</div></div>
        <div class="mp-ov-vs">vs</div>
        <div><div class="mp-ov-score-val">${rs[opp]}</div><div class="mp-ov-score-label">Opponent</div></div>
      </div>
      <div class="mp-ov-totals">Running total: ${ts[my]} – ${ts[opp]} &nbsp;/&nbsp; ${s.scoreTarget ?? 200}</div>
      ${_myIndex === 0
        ? `<button class="mp-ov-btn" onclick="tlrMpNextRound()" type="button">Next Round</button>`
        : `<p class="mp-ov-waiting">Waiting for host…</p>`}`;
    overlay.classList.remove('mp-ov-hidden');
  }

  function showCompleteOverlay(s, my) {
    const overlay = el('mpOverlay'), box = el('mpOvBox');
    if (!box || !overlay) return;
    const ts = scores(s);
    const w  = s.winner;
    const isWin  = w === my;
    const isDraw = w === 'draw';
    const result = isDraw ? 'Draw' : (isWin ? 'Victory' : 'Defeat');
    const cls    = isDraw ? 'draw' : (isWin ? 'win' : 'lose');
    box.innerHTML = `
      <h2 class="mp-ov-title">Match Over</h2>
      <p class="mp-ov-winner ${cls}">${result}</p>
      <div class="mp-ov-scores">
        <div><div class="mp-ov-score-val">${ts[my]}</div><div class="mp-ov-score-label">You</div></div>
        <div class="mp-ov-vs">vs</div>
        <div><div class="mp-ov-score-val">${ts[1 - my]}</div><div class="mp-ov-score-label">Opponent</div></div>
      </div>
      <button class="mp-ov-btn" onclick="tlrMpLeave()" type="button">Return to Menu</button>`;
    overlay.classList.remove('mp-ov-hidden');
  }

  function hideOverlay() {
    el('mpOverlay')?.classList.add('mp-ov-hidden');
  }

  // ── Auto-score (host only) ────────────────────────────────────────────────
  let _autoScoreTimer = null;
  function scheduleAutoScore() {
    if (!needsScoring(_state) || _myIndex !== 0 || _autoScoreTimer) return;
    _autoScoreTimer = target.setTimeout(() => {
      _autoScoreTimer = null;
      if (!_state || _myIndex !== 0 || !needsScoring(_state)) return;
      target.tlrMpDispatch?.({ type: MP_ACTIONS.MP_SCORE_ROUND });
    }, 400);
  }

  // ── Public hooks from matchmakingScreen ──────────────────────────────────
  target.tlrMpOnMatchStart = function (state, { role }) {
    _state      = state;
    _myIndex    = role === 'host' ? 0 : 1;
    _selected   = null;
    _invokeCard = null;
    _swapFirst  = null;
    mount();
    el('mpGame')?.classList.remove('mp-hidden');
    render();
    scheduleAutoScore();
  };

  target.tlrMpOnLocalAction = function (_action, state) {
    _state      = state;
    _selected   = null;
    _invokeCard = null;
    _swapFirst  = null;
    render();
    scheduleAutoScore();
  };

  target.tlrMpOnPeerAction = function (_action, state) {
    _state = state;
    render();
    scheduleAutoScore();
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

  // ── Interaction handlers ──────────────────────────────────────────────────
  target.tlrMpClickHandCard = function (uid) {
    if (!_state || _swapFirst !== null) return;
    _selected   = (_selected === uid) ? null : uid;
    _invokeCard = null;
    render();
  };

  target.tlrMpClickSlot = function (playerIdx, slotIdx) {
    if (!_state) return;
    const my  = _myIndex;
    const opp = 1 - my;
    const s   = _state;

    // Invoke target mode
    if (_invokeCard !== null && playerIdx === opp) {
      if (canTargetSlot(s, playerIdx, slotIdx)) {
        target.tlrMpDispatch?.({
          type: MP_ACTIONS.MP_INVOKE_ABILITY,
          playerIndex: my, cardUid: _invokeCard,
          target: { playerIndex: playerIdx, slotIndex: slotIdx },
        });
        _invokeCard = null; _selected = null;
      }
      return;
    }

    // Swap mode
    if (_swapFirst !== null && playerIdx === my) {
      const card = s.players[my].spread[slotIdx];
      if (_swapFirst === -1) {
        if (card) { _swapFirst = slotIdx; render(); }
        return;
      }
      if (_swapFirst === slotIdx) { _swapFirst = null; render(); return; }
      target.tlrMpDispatch?.({
        type: MP_ACTIONS.MP_SWAP_SPREAD,
        playerIndex: my, slotA: _swapFirst, slotB: slotIdx,
      });
      _swapFirst = null;
      return;
    }

    // Place card
    if (_selected !== null && playerIdx === my) {
      if (canPlaceCard(s, my, _selected, slotIdx)) {
        target.tlrMpDispatch?.({
          type: MP_ACTIONS.MP_PLACE_CARD,
          playerIndex: my, cardUid: _selected, slotIndex: slotIdx,
        });
        _selected = null;
      }
    }
  };

  target.tlrMpInvoke = function () {
    if (!_state || _selected === null) return;
    const my   = _myIndex;
    const card = _state.players[my].hand.find(c => c.uid === _selected);
    if (!card) return;
    if (card.abilityType === MP_ABILITY_TYPES.MP_BANISH || card.abilityType === MP_ABILITY_TYPES.MP_SEAL) {
      _invokeCard = _selected; _selected = null; render();
    } else {
      target.tlrMpDispatch?.({
        type: MP_ACTIONS.MP_INVOKE_ABILITY,
        playerIndex: my, cardUid: _selected,
      });
      _selected = null;
    }
  };

  target.tlrMpCancelAction = function () {
    _selected = null; _invokeCard = null; _swapFirst = null;
    render();
  };

  target.tlrMpStartSwap = function () {
    if (!_state || !canSwapSpread(_state, _myIndex)) return;
    _swapFirst = -1;
    render();
  };

  target.tlrMpNextRound = function () {
    if (!_state || _myIndex !== 0) return;
    target.tlrMpDispatch?.({ type: MP_ACTIONS.MP_NEW_ROUND, playerIndex: 0 });
  };

  target.tlrMpLeave = function () {
    if (_autoScoreTimer) { target.clearTimeout(_autoScoreTimer); _autoScoreTimer = null; }
    _state = null; _selected = null; _invokeCard = null; _swapFirst = null;
    el('mpGame')?.classList.add('mp-hidden');
    target.tlrHideMatchmaking?.();
    if (typeof target.tlrShowMainMenu === 'function') target.tlrShowMainMenu();
  };
}

function esc(str) {
  return String(str ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
