import { SignalingClient } from './signalingClient.mjs';
import { PeerConnection } from './peerConnection.mjs';
import { randomSeed } from '../multiplayer/mpRng.mjs';
import { MP_ACTIONS } from '../multiplayer/mpActions.mjs';
import { mpReducer } from '../multiplayer/mpReducerFixed.mjs';
import { MP_PHASES } from '../multiplayer/mpState.mjs';
import { hasSubmittedAction, emptySlots } from '../multiplayer/mpSelectors.mjs';

// ---------------------------------------------------------------------------
// Internal state
// ---------------------------------------------------------------------------

let _signaling = null;
let _peer = null;
let _role = null;       // 'host' | 'guest'
let _roomCode = null;
let _matchState = null; // live mpState once match starts
let _profile = null;    // { personaId, scoreTarget }
let _opponentProfile = null; // { personaId }
let _cpuMode = false;

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
          <span>${_role === 'guest' ? 'Connecting to host…' : 'Setting up connection…'}</span>
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

  // --- Signaling / peer connection ---

  async function connectSignaling() {
    if (_signaling) return _signaling;
    _signaling = new SignalingClient();
    _signaling.onmessage = handleSignal;
    await _signaling.connect();
    return _signaling;
  }

  async function createPeer(initiator) {
    _peer = new PeerConnection({ initiator });
    _peer.onopen = () => {
      _peer.send({ type: 'mp-profile', profile: _profile ?? {} });
      if (_role === 'guest') renderReadyPhase();
    };
    _peer.onmessage = handlePeerMessage;
    _peer.onicecandidate = candidate => {
      if (_signaling) _signaling.send({ type: 'signal', roomCode: _roomCode, data: { candidate } });
    };
    return _peer;
  }

  async function handleSignal(msg) {
    if (!msg) return;

    if (msg.type === 'hosted') {
      _roomCode = msg.roomCode;
      await createPeer(true);
      renderHostingPhase();
      return;
    }

    if (msg.type === 'joined') {
      _roomCode = msg.roomCode;
      await createPeer(false);
      if (msg.offer) await _peer.acceptOffer(msg.offer);
      return;
    }

    if (msg.type === 'peer-joined') {
      if (!_peer) await createPeer(true);
      const offer = await _peer.createOffer();
      _signaling.send({ type: 'signal', roomCode: _roomCode, data: { offer } });
      return;
    }

    if (msg.type === 'signal') {
      if (!_peer) return;
      const data = msg.data ?? {};
      if (data.offer) {
        await _peer.acceptOffer(data.offer);
        const answer = await _peer.createAnswer();
        _signaling.send({ type: 'signal', roomCode: _roomCode, data: { answer } });
      }
      if (data.answer) await _peer.acceptAnswer(data.answer);
      if (data.candidate) await _peer.addIceCandidate(data.candidate);
    }
  }

  function handlePeerMessage(msg) {
    if (!msg) return;

    if (msg.type === 'mp-profile') {
      _opponentProfile = { ...(msg.profile ?? {}) };
      if (!_matchState) renderReadyPhase();
      return;
    }

    if (msg.type === 'mp-action') {
      const isMatchStart = msg.action?.type === MP_ACTIONS.MP_INIT;
      const alreadyStarted = !!_matchState;

      // Apply action from peer to local match state
      _matchState = mpReducer(_matchState, msg.action);

      if (isMatchStart && !alreadyStarted) {
        enterMatchView();
        target.tlrMpOnMatchStart?.(_matchState, { role: _role, peer: _peer });
      } else {
        target.tlrMpOnPeerAction?.(msg.action, _matchState);
      }
    }
  }

  // Dispatch a match action from this player: apply locally and send to peer.
  function dispatchMatchAction(action) {
    _matchState = mpReducer(_matchState, action);
    _peer?.send({ type: 'mp-action', action });
    target.tlrMpOnLocalAction?.(action, _matchState);
    return _matchState;
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
    _signaling?.close(); _signaling = null;
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
    renderHostingPhase(); // show "waiting" immediately
    try {
      await connectSignaling();
      _signaling.send({ type: 'host' });
    } catch (e) {
      renderError('Cannot reach signaling server. Is the dev server running?');
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
    renderConnectingPhase();
    try {
      await connectSignaling();
      _signaling.send({ type: 'join', roomCode: code });
    } catch (e) {
      renderError('Cannot reach signaling server. Is the dev server running?');
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

  // Expose for the game layer to dispatch actions over the DataChannel
  target.tlrMpDispatch = function (action) {
    if (!_matchState) return null;
    return dispatchMatchAction(action);
  };

  target.tlrMpGetState = function () { return _matchState; };
  target.tlrMpGetRole = function () { return _role; };
  target.tlrMpGetPeer = function () { return _peer; };

  // ── CPU opponent ─────────────────────────────────────────────────────────

  function chooseCpuAction(state, pi) {
    const p = state.players[pi];
    const hand = p?.hand ?? [];
    const slots = emptySlots(state, pi);
    const regular = hand.filter(c => c.type !== 'interaction').sort((a, b) => b.points - a.points);
    const interaction = hand.filter(c => c.type === 'interaction');

    if (slots.length > 0 && regular.length > 0) {
      return { type: MP_ACTIONS.MP_PLACE_CARD, cardUid: regular[0].uid, slotIndex: slots[0] };
    }
    if (interaction.length > 0 && (p?.discards ?? 0) > 0) {
      return { type: MP_ACTIONS.MP_DISCARD_CARD, cardUid: interaction[0].uid };
    }
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
