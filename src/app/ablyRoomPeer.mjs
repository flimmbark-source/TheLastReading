// Ably-backed multiplayer room transport.
//
// This is intentionally shaped like the old PeerConnection wrapper from the
// matchmaking layer: callers assign onopen/onmessage/onclose, call send(), and
// read .connected. Unlike the old path, messages travel directly over Ably
// channels instead of requiring a Render/WebSocket signaling server plus WebRTC.

const ABLY_SDK_SRC = 'https://cdn.ably.com/lib/ably.min-2.js';
const ROOM_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const MESSAGE_EVENT = 'game';

let ablyLoadPromise = null;

export class AblyRoomPeer {
  constructor({ role, roomCode, profile, target = window } = {}) {
    this.role = role === 'guest' ? 'guest' : 'host';
    this.roomCode = normalizeRoomCode(roomCode || AblyRoomPeer.createRoomCode());
    this.profile = { ...(profile || {}) };
    this.target = target;
    this.clientId = createClientId(this.role);

    this.onopen = null;
    this.onmessage = null;
    this.onclose = null;
    this.onerror = null;

    this._client = null;
    this._channel = null;
    this._connected = false;
    this._closed = false;
    this._lastPeerId = null;
    this._announcedPeerProfile = false;
  }

  static createRoomCode() {
    return Array.from({ length: 4 }, () => ROOM_CHARS[Math.floor(Math.random() * ROOM_CHARS.length)]).join('');
  }

  get connected() {
    return this._connected;
  }

  async connect() {
    if (this._closed) throw new Error('Room peer is closed.');
    const Ably = await loadAblySdk(this.target);
    this._client = new Ably.Realtime({
      clientId: this.clientId,
      authCallback: (_tokenParams, callback) => {
        this._requestToken().then(tokenRequest => callback(null, tokenRequest)).catch(error => callback(error, null));
      },
    });

    this._client.connection.on('failed', state => this._fail(state?.reason || new Error('Ably connection failed.')));
    this._client.connection.on('closed', () => this._closeFromRemote());
    this._client.connection.on('suspended', state => this._fail(state?.reason || new Error('Ably connection suspended.')));

    await once(this._client.connection, 'connected');

    this._channel = this._client.channels.get(channelName(this.roomCode));
    await this._channel.subscribe(MESSAGE_EVENT, message => this._handleMessage(message));
    await this._channel.presence.subscribe(() => this._syncPresence());
    await this._channel.attach();
    await this._channel.presence.enter({ role: this.role, profile: this.profile });
    await this._syncPresence();
    return this;
  }

  async send(payload) {
    if (!this._channel || this._closed) return;
    await this._channel.publish(MESSAGE_EVENT, {
      v: 1,
      roomCode: this.roomCode,
      from: this.clientId,
      role: this.role,
      payload,
      sentAt: Date.now(),
    });
  }

  async close() {
    this._closed = true;
    const channel = this._channel;
    this._channel = null;
    try { await channel?.publish(MESSAGE_EVENT, { v: 1, roomCode: this.roomCode, from: this.clientId, role: this.role, payload: { type: 'peer-left' }, sentAt: Date.now() }); } catch (_) {}
    try { await channel?.presence.leave(); } catch (_) {}
    try { await channel?.detach(); } catch (_) {}
    try { this._client?.close(); } catch (_) {}
    this._client = null;
    this._connected = false;
  }

  async _requestToken() {
    const response = await this.target.fetch('/.netlify/functions/ably-token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId: this.clientId, roomCode: this.roomCode }),
    });
    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(text || `Ably token request failed (${response.status})`);
    }
    return response.json();
  }

  _handleMessage(message) {
    const data = message?.data;
    if (!data || data.from === this.clientId) return;
    if (data.roomCode && normalizeRoomCode(data.roomCode) !== this.roomCode) return;
    this.onmessage?.(data.payload ?? data);
  }

  async _syncPresence() {
    if (!this._channel || this._closed) return;
    let members = [];
    try { members = await this._channel.presence.get(); } catch (error) { this._fail(error); return; }

    const peers = members.filter(member => member.clientId !== this.clientId);
    const opposite = peers.find(member => member.data?.role && member.data.role !== this.role) || peers[0] || null;

    if (!opposite) {
      if (this._connected) this._closeFromRemote();
      return;
    }

    const previousPeerId = this._lastPeerId;
    this._lastPeerId = opposite.clientId;
    if (!this._connected) {
      this._connected = true;
      this.onopen?.();
    }

    if (!this._announcedPeerProfile || previousPeerId !== opposite.clientId) {
      this._announcedPeerProfile = true;
      this.onmessage?.({ type: 'mp-profile', profile: { ...(opposite.data?.profile || {}) } });
    }
  }

  _closeFromRemote() {
    if (this._closed) return;
    const wasConnected = this._connected;
    this._connected = false;
    if (wasConnected) this.onclose?.();
  }

  _fail(error) {
    if (this._closed) return;
    this.onerror?.(error instanceof Error ? error : new Error(String(error || 'Ably connection error.')));
  }
}

function channelName(roomCode) {
  return `tlr:room:${normalizeRoomCode(roomCode)}`;
}

function normalizeRoomCode(value) {
  return String(value || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
}

function createClientId(role) {
  const random = Math.random().toString(36).slice(2, 10);
  return `tlr-${role}-${Date.now().toString(36)}-${random}`;
}

function loadAblySdk(target) {
  if (target.Ably?.Realtime) return Promise.resolve(target.Ably);
  if (ablyLoadPromise) return ablyLoadPromise;

  ablyLoadPromise = new Promise((resolve, reject) => {
    const doc = target.document;
    if (!doc) { reject(new Error('Document unavailable.')); return; }

    const existing = doc.querySelector(`script[src="${ABLY_SDK_SRC}"]`);
    if (existing) {
      existing.addEventListener('load', () => resolve(target.Ably), { once: true });
      existing.addEventListener('error', () => reject(new Error('Ably SDK failed to load.')), { once: true });
      return;
    }

    const script = doc.createElement('script');
    script.src = ABLY_SDK_SRC;
    script.async = true;
    script.onload = () => target.Ably?.Realtime ? resolve(target.Ably) : reject(new Error('Ably SDK loaded without Realtime.'));
    script.onerror = () => reject(new Error('Ably SDK failed to load.'));
    doc.head.appendChild(script);
  });

  return ablyLoadPromise;
}

function once(emitter, eventName) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(`Timed out waiting for Ably ${eventName}.`)), 12000);
    emitter.once(eventName, state => {
      clearTimeout(timeout);
      if (state?.reason) reject(state.reason);
      else resolve(state);
    });
  });
}
