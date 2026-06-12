import { MP_PHASES } from '../multiplayer/mpState.mjs';
import { MP_ACTIONS } from '../multiplayer/mpActions.mjs';
import { MP_ABILITY_TYPES } from '../multiplayer/interactionCards.mjs';
import {
  isPlayerTurn, canPlaceCard, canInvokeAbility, canTargetSlot,
  isSlotAnchored, isCardSilenced, canSwapSpread, emptySlots,
  isMatchOver, needsScoring, scores, roundScores, winnerName,
  personaOf, interactionCardsInHand, targetableOpponentSlots,
} from '../multiplayer/mpSelectors.mjs';

// ---------------------------------------------------------------------------
// Install
// ---------------------------------------------------------------------------

export function installMpGame(target = window) {
  if (!target || target.__tlrMpGameInstalled) return;
  target.__tlrMpGameInstalled = true;

  // ---- local UI state ----
  let _state = null;
  let _myIndex = 0;       // 0 = host, 1 = guest
  let _selectedCard = null;  // uid of selected hand card
  let _invokeCard = null;    // uid of card being invoked (awaiting target)
  let _swapFirst = null;     // slotIndex of first swap selection

  // ---- DOM ----
  const doc = target.document;
  function el(id) { return doc.getElementById(id); }

  // ---- Card rendering ----
  // Interaction cards don't have entries in the legacy TXT/ROMAN lookups,
  // so we render them with custom HTML rather than delegating to cardHTML().
  function mpCardHTML(card) {
    if (!card) return '';
    if (card.type === 'interaction') {
      const sym = card.abilityType === MP_ABILITY_TYPES.MP_BANISH ? '⚔' : '🔇';
      return `
        <div class="mp-card mp-card-interaction">
          <div class="mp-card-title">${escHtml(card.name)}</div>
          <span class="mp-card-sym">${sym}</span>
          <span class="mp-card-pts">${card.points}</span>
        </div>`;
    }
    // Standard tarot card — use global cardHTML() if available
    if (typeof target.cardHTML === 'function') {
      return `<div class="mp-card">${target.cardHTML(card)}</div>`;
    }
    // Fallback minimal render
    const sym = typeof target.symbol === 'function' ? target.symbol(card) : '✦';
    const name = card.name ?? '';
    const pts = card.points ?? card.num ?? '';
    return `<div class="mp-card"><div class="mp-card-title">${escHtml(name)}</div><span class="mp-card-sym">${sym}</span><span class="mp-card-pts">${pts}</span></div>`;
  }

  function applyCardPhotos(container) {
    if (typeof target.applyCardPhoto !== 'function') return;
    container.querySelectorAll('[data-uid]').forEach(el => {
      const uid = Number(el.dataset.uid);
      const state = _state;
      if (!state) return;
      for (const p of state.players) {
        const card = [...p.hand, ...p.spread].find(c => c && c.uid === uid);
        if (card && card.type !== 'interaction') { target.applyCardPhoto(el, card); return; }
      }
    });
  }

  // ---- Build & mount ----

  function mount() {
    if (el('mpGame')) return;
    const div = doc.createElement('div');
    div.id = 'mpGame';
    div.className = 'mp-hidden';
    div.innerHTML = buildSkeleton();
    doc.body.appendChild(div);
  }

  function buildSkeleton() {
    return `
      <div class="mp-bar">
        <button class="mp-leave-btn" onclick="tlrMpLeave()" type="button">Leave</button>
        <div class="mp-turn-badge" id="mpTurnBadge"></div>
        <div class="mp-round-label" id="mpRoundLabel"></div>
      </div>
      <div class="mp-player-area mp-opponent" id="mpOppArea"></div>
      <div class="mp-center-bar">
        <div class="mp-progress-wrap">
          <div class="mp-progress-score p0" id="mpScoreP0">0</div>
          <div class="mp-progress-bar" id="mpProgressBar">
            <div class="mp-progress-fill p0" id="mpFillP0" style="width:0%"></div>
            <div class="mp-progress-fill p1" id="mpFillP1" style="width:0%"></div>
          </div>
          <div class="mp-progress-score p1" id="mpScoreP1">0</div>
          <div class="mp-target-label" id="mpTargetLabel"></div>
        </div>
      </div>
      <div class="mp-player-area mp-self" id="mpSelfArea"></div>
      <div class="mp-hand-dock" id="mpHandDock">
        <div class="mp-hand-scroll" id="mpHandScroll"></div>
        <div class="mp-action-panel" id="mpActionPanel"></div>
      </div>
      <div class="mp-overlay mp-ov-hidden" id="mpOverlay">
        <div class="mp-ov-box" id="mpOvBox"></div>
      </div>`;
  }

  // ---- Full re-render ----

  function render() {
    if (!_state) return;
    const s = _state;
    const my = _myIndex;
    const opp = 1 - my;

    renderTopBar(s, my);
    renderPlayerArea(s, opp, 'mpOppArea', false);
    renderPlayerArea(s, my, 'mpSelfArea', true);
    renderProgress(s);
    renderHand(s, my);
    renderActionPanel(s, my);

    if (needsScoring(s)) {
      showScoringOverlay(s);
    } else if (isMatchOver(s)) {
      showCompleteOverlay(s, my);
    } else {
      hideOverlay();
    }

    // Apply photos async after DOM settles
    target.requestAnimationFrame(() => {
      const g = el('mpGame');
      if (g) applyCardPhotos(g);
    });
  }

  function renderTopBar(s, my) {
    const badge = el('mpTurnBadge');
    const roundLabel = el('mpRoundLabel');
    if (!badge) return;

    badge.className = 'mp-turn-badge';
    if (s.phase === MP_PHASES.SCORING || s.phase === MP_PHASES.BETWEEN_ROUNDS) {
      badge.textContent = 'Scoring…';
      badge.classList.add('scoring');
    } else if (s.phase === MP_PHASES.COMPLETE) {
      badge.textContent = 'Match Over';
      badge.classList.add('scoring');
    } else if (s.phase === MP_PHASES.FINAL_TURN) {
      if (s.activePlayerIndex === my) {
        badge.textContent = 'Your Final Turn';
        badge.classList.add('final-turn');
      } else {
        badge.textContent = "Opponent's Final Turn";
        badge.classList.add('opp-turn');
      }
    } else {
      if (s.activePlayerIndex === my) {
        badge.textContent = 'Your Turn';
        badge.classList.add('my-turn');
      } else {
        badge.textContent = "Opponent's Turn";
        badge.classList.add('opp-turn');
      }
    }

    if (roundLabel) roundLabel.textContent = `Round ${s.round ?? 1}`;
  }

  function renderPlayerArea(s, pIdx, areaId, isSelf) {
    const area = el(areaId);
    if (!area) return;
    const player = s.players[pIdx];
    if (!player) { area.innerHTML = ''; return; }

    const persona = personaOf(s, pIdx);
    const personaName = persona?.name ?? player.persona ?? '?';
    const totalScore = player.totalScore ?? 0;

    // Badges
    let badges = '';
    if (player.swapAvailable) badges += `<span class="mp-info-badge mp-badge-swap">Swap</span>`;
    if (player.bonusActionAvailable) badges += `<span class="mp-info-badge mp-badge-bonus">+1</span>`;
    if (s.phase === MP_PHASES.FINAL_TURN && s.activePlayerIndex === pIdx) badges += `<span class="mp-info-badge mp-badge-final">Final</span>`;

    // Opponent hand count
    let handCountHtml = '';
    if (!isSelf) {
      const count = player.hand.length;
      const pips = Array.from({ length: Math.min(count, 7) }, () => `<div class="mp-opp-hand-pip"></div>`).join('');
      handCountHtml = `<div class="mp-opp-hand"><div class="mp-opp-hand-icon">${pips}</div><span class="mp-opp-hand-count">${count} card${count !== 1 ? 's' : ''}</span></div>`;
    }

    area.innerHTML = `
      <div class="mp-player-info">
        <span class="mp-info-persona">${escHtml(personaName)}</span>
        <span class="mp-info-discards">${player.discards} disc</span>
        ${badges}
        <span class="mp-info-score">${totalScore}</span>
      </div>
      ${handCountHtml}
      ${renderSpread(s, pIdx, isSelf)}`;
  }

  function renderSpread(s, pIdx, isSelf) {
    const player = s.players[pIdx];
    if (!player) return '';
    const my = _myIndex;
    const isMyTurn = isPlayerTurn(s, my);
    const opp = 1 - my;

    const slots = player.spread.map((card, slotIdx) => {
      let classes = 'mp-slot';
      if (!card) {
        classes += ' mp-slot-empty';
        // Highlight targetable empty slots for card placement
        if (isSelf && isMyTurn && _selectedCard !== null && !_invokeCard && !_swapFirst) {
          if (canPlaceCard(s, my, _selectedCard, slotIdx)) {
            classes += ' mp-slot-target';
          }
        }
      } else {
        // Targetable for Banish/Seal
        if (_invokeCard !== null && pIdx === opp) {
          const invCard = s.players[my].hand.find(c => c.uid === _invokeCard);
          if (invCard && canTargetSlot(s, pIdx, slotIdx)) {
            classes += ' mp-slot-targetable';
          }
        }
        // Silenced
        if (isCardSilenced(s, pIdx, card.uid)) classes += ' mp-slot-silenced';
        // Anchored
        if (isSlotAnchored(s, pIdx, slotIdx)) classes += ' mp-slot-anchored';
        // Swap selection
        if (isSelf && _swapFirst !== null) {
          if (_swapFirst === slotIdx) classes += ' mp-slot-swap-a';
          else classes += ' mp-slot-swap-pick';
        }
      }

      let onclick = '';
      if (isSelf && isMyTurn && _selectedCard !== null && !card && !_invokeCard && !_swapFirst) {
        onclick = `onclick="tlrMpClickSlot(${pIdx},${slotIdx})"`;
      } else if (_invokeCard !== null && pIdx === opp && card && canTargetSlot(s, pIdx, slotIdx)) {
        onclick = `onclick="tlrMpClickSlot(${pIdx},${slotIdx})"`;
      } else if (isSelf && _swapFirst !== null && card) {
        onclick = `onclick="tlrMpClickSlot(${pIdx},${slotIdx})"`;
      } else if (isSelf && canSwapSpread(s, my) && _swapFirst === null && card) {
        // Surgeon first tap
        onclick = '';
      }

      const cardHtml = card ? mpCardHTML(card) : '';
      return `<div class="${classes}" data-slot="${slotIdx}" ${onclick}>${cardHtml}</div>`;
    }).join('');

    return `<div class="mp-spread">${slots}</div>`;
  }

  function renderProgress(s) {
    const sc = scores(s);
    const target_ = s.scoreTarget ?? 200;
    const p0 = el('mpScoreP0'), p1 = el('mpScoreP1');
    const f0 = el('mpFillP0'), f1 = el('mpFillP1');
    const lbl = el('mpTargetLabel');
    if (p0) p0.textContent = sc[0];
    if (p1) p1.textContent = sc[1];
    if (f0) f0.style.width = Math.min(100, Math.round(sc[0] / target_ * 100)) + '%';
    if (f1) f1.style.width = Math.min(100, Math.round(sc[1] / target_ * 100)) + '%';
    if (lbl) lbl.textContent = `/ ${target_}`;
  }

  function renderHand(s, my) {
    const scroll = el('mpHandScroll');
    if (!scroll) return;
    const player = s.players[my];
    if (!player) { scroll.innerHTML = ''; return; }

    const isTurn = isPlayerTurn(s, my) || s.phase === MP_PHASES.FINAL_TURN && s.activePlayerIndex === my;

    scroll.innerHTML = player.hand.map(card => {
      let cls = 'mp-hand-card';
      if (card.uid === _selectedCard) cls += ' mp-card-selected';
      if (card.uid === _invokeCard) cls += ' mp-card-invoke-target';
      if (card.type === 'interaction') cls += ' mp-card-interaction';

      const clickable = isTurn && !_swapFirst;
      const sym = card.type === 'interaction'
        ? (card.abilityType === MP_ABILITY_TYPES.MP_BANISH ? '⚔' : '🔇')
        : (typeof target.symbol === 'function' ? target.symbol(card) : '✦');

      return `<div class="${cls}" data-uid="${card.uid}" ${clickable ? `onclick="tlrMpClickHandCard(${card.uid})"` : ''}>
        <div class="mp-card-title">${escHtml(card.name ?? '')}</div>
        <span class="mp-card-sym">${sym}</span>
        <span class="mp-card-pts">${card.points ?? card.num ?? ''}</span>
      </div>`;
    }).join('');
  }

  function renderActionPanel(s, my) {
    const panel = el('mpActionPanel');
    if (!panel) return;
    const player = s.players[my];
    if (!player) { panel.innerHTML = ''; return; }

    const isTurn = isPlayerTurn(s, my) || (s.phase === MP_PHASES.FINAL_TURN && s.activePlayerIndex === my);
    const parts = [];

    if (_invokeCard !== null) {
      parts.push(`<span class="mp-action-hint">Select a target slot on the opponent's spread.</span>`);
      parts.push(`<button class="mp-action-btn mp-btn-cancel" onclick="tlrMpCancelAction()" type="button">Cancel</button>`);
    } else if (_swapFirst !== null) {
      parts.push(`<span class="mp-action-hint">Select the second slot to swap.</span>`);
      parts.push(`<button class="mp-action-btn mp-btn-cancel" onclick="tlrMpCancelAction()" type="button">Cancel</button>`);
    } else if (_selectedCard !== null) {
      const card = player.hand.find(c => c.uid === _selectedCard);
      if (card) {
        if (isTurn && (card.ability || card.abilityType) && canInvokeAbility(s, my, _selectedCard)) {
          parts.push(`<button class="mp-action-btn mp-btn-invoke" onclick="tlrMpInvoke()" type="button">Invoke</button>`);
        }
      }
      parts.push(`<span class="mp-action-hint">${isTurn ? 'Tap a spread slot to place.' : 'Waiting for opponent…'}</span>`);
      parts.push(`<button class="mp-action-btn mp-btn-cancel" onclick="tlrMpCancelAction()" type="button">Deselect</button>`);
    } else if (isTurn) {
      if (canSwapSpread(s, my)) {
        parts.push(`<button class="mp-action-btn mp-btn-swap" onclick="tlrMpStartSwap()" type="button">Swap Spread</button>`);
      }
      parts.push(`<span class="mp-action-hint">Select a card from your hand.</span>`);
    } else {
      parts.push(`<span class="mp-action-hint">Waiting for opponent…</span>`);
    }

    panel.innerHTML = parts.join('');
  }

  // ---- Overlay helpers ----

  function showScoringOverlay(s) {
    const box = el('mpOvBox');
    const overlay = el('mpOverlay');
    if (!box || !overlay) return;
    const rs = roundScores(s);
    const ts = scores(s);
    const myRs = rs[_myIndex], oppRs = rs[1 - _myIndex];
    const myTs = ts[_myIndex], oppTs = ts[1 - _myIndex];

    box.innerHTML = `
      <h2 class="mp-ov-title">Round ${s.round ?? 1} Complete</h2>
      <div class="mp-ov-scores">
        <div>
          <div class="mp-ov-score-val">${myRs}</div>
          <div class="mp-ov-score-label">You</div>
        </div>
        <div class="mp-ov-vs">vs</div>
        <div>
          <div class="mp-ov-score-val">${oppRs}</div>
          <div class="mp-ov-score-label">Opponent</div>
        </div>
      </div>
      <div class="mp-ov-totals">Total: ${myTs} – ${oppTs} &nbsp;/&nbsp; ${s.scoreTarget ?? 200}</div>
      ${_myIndex === 0
        ? `<button class="mp-ov-btn" onclick="tlrMpNextRound()" type="button">Next Round</button>`
        : `<p class="mp-ov-waiting">Waiting for host to start next round…</p>`}`;
    overlay.classList.remove('mp-ov-hidden');
  }

  function showCompleteOverlay(s, my) {
    const box = el('mpOvBox');
    const overlay = el('mpOverlay');
    if (!box || !overlay) return;
    const ts = scores(s);
    const myTs = ts[my], oppTs = ts[1 - my];
    const w = s.winner;
    const isWin = w === my;
    const isDraw = w === 'draw';
    const resultText = isDraw ? 'Draw' : (isWin ? 'Victory' : 'Defeat');
    const resultClass = isDraw ? 'draw' : (isWin ? 'win' : 'lose');

    box.innerHTML = `
      <h2 class="mp-ov-title">Match Over</h2>
      <p class="mp-ov-winner ${resultClass}">${resultText}</p>
      <div class="mp-ov-scores">
        <div>
          <div class="mp-ov-score-val">${myTs}</div>
          <div class="mp-ov-score-label">You</div>
        </div>
        <div class="mp-ov-vs">vs</div>
        <div>
          <div class="mp-ov-score-val">${oppTs}</div>
          <div class="mp-ov-score-label">Opponent</div>
        </div>
      </div>
      <button class="mp-ov-btn" onclick="tlrMpLeave()" type="button">Return to Menu</button>`;
    overlay.classList.remove('mp-ov-hidden');
  }

  function hideOverlay() {
    el('mpOverlay')?.classList.add('mp-ov-hidden');
  }

  // ---- Public API hooked from matchmakingScreen ----

  target.tlrMpOnMatchStart = function (state, { role }) {
    _state = state;
    _myIndex = role === 'host' ? 0 : 1;
    _selectedCard = null;
    _invokeCard = null;
    _swapFirst = null;
    mount();
    const g = el('mpGame');
    if (g) g.classList.remove('mp-hidden');
    render();

    // Host auto-scores after a brief delay once phase enters SCORING
    if (role === 'host') scheduleAutoScore();
  };

  target.tlrMpOnLocalAction = function (_action, state) {
    _state = state;
    _selectedCard = null;
    _invokeCard = null;
    // Don't clear _swapFirst here — the reducer handles it
    _swapFirst = null;
    render();
    if (_myIndex === 0) scheduleAutoScore();
  };

  target.tlrMpOnPeerAction = function (_action, state) {
    _state = state;
    render();
    if (_myIndex === 0) scheduleAutoScore();
  };

  target.tlrMpHandlePeerLeft = function () {
    const box = el('mpOvBox');
    const overlay = el('mpOverlay');
    if (!box || !overlay) return;
    box.innerHTML = `
      <h2 class="mp-ov-title">Opponent Left</h2>
      <p style="color:#b09060;font:400 12px/1.5 system-ui,sans-serif">Your opponent disconnected.</p>
      <button class="mp-ov-btn" onclick="tlrMpLeave()" type="button">Return to Menu</button>`;
    overlay.classList.remove('mp-ov-hidden');
  };

  // ---- Auto-score (host only) ----

  let _autoScoreTimer = null;
  function scheduleAutoScore() {
    if (_autoScoreTimer) return;
    _autoScoreTimer = target.setTimeout(() => {
      _autoScoreTimer = null;
      if (!_state || _myIndex !== 0) return;
      if (needsScoring(_state)) {
        const newState = target.tlrMpDispatch?.({ type: MP_ACTIONS.MP_SCORE_ROUND });
        if (newState) _state = newState;
        render();
      }
    }, 400);
  }

  // ---- Interaction handlers ----

  target.tlrMpClickHandCard = function (uid) {
    if (!_state || _swapFirst !== null) return;
    const my = _myIndex;
    const player = _state.players[my];
    if (!player) return;

    if (_selectedCard === uid) {
      _selectedCard = null;
      _invokeCard = null;
    } else {
      _selectedCard = uid;
      _invokeCard = null;
    }
    render();
  };

  target.tlrMpClickSlot = function (playerIdx, slotIdx) {
    if (!_state) return;
    const my = _myIndex;
    const opp = 1 - my;
    const s = _state;

    // Invoke targeting mode
    if (_invokeCard !== null && playerIdx === opp) {
      const invCard = s.players[my].hand.find(c => c.uid === _invokeCard);
      if (invCard && canTargetSlot(s, playerIdx, slotIdx)) {
        target.tlrMpDispatch?.({
          type: MP_ACTIONS.MP_INVOKE_ABILITY,
          playerIndex: my,
          cardUid: _invokeCard,
          target: { playerIndex: playerIdx, slotIndex: slotIdx },
        });
        _invokeCard = null;
        _selectedCard = null;
      }
      return;
    }

    // Swap mode
    if (_swapFirst !== null && playerIdx === my) {
      if (_swapFirst === slotIdx) { _swapFirst = null; render(); return; }
      target.tlrMpDispatch?.({
        type: MP_ACTIONS.MP_SWAP_SPREAD,
        playerIndex: my,
        slotA: _swapFirst,
        slotB: slotIdx,
      });
      _swapFirst = null;
      return;
    }

    // Place card
    if (_selectedCard !== null && playerIdx === my) {
      if (canPlaceCard(s, my, _selectedCard, slotIdx)) {
        target.tlrMpDispatch?.({
          type: MP_ACTIONS.MP_PLACE_CARD,
          playerIndex: my,
          cardUid: _selectedCard,
          slotIndex: slotIdx,
        });
        _selectedCard = null;
      }
    }
  };

  target.tlrMpInvoke = function () {
    if (!_state || _selectedCard === null) return;
    const my = _myIndex;
    const s = _state;
    const card = s.players[my].hand.find(c => c.uid === _selectedCard);
    if (!card) return;

    if (card.abilityType === MP_ABILITY_TYPES.MP_BANISH || card.abilityType === MP_ABILITY_TYPES.MP_SEAL) {
      // Needs a target — enter target-selection mode
      _invokeCard = _selectedCard;
      _selectedCard = null;
      render();
    } else {
      // Self-targeting invoke (DRAW, etc.)
      target.tlrMpDispatch?.({
        type: MP_ACTIONS.MP_INVOKE_ABILITY,
        playerIndex: my,
        cardUid: _selectedCard,
      });
      _selectedCard = null;
    }
  };

  target.tlrMpCancelAction = function () {
    _selectedCard = null;
    _invokeCard = null;
    _swapFirst = null;
    render();
  };

  target.tlrMpStartSwap = function () {
    if (!_state || !canSwapSpread(_state, _myIndex)) return;
    _swapFirst = null;
    // Let user tap first slot — re-route slot clicks to swap mode
    // First tap will be caught in tlrMpClickSwapFirstSlot (we wire slots below)
    // Actually, we need to wire spread slot clicks for self — re-render
    // to expose swap-pick slots, which call tlrMpClickSlot.
    // We enter a mode where clicking any filled self slot sets _swapFirst
    _swapFirst = -1; // sentinel: awaiting first pick
    render();
  };

  // When in swap mode and _swapFirst is -1 (awaiting first tap), slot click sets first
  const origClickSlot = target.tlrMpClickSlot;
  target.tlrMpClickSlot = function (playerIdx, slotIdx) {
    if (_swapFirst === -1 && playerIdx === _myIndex) {
      const player = _state?.players[_myIndex];
      if (player?.spread[slotIdx]) { _swapFirst = slotIdx; render(); return; }
    }
    origClickSlot(playerIdx, slotIdx);
  };

  target.tlrMpNextRound = function () {
    if (!_state || _myIndex !== 0) return;
    target.tlrMpDispatch?.({ type: MP_ACTIONS.MP_NEW_ROUND, playerIndex: 0 });
  };

  target.tlrMpLeave = function () {
    _state = null;
    _selectedCard = null;
    _invokeCard = null;
    _swapFirst = null;
    if (_autoScoreTimer) { target.clearTimeout(_autoScoreTimer); _autoScoreTimer = null; }
    el('mpGame')?.classList.add('mp-hidden');
    target.tlrHideMatchmaking?.();
    if (typeof target.tlrShowMainMenu === 'function') target.tlrShowMainMenu();
  };
}

function escHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
