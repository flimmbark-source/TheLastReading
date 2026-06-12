// WebSocket client for the signaling server.
// Connects to /signal on the same host as the page (works in both dev and
// a same-origin production deployment).

export class SignalingClient {
  constructor({ onMessage, onClose } = {}) {
    this._ws = null;
    this._onMessage = onMessage ?? (() => {});
    this._onClose = onClose ?? (() => {});
    this._queue = []; // messages buffered before open
  }

  // Connect to the signaling server. Returns a Promise that resolves when open.
  connect(url) {
    return new Promise((resolve, reject) => {
      this._ws = new WebSocket(url);

      this._ws.addEventListener('open', () => {
        for (const msg of this._queue) this._ws.send(JSON.stringify(msg));
        this._queue = [];
        resolve();
      }, { once: true });

      this._ws.addEventListener('error', () => reject(new Error('Signaling connection failed')), { once: true });

      this._ws.addEventListener('message', ev => {
        try { this._onMessage(JSON.parse(ev.data)); } catch (_) {}
      });

      this._ws.addEventListener('close', () => this._onClose());
    });
  }

  send(obj) {
    if (this._ws?.readyState === WebSocket.OPEN) {
      this._ws.send(JSON.stringify(obj));
    } else {
      this._queue.push(obj);
    }
  }

  close() {
    this._ws?.close();
    this._ws = null;
  }

  // Derive the signaling URL from the current page origin.
  // Override window.TLR_SIGNAL_URL for non-same-origin deployments.
  static defaultUrl() {
    if (typeof window !== 'undefined' && window.TLR_SIGNAL_URL) return window.TLR_SIGNAL_URL;
    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${proto}//${location.host}/signal`;
  }
}
