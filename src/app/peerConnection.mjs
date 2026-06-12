// WebRTC DataChannel wrapper. Handles offer/answer/ICE via the provided
// signaling transport (SignalingClient). The game layer calls send() / onmessage.

const ICE_CONFIG = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

const CHANNEL_LABEL = 'tlr-mp';

export class PeerConnection {
  constructor({ onMessage, onConnected, onDisconnected } = {}) {
    this._pc = null;
    this._channel = null;
    this._onMessage = onMessage ?? (() => {});
    this._onConnected = onConnected ?? (() => {});
    this._onDisconnected = onDisconnected ?? (() => {});
    this._iceCandidateBuffer = []; // candidates buffered before remote desc is set
    this._remoteDescSet = false;
  }

  // --- Host side ---

  async createOffer() {
    this._pc = new RTCPeerConnection(ICE_CONFIG);
    this._channel = this._pc.createDataChannel(CHANNEL_LABEL, { ordered: true });
    this._setupChannel(this._channel);
    this._setupPeerListeners();

    const offer = await this._pc.createOffer();
    await this._pc.setLocalDescription(offer);
    // Gather all ICE candidates (wait for gathering to complete)
    await this._waitIceGathering();
    return this._pc.localDescription.sdp;
  }

  async receiveAnswer(sdp) {
    await this._pc.setRemoteDescription({ type: 'answer', sdp });
    this._remoteDescSet = true;
    await this._flushIceCandidates();
  }

  // --- Guest side ---

  async receiveOffer(sdp) {
    this._pc = new RTCPeerConnection(ICE_CONFIG);
    this._setupPeerListeners();

    this._pc.addEventListener('datachannel', ev => {
      this._channel = ev.channel;
      this._setupChannel(this._channel);
    });

    await this._pc.setRemoteDescription({ type: 'offer', sdp });
    this._remoteDescSet = true;
    await this._flushIceCandidates();

    const answer = await this._pc.createAnswer();
    await this._pc.setLocalDescription(answer);
    await this._waitIceGathering();
    return this._pc.localDescription.sdp;
  }

  // --- Both sides ---

  async addIceCandidate(candidateInit) {
    if (!candidateInit) return;
    if (this._remoteDescSet && this._pc) {
      try { await this._pc.addIceCandidate(candidateInit); } catch (_) {}
    } else {
      this._iceCandidateBuffer.push(candidateInit);
    }
  }

  send(obj) {
    if (this._channel?.readyState === 'open') {
      this._channel.send(JSON.stringify(obj));
    }
  }

  close() {
    this._channel?.close();
    this._pc?.close();
    this._pc = null;
    this._channel = null;
  }

  get connected() {
    return this._channel?.readyState === 'open';
  }

  // --- Private ---

  _setupPeerListeners() {
    this._pc.addEventListener('icecandidate', ev => {
      if (ev.candidate) {
        // Caller should forward this to the peer via signaling
        this._onIceCandidate?.(ev.candidate.toJSON());
      }
    });

    this._pc.addEventListener('connectionstatechange', () => {
      const s = this._pc?.connectionState;
      if (s === 'connected') this._onConnected();
      if (s === 'disconnected' || s === 'failed' || s === 'closed') this._onDisconnected();
    });
  }

  _setupChannel(ch) {
    ch.addEventListener('open', () => this._onConnected());
    ch.addEventListener('close', () => this._onDisconnected());
    ch.addEventListener('message', ev => {
      try { this._onMessage(JSON.parse(ev.data)); } catch (_) {}
    });
  }

  _waitIceGathering() {
    if (this._pc.iceGatheringState === 'complete') return Promise.resolve();
    return new Promise(resolve => {
      const handler = () => {
        if (this._pc?.iceGatheringState === 'complete') {
          this._pc.removeEventListener('icegatheringstatechange', handler);
          resolve();
        }
      };
      this._pc.addEventListener('icegatheringstatechange', handler);
      // Safety timeout — proceed even if gathering stalls
      setTimeout(resolve, 8000);
    });
  }

  async _flushIceCandidates() {
    for (const c of this._iceCandidateBuffer) {
      try { await this._pc.addIceCandidate(c); } catch (_) {}
    }
    this._iceCandidateBuffer = [];
  }

  // Register a handler for outbound ICE candidates (must be set before createOffer/receiveOffer)
  set onIceCandidate(fn) { this._onIceCandidate = fn; }
}
