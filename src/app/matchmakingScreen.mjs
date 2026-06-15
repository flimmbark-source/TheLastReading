import { AblyRoomPeer } from './ablyRoomPeer.mjs';
import { randomSeed } from '../multiplayer/mpRng.mjs';
import { MP_ACTIONS } from '../multiplayer/mpActions.mjs';
import { mpReducer, applyImmediateAction } from '../multiplayer/mpReducer.mjs';
import { MP_PHASES } from '../multiplayer/mpState.mjs';
import { hasSubmittedAction, emptySlots } from '../multiplayer/mpSelectors.mjs';
import { MP_ABILITY_TYPES } from '../multiplayer/interactionCards.mjs';
import { ABILITY_TYPES, getAbility } from '../data/abilities.mjs';
import { computeScore } from '../systems/scoring.mjs';

// ---------------------------------------------------------------------------
// Internal state
// ---------------------------------------------------------------------------

let _peer = null;
let _role = null;       // 'host' | 'guest'
let _roomCode = null;
let _matchState = null; // live mpState once match starts
let _profile = null;    // { personaId, scoreTarget }
let _opponentProfile = null; // { personaId }
let _cpuMode = false;
let _scoreRoundRetryTimer = null;
let _peerScoreRoundRetryTimer = null;
let _newRoundRetryTimer = null;
let _peerNewRoundRetryTimer = null;

const CPU_MONTE_CARLO_ROLLOUTS = 28;
const CPU_MAX_MONTE_CARLO_CANDIDATES = 24;

// ---------------------------------------------------------------------------
// Install
// ---------------------------------------------------------------------------

export function installMatchmakingScreen(target = window) {
  if (!target || target.__tlrMatchmakingInstalled) return;
  target.__tlrMatchmakingInstalled = true;

  // --- DOM helpers ---
  function el(id) { return target.document.getElementById(id); }
  function setHtml(id, html) { const e = el(id); if (e) e.innerHTML = html; }
  function show(id) { const e = el(id); if (e) e.classList.remove('mm-screen-hidden'); }
  function hide(id) { const e = el(id); if (e) e.classList.add('mm-screen-hidden'); }

  // --- Render phases ---

  function renderIdlePhase() {
    const p = _profile ?? {};
    const t = p.scoreTarget ?? 200;
    const persona = p.personaId;
    const sel = v => t === v ? ' selected' : '';
    setHtml('mmContent', `
      ${persona ? `<div class="mm-profile"><div class="mm-profile-persona">${escHtml(personaName(persona))}</div></div>` : ''}
      <div class="mm-match-section">
        <h3 class="mm-section-label">Match Length</h3>
        <div class="mm-targets">
          <button class="mm-target-btn${sel(100)}" onclick="tlrMmSetTarget(100)" type="button">Quick<span>100</span></button>
          <button class="mm-target-btn${sel(200)}" onclick="tlrMmSetTarget(200)" type="button">Standard<span>200</span></button>
          <button class="mm-target-btn${sel(300)}" onclick="tlrMmSetTarget(300)" type="button">Long<span>300</span></button>
        </div>
      </div>
      <div class="mm-mode-row">
        <button class="mm-mode-btn" onclick="tlrMmHost()" type="button">
          Host
          <span class="mm-mode-label">Create a room</span>
        </button>
        <button class="mm-mode-btn" onclick="tlrMmJoin()" type="button">
          Join
          <span class="mm-mode-label">Enter a code</span>
        </button>
      </div>
      <div class="mm-cpu-row">
        <button class="mm-mode-btn mm-cpu-btn" onclick="tlrMmVsCpu()" type="button">
          vs CPU
          <span class="mm-mode-label">Solo practice</span>
        </button>
      </div>
    `);
  }

  function renderHostingPhase() {
    setHtml('mmContent', `
      <div class="mm-code-box">
        <div class="mm-code-label">Room Code</div>
        <div class="mm-code-value">${_roomCode ?? '…'}</div>
        <div class="mm-code-hint">Share this code with your opponent</div>
        <div class="mm-waiting">
          <span class="mm-spinner"></span>
          <span>Waiting for opponent to join…</span>
        </div>
      </div>
    `);
  }

  function renderJoinPhase() {
    setHtml('mmContent', `
      <div class="mm-join-form">
        <label class="mm-code-input-label" for="mmCodeInput">Enter room code</label>
        <input id="mmCodeInput" class="mm-code-input" type="text" maxlength="4"
          placeholder="ABCD" autocomplete="off" spellcheck="false"
          oninput="tlrMmCodeInput(this.value)"
        />
        <button id="mmConnectBtn" class="mm-connect-btn" onclick="tlrMmConnect()" disabled type="button">Connect</button>
      </div>
    `);
  }

  function renderConnectingPhase() {
    setHtml('mmContent', `
      <div class="mm-status mm-status-info">
        <div class="mm-waiting">
          <span class="mm-spinner"></span>
          <span>${_role === 'guest' ? 'Connecting to host…' : 'Setting up room…'}</span>
        </div>
      </div>
    `);
  }

  function renderReadyPhase() {
    const isHost = _role === 'host';
    const hasOpponentProfile = !!_opponentProfile;
    setHtml('mmContent', `
      <div class="mm-status mm-status-success">✓ Opponent connected!</div>
      <div class="mm-ready-section">
        ${isHost
          ? `<button class="mm-start-btn" onclick="tlrMmStartMatch()" type="button" ${hasOpponentProfile ? '' : 'disabled'}>${hasOpponentProfile ? 'Start Match' : 'Loading Opponent…'}</button>`
          : `<p class="mm-waiting-host">Waiting for the host to start…</p>`
        }
      </div>
    `);
  }

  function renderError(message) {
    setHtml('mmContent', `<div class="mm-status mm-status-error">${escHtml(message)}</div>`);
  }

  // --- Ably room connection ---

  async function createRoomPeer(role, roomCode) {
    _peer = new AblyRoomPeer({ role, roomCode, profile: _profile ?? {}, target });
    _roomCode = _peer.roomCode;
    _peer.onopen = () => {
      _peer.send({ type: 'mp-profile', profile: _profile ?? {} });
      if (_role === 'guest') renderReadyPhase();
    };
    _peer.onmessage = handlePeerMessage;
    _peer.onclose = () => {
      if (_matchState) target.tlrMpHandlePeerLeft?.();
      else renderError('Opponent disconnected.');
    };
    _peer.onerror = error => {
      console.warn('Ably multiplayer connection issue:', error);
      if (!_matchState) renderError('Could not connect to Ably. Check the Ably key and token function.');
    };
    await _peer.connect();
    return _peer;
  }

  function handlePeerMessage(msg) {
    if (!msg) return;

    if (msg.type === 'peer-left') {
      if (_matchState) target.tlrMpHandlePeerLeft?.();
      else renderError('Opponent disconnected.');
      return;
    }

    if (msg.type === 'mp-profile') {
      _opponentProfile = { ...(msg.profile ?? {}) };
      if (!_matchState) renderReadyPhase();
      return;
    }

    if (msg.type === 'mp-action') {
      applyPeerActionWhenReady(msg.action);
    }
  }

  function applyPeerAction(action) {
    const isMatchStart = action?.type === MP_ACTIONS.MP_INIT;
    const alreadyStarted = !!_matchState;

    _matchState = mpReducer(_matchState, action);

    if (isMatchStart && !alreadyStarted) {
      enterMatchView();
      target.tlrMpOnMatchStart?.(_matchState, { role: _role, peer: _peer });
    } else {
      target.tlrMpOnPeerAction?.(action, _matchState);
    }
    return _matchState;
  }

  function applyPeerActionWhenReady(action) {
    if (action?.type === MP_ACTIONS.MP_SCORE_ROUND && scoreVisualsPending()) return delayPeerScoreRound(action);
    if (action?.type === MP_ACTIONS.MP_NEW_ROUND && newRoundVisualsPending()) return delayPeerNewRound(action);
    return applyPeerAction(action);
  }

  // Dispatch a match action from this player: apply locally and send to peer.
  function dispatchMatchAction(action) {
    _matchState = mpReducer(_matchState, action);
    _peer?.send({ type: 'mp-action', action });
    target.tlrMpOnLocalAction?.(action, _matchState);
    return _matchState;
  }

  function spreadsAreFull(state) {
    return Array.isArray(state?.players)
      && state.players.length === 2
      && state.players.every(player => Array.isArray(player.spread) && player.spread.every(Boolean));
  }

  function visualEffectsPending() {
    const doc = target.document;
    const effectsUntil = Number(target.effectsUntil) || 0;
    if (effectsUntil > Date.now() + 40) return true;
    return !!doc.querySelector('body.mp-game-active #mpOppSpread .mp-reveal-pending, body.mp-game-active .ghost, body.mp-game-active .score-ghost, body.mp-game-active .meld-announce');
  }

  function scoreVisualsPending() {
    return !!(_matchState && _matchState.phase === MP_PHASES.SCORING && spreadsAreFull(_matchState) && visualEffectsPending());
  }

  function newRoundVisualsPending() {
    return !!(_matchState && _matchState.phase === MP_PHASES.BETWEEN_ROUNDS && visualEffectsPending());
  }

  function visualDelayMs() {
    const effectsUntil = Number(target.effectsUntil) || 0;
    return Math.max(120, Math.min(Math.max(0, effectsUntil - Date.now()), 500) || 160);
  }

  function delayScoreRound(action) {
    if (_scoreRoundRetryTimer) return _matchState;
    _scoreRoundRetryTimer = target.setTimeout(() => {
      _scoreRoundRetryTimer = null;
      if (_matchState?.phase === MP_PHASES.SCORING) target.tlrMpDispatch?.(action);
    }, visualDelayMs());
    return _matchState;
  }

  function delayPeerScoreRound(action) {
    if (_peerScoreRoundRetryTimer) return _matchState;
    _peerScoreRoundRetryTimer = target.setTimeout(() => {
      _peerScoreRoundRetryTimer = null;
      if (_matchState?.phase === MP_PHASES.SCORING) applyPeerActionWhenReady(action);
    }, visualDelayMs());
    return _matchState;
  }

  function delayNewRound(action) {
    if (_newRoundRetryTimer) return _matchState;
    _newRoundRetryTimer = target.setTimeout(() => {
      _newRoundRetryTimer = null;
      if (_matchState?.phase === MP_PHASES.BETWEEN_ROUNDS) target.tlrMpDispatch?.(action);
    }, visualDelayMs());
    return _matchState;
  }

  function delayPeerNewRound(action) {
    if (_peerNewRoundRetryTimer) return _matchState;
    _peerNewRoundRetryTimer = target.setTimeout(() => {
      _peerNewRoundRetryTimer = null;
      if (_matchState?.phase === MP_PHASES.BETWEEN_ROUNDS) applyPeerActionWhenReady(action);
    }, visualDelayMs());
    return _matchState;
  }

  function dispatchMatchActionWhenReady(action) {
    if (action?.type === MP_ACTIONS.MP_SCORE_ROUND && scoreVisualsPending()) return delayScoreRound(action);
    if (action?.type === MP_ACTIONS.MP_NEW_ROUND && newRoundVisualsPending()) return delayNewRound(action);
    return dispatchMatchAction(action);
  }

  // --- Match start ---

  function startMatch() {
    const seed = randomSeed();
    const p = _profile ?? {};
    const myPersona = p.personaId ?? null;
    const opponentPersona = _opponentProfile?.personaId ?? null;

    const personas = _role === 'host'
      ? [myPersona, opponentPersona]
      : [opponentPersona, myPersona];

    const initAction = {
      type: MP_ACTIONS.MP_INIT,
      seed,
      scoreTarget: p.scoreTarget ?? 200,
      personas,
    };

    enterMatchView();
    dispatchMatchAction(initAction);
    target.tlrMpOnMatchStart?.(_matchState, { role: _role, peer: _peer });
  }

  // --- Cleanup ---

  function teardown() {
    _cpuMode = false;
    _matchState = null;
    if (_scoreRoundRetryTimer) {
      target.clearTimeout(_scoreRoundRetryTimer);
      _scoreRoundRetryTimer = null;
    }
    if (_peerScoreRoundRetryTimer) {
      target.clearTimeout(_peerScoreRoundRetryTimer);
      _peerScoreRoundRetryTimer = null;
    }
    if (_newRoundRetryTimer) {
      target.clearTimeout(_newRoundRetryTimer);
      _newRoundRetryTimer = null;
    }
    if (_peerNewRoundRetryTimer) {
      target.clearTimeout(_peerNewRoundRetryTimer);
      _peerNewRoundRetryTimer = null;
    }
    _peer?.close(); _peer = null;
    _role = null; _roomCode = null; _opponentProfile = null;
  }

  // --- Public API ---

  target.tlrShowMatchmaking = function (profile) {
    _profile = { ...(profile ?? target.tlrGetMpProfile?.() ?? {}) };
    // Restore the player's last-chosen match length preference.
    try {
      const saved = Number(target.localStorage?.getItem('tlr_mm_target'));
      if (saved === 100 || saved === 200 || saved === 300) _profile.scoreTarget = saved;
    } catch (_) {}
    if (!_profile.scoreTarget) _profile.scoreTarget = 200;
    _matchState = null;
    teardown();
    renderIdlePhase();
    show('matchmakingScreen');
  };

  target.tlrMmSetTarget = function (value) {
    if (!_profile) _profile = {};
    _profile = { ..._profile, scoreTarget: Number(value) };
    try { target.localStorage?.setItem('tlr_mm_target', String(value)); } catch (_) {}
    renderIdlePhase();
  };

  target.tlrHideMatchmaking = function () {
    hide('matchmakingScreen');
    teardown();
  };

  target.tlrMmBack = function () {
    teardown();
    hide('matchmakingScreen');
    if (typeof target.tlrShowLoadout === 'function') target.tlrShowLoadout();
  };

  target.tlrMmHost = async function () {
    _role = 'host';
    _roomCode = AblyRoomPeer.createRoomCode();
    renderHostingPhase();
    try {
      await createRoomPeer('host', _roomCode);
      renderHostingPhase();
    } catch (e) {
      console.warn('Could not host Ably room:', e);
      renderError('Cannot create an Ably room. Make sure ABLY_API_KEY is set on Netlify.');
    }
  };

  target.tlrMmJoin = function () {
    _role = 'guest';
    renderJoinPhase();
  };

  target.tlrMmCodeInput = function (val) {
    const btn = el('mmConnectBtn');
    if (btn) btn.disabled = val.trim().length < 4;
  };

  target.tlrMmConnect = async function () {
    const input = el('mmCodeInput');
    const code = (input?.value ?? '').trim().toUpperCase();
    if (code.length < 4) return;
    _role = 'guest';
    renderConnectingPhase();
    try {
      await createRoomPeer('guest', code);
    } catch (e) {
      console.warn('Could not join Ably room:', e);
      renderError('Cannot connect to Ably. Make sure the room code is correct and ABLY_API_KEY is set.');
    }
  };

  target.tlrMmReset = function () {
    teardown();
    renderIdlePhase();
  };

  target.tlrMmStartMatch = function () {
    if (_role !== 'host') return;
    if (!_peer?.connected) return;
    if (!_opponentProfile) return;
    startMatch();
  };

  // Expose for the game layer to dispatch actions over the Ably room channel.
  target.tlrMpDispatch = function (action) {
    if (!_matchState) return null;
    return dispatchMatchActionWhenReady(action);
  };

  target.tlrMpGetState = function () { return _matchState; };
  target.tlrMpGetRole = function () { return _role; };
  target.tlrMpGetPeer = function () { return _peer; };

  // ── CPU opponent ─────────────────────────────────────────────────────────

  function chooseCpuAction(state, pi) {
    const action = chooseCpuMonteCarloAction(state, pi);
    if (action) return action;

    const p = state.players[pi];
    const hand = p?.hand ?? [];
    if ((p?.discards ?? 0) > 0 && hand.length > 0) {
      const lowest = [...hand].sort((a, b) => a.points - b.points)[0];
      return { type: MP_ACTIONS.MP_DISCARD_CARD, cardUid: lowest.uid };
    }
    if (hand.length >= 3) {
      const sorted = [...hand].sort((a, b) => a.points - b.points);
      return { type: MP_ACTIONS.MP_PURGE_CARDS, cardUids: sorted.slice(0, 3).map(c => c.uid) };
    }
    return { type: MP_ACTIONS.MP_DISCARD_CARD, cardUid: hand[0]?.uid };
  }

  function chooseCpuMonteCarloAction(state, pi) {
    const candidates = cpuCandidateActions(state, pi);
    if (!candidates.length) return null;

    let best = null;
    let bestValue = -Infinity;
    for (const candidate of candidates) {
      let total = 0;
      for (let i = 0; i < CPU_MONTE_CARLO_ROLLOUTS; i += 1) total += monteCarloActionValue(state, pi, candidate);
      const average = total / CPU_MONTE_CARLO_ROLLOUTS;
      const abilityBias = candidate.type === MP_ACTIONS.MP_INVOKE_ABILITY ? 0.75 : 0;
      const pointTie = (candidate.card?.points || 0) * 0.01;
      const slotTie = Number.isFinite(candidate.slotIndex) ? -candidate.slotIndex * 0.001 : 0;
      const value = average + abilityBias + pointTie + slotTie;
      if (value > bestValue) {
        bestValue = value;
        best = candidate;
      }
    }
    return best ? stripCpuCandidate(best) : null;
  }

  function cpuCandidateActions(state, pi) {
    const p = state.players[pi];
    const hand = p?.hand ?? [];
    const slots = emptySlots(state, pi);
    const placementCandidates = [];
    const abilityCandidates = [];

    for (const card of hand) {
      if (card.type !== 'interaction') {
        for (const slotIndex of slots) placementCandidates.push({ type: MP_ACTIONS.MP_PLACE_CARD, cardUid: card.uid, slotIndex, card });
      }
      if ((p?.discards ?? 0) > 0 && (card.abilityType || card.ability)) {
        abilityCandidates.push(...cpuAbilityActionsFor(state, pi, card));
      }
    }

    placementCandidates.sort((a, b) => (b.card.points || 0) - (a.card.points || 0));
    return [...abilityCandidates, ...placementCandidates.slice(0, CPU_MAX_MONTE_CARLO_CANDIDATES)];
  }

  function cpuAbilityActionsFor(state, pi, card) {
    const opp = pi === 0 ? 1 : 0;
    const opponent = state.players[opp];

    if (card.abilityType === MP_ABILITY_TYPES.MP_BANISH) {
      return opponent?.spread?.some(Boolean)
        ? [{ type: MP_ACTIONS.MP_INVOKE_ABILITY, cardUid: card.uid, card }]
        : [];
    }

    if (card.abilityType === MP_ABILITY_TYPES.MP_SEAL) {
      return (opponent?.spread || [])
        .map((targetCard, slotIndex) => ({ targetCard, slotIndex }))
        .filter(item => item.targetCard && opponent.anchoredSlotIndex !== item.slotIndex)
        .map(item => ({
          type: MP_ACTIONS.MP_INVOKE_ABILITY,
          cardUid: card.uid,
          target: { playerIndex: opp, slotIndex: item.slotIndex },
          card,
        }));
    }

    const ability = card.ability ? getAbility(card.ability) : null;
    const abilityChoice = cpuStandardAbilityChoice(state.players[pi], ability);
    if (!ability || abilityChoice === null) return [];
    return [{ type: MP_ACTIONS.MP_INVOKE_ABILITY, cardUid: card.uid, abilityChoice, card }];
  }

  function cpuStandardAbilityChoice(player, ability) {
    if (!ability) return null;

    if (ability.type === ABILITY_TYPES.DRAW) return {};

    if (ability.type === ABILITY_TYPES.PEEK) {
      const held = (player.deck || []).slice(0, ability.count ?? 1);
      const best = bestCardForCpu(held);
      return best ? { takenCardUid: best.uid } : { fallbackDraw: 1 };
    }

    if (ability.type === ABILITY_TYPES.SEARCH) {
      const best = bestCardForCpu(player.deck || []);
      return best ? { takenCardUid: best.uid } : { fallbackDraw: 1 };
    }

    // Relationship abilities need anchor selection UI. For CPU, convert them into
    // the reducer's deterministic fallback draw so the card still functions.
    return { fallbackDraw: 1 };
  }

  function bestCardForCpu(cards) {
    return [...(cards || [])]
      .filter(Boolean)
      .sort((a, b) => (b.points || 0) - (a.points || 0))[0] || null;
  }

  function stripCpuCandidate(candidate) {
    const { card, ...action } = candidate;
    return action;
  }

  function monteCarloActionValue(state, pi, candidate) {
    const action = { ...stripCpuCandidate(candidate), playerIndex: pi };
    const next = applyImmediateAction(state, action);
    if (!next || next.error) return -Infinity;

    const players = next.players.map(player => cloneMonteCarloPlayer(player));
    const opp = pi === 0 ? 1 : 0;
    randomFillSpread(players[pi]);
    randomFillSpread(players[opp]);
    const cpuScore = scoreMonteCarloSpread(players[pi]) + (players[pi].totalScore || 0);
    const oppScore = scoreMonteCarloSpread(players[opp]) + (players[opp].totalScore || 0);
    return cpuScore - oppScore;
  }

  function cloneMonteCarloPlayer(player) {
    return {
      ...player,
      hand: [...(player.hand || [])],
      spread: [...(player.spread || [])],
      discard: [...(player.discard || [])],
      silencedCardUids: [...(player.silencedCardUids || [])],
    };
  }

  function randomFillSpread(player) {
    const placeable = player.hand.filter(card => card.type !== 'interaction');
    for (let i = 0; i < player.spread.length && placeable.length; i += 1) {
      if (player.spread[i]) continue;
      const pickIndex = Math.floor(Math.random() * placeable.length);
      const [card] = placeable.splice(pickIndex, 1);
      player.spread[i] = card;
    }
  }

  function scoreMonteCarloSpread(player) {
    const silenced = new Set(player.silencedCardUids || []);
    const cards = (player.spread || []).filter(card => card && !silenced.has(card.uid));
    if (!cards.length) return 0;
    return computeScore(cards, { skipFlatBonuses: true, skipRelics: true }).finalScore || 0;
  }

  function scheduleCpuMove(delayMs) {
    if (!_cpuMode || !_matchState) return;
    target.setTimeout(() => {
      if (!_cpuMode || !_matchState) return;
      const cpuIndex = _role === 'host' ? 1 : 0;
      if (!hasSubmittedAction(_matchState, cpuIndex) && _matchState.phase === MP_PHASES.PLACEMENT) {
        const action = chooseCpuAction(_matchState, cpuIndex);
        dispatchMatchAction({ type: MP_ACTIONS.MP_SUBMIT_ACTION, playerIndex: cpuIndex, action });
      }
    }, delayMs);
  }

  target.tlrMmVsCpu = function () {
    _cpuMode = true;
    _role = 'host';
    _peer = null;
    _opponentProfile = { personaId: 'rival' };
    startMatch();
  };

  // Patch local dispatch to trigger CPU response after the human acts.
  const originalDispatch = target.tlrMpDispatch;
  target.tlrMpDispatch = function (action) {
    const result = originalDispatch(action);
    if (_cpuMode && action?.type === MP_ACTIONS.MP_SUBMIT_ACTION) scheduleCpuMove(650);
    return result;
  };

  function enterMatchView() {
    hide('matchmakingScreen');
    if (typeof target.tlrShowMpGame === 'function') target.tlrShowMpGame(_matchState, { role: _role, peer: _peer });
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function personaName(id) {
  if (!id) return 'No Persona';
  return id.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function escHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}
