import { SignalingClient } from './signalingClient.mjs';
import { PeerConnection } from './peerConnection.mjs';
import { randomSeed } from '../multiplayer/mpRng.mjs';
import { MP_ACTIONS } from '../multiplayer/mpActions.mjs';
import { mpReducer } from '../multiplayer/mpReducer.mjs';

// ---------------------------------------------------------------------------
// Internal state
// ---------------------------------------------------------------------------

let _signaling = null;
let _peer = null;
let _role = null;       // 'host' | 'guest'
let _roomCode = null;
let _matchState = null; // live mpState once match starts
let _profile = null;    // { personaId, scoreTarget }

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
    const persona = p.personaId ?? '—';
    const targetLabel = { 100: 'Quick · 100', 200: 'Standard · 200', 300: 'Long · 300' }[p.scoreTarget] ?? `${p.scoreTarget ?? '—'} pts`;
    setHtml('mmContent', `
      <div class="mm-profile">
        <div>
          <div class="mm-profile-persona">${persona ? personaName(persona) : '—'}</div>
          <div class="mm-profile-detail">${targetLabel}</div>
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
    setHtml('mmContent', `
      <div class="mm-status mm-status-success">✓ Opponent connected!</div>
      <div class="mm-ready-section">
        ${isHost
          ? `<button class="mm-start-btn" onclick="tlrMmStartMatch()" type="button">Start Match</button>`
          : `<p class="mm-waiting-host">Waiting for the host to start…</p>`
        }
      </div>
    `);
  }

  function renderError(msg) {
    setHtml('mmContent', `
      <div class="mm-status mm-status-error">${escHtml(msg)}</div>
      <div style="text-align:center;margin-top:16px">
        <button class="mm-mode-btn" onclick="tlrMmReset()" type="button" style="max-width:160px">Try again</button>
      </div>
    `);
  }

  // --- Signaling + WebRTC flow ---

  async function connectSignaling() {
    _signaling = new SignalingClient({
      onMessage: handleSignalMessage,
      onClose: () => handleSignalClose(),
    });
    await _signaling.connect(SignalingClient.defaultUrl());
  }

  function handleSignalMessage(msg) {
    switch (msg.type) {

      case 'room-created':
        _roomCode = msg.roomCode;
        renderHostingPhase();
        break;

      case 'guest-ready':
        // Guest joined; host creates offer
        renderConnectingPhase();
        hostCreateOffer();
        break;

      case 'room-joined':
        // Guest successfully joined; wait for offer
        renderConnectingPhase();
        break;

      case 'offer':
        guestHandleOffer(msg.sdp);
        break;

      case 'answer':
        hostHandleAnswer(msg.sdp);
        break;

      case 'ice':
        _peer?.addIceCandidate(msg.candidate);
        break;

      case 'room-not-found':
        renderError('Room not found. Check the code and try again.');
        teardown();
        break;

      case 'room-full':
        renderError('That room is already full.');
        teardown();
        break;

      case 'peer-left':
        handlePeerLeft();
        break;
    }
  }

  function handleSignalClose() {
    // Signaling socket closed — only matters pre-connection.
    // Once DataChannel is open we no longer need signaling.
    if (_peer?.connected) return;
    renderError('Lost connection to signaling server.');
    teardown();
  }

  function handlePeerLeft() {
    if (_peer?.connected) {
      // Mid-match disconnect handled separately
      target.tlrMpHandlePeerLeft?.();
    } else {
      renderError('Opponent disconnected before the match could start.');
      teardown();
    }
  }

  function createPeer() {
    _peer = new PeerConnection({
      onConnected: () => {
        // DataChannel open — signaling no longer needed
        _signaling?.close();
        _signaling = null;
        renderReadyPhase();
      },
      onDisconnected: () => {
        target.tlrMpHandlePeerLeft?.();
      },
      onMessage: handleDataMessage,
    });
    _peer.onIceCandidate = candidate => {
      _signaling?.send({ type: 'ice', candidate });
    };
  }

  async function hostCreateOffer() {
    createPeer();
    try {
      const sdp = await _peer.createOffer();
      _signaling?.send({ type: 'offer', sdp });
    } catch (e) {
      renderError('Failed to create offer: ' + e.message);
      teardown();
    }
  }

  async function guestHandleOffer(sdp) {
    createPeer();
    try {
      const answerSdp = await _peer.receiveOffer(sdp);
      _signaling?.send({ type: 'answer', sdp: answerSdp });
    } catch (e) {
      renderError('Failed to process offer: ' + e.message);
      teardown();
    }
  }

  async function hostHandleAnswer(sdp) {
    try {
      await _peer?.receiveAnswer(sdp);
    } catch (e) {
      renderError('Failed to process answer: ' + e.message);
      teardown();
    }
  }

  // --- DataChannel messages (in-match) ---

  function handleDataMessage(msg) {
    if (msg.type === 'mp-action') {
      // Apply action from peer to local match state
      _matchState = mpReducer(_matchState, msg.action);
      target.tlrMpOnPeerAction?.(msg.action, _matchState);
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
    const opponentPersona = null; // future: exchange via DataChannel pre-start

    const personas = _role === 'host'
      ? [myPersona, opponentPersona]
      : [opponentPersona, myPersona];

    const initAction = {
      type: MP_ACTIONS.MP_INIT,
      seed,
      scoreTarget: p.scoreTarget ?? 200,
      personas,
    };

    dispatchMatchAction(initAction);
    target.tlrMpOnMatchStart?.(_matchState, { role: _role, peer: _peer });
  }

  // --- Cleanup ---

  function teardown() {
    _signaling?.close(); _signaling = null;
    _peer?.close(); _peer = null;
    _role = null; _roomCode = null;
  }

  // --- Public API ---

  target.tlrShowMatchmaking = function (profile) {
    _profile = profile ?? target.tlrGetMpProfile?.() ?? {};
    _matchState = null;
    teardown();
    renderIdlePhase();
    show('matchmakingScreen');
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
}

// --- Utility ---

function escHtml(str) {
  return String(str).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function personaName(id) {
  const names = { cleaner: 'The Cleaner', hoarder: 'The Hoarder', anchor: 'The Anchor', gambit: 'The Gambit', surgeon: 'The Surgeon' };
  return names[id] ?? id;
}
