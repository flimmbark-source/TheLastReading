import http from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const port = Number(process.env.PORT || process.argv[2] || 8080);

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
};

function safePath(urlPath) {
  const decoded = decodeURIComponent(urlPath.split('?')[0] || '/');
  const clean = normalize(decoded).replace(/^([/\\])+/, '');
  const fullPath = resolve(join(root, clean || 'index.html'));
  return fullPath.startsWith(root) ? fullPath : null;
}

// ---------------------------------------------------------------------------
// Minimal WebSocket server (pure Node.js, no external packages)
// Handles text frames only — sufficient for JSON signaling payloads.
// ---------------------------------------------------------------------------

const WS_MAGIC = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';

function wsHandshake(req, socket) {
  const key = req.headers['sec-websocket-key'];
  if (!key) { socket.destroy(); return false; }
  const accept = createHash('sha1').update(key + WS_MAGIC).digest('base64');
  socket.write(
    'HTTP/1.1 101 Switching Protocols\r\n' +
    'Upgrade: websocket\r\n' +
    'Connection: Upgrade\r\n' +
    `Sec-WebSocket-Accept: ${accept}\r\n\r\n`
  );
  return true;
}

function wsSend(socket, text) {
  if (socket.destroyed) return;
  const payload = Buffer.from(text, 'utf8');
  const len = payload.length;
  let header;
  if (len < 126) {
    header = Buffer.from([0x81, len]);
  } else if (len < 65536) {
    header = Buffer.alloc(4);
    header[0] = 0x81; header[1] = 126;
    header.writeUInt16BE(len, 2);
  } else {
    header = Buffer.alloc(10);
    header[0] = 0x81; header[1] = 127;
    header.writeBigUInt64BE(BigInt(len), 2);
  }
  socket.write(Buffer.concat([header, payload]));
}

function wsPong(socket, payload) {
  if (socket.destroyed) return;
  const header = payload.length < 126
    ? Buffer.from([0x8A, payload.length])
    : Buffer.from([0x8A, 126, (payload.length >> 8) & 0xFF, payload.length & 0xFF]);
  socket.write(Buffer.concat([header, payload]));
}

function wsClose(socket) {
  if (!socket.destroyed) socket.write(Buffer.from([0x88, 0x00]));
}

// Parse one or more WebSocket frames from a buffer.
// Returns { frames: [{opcode, text?, payload?}], remaining: Buffer }
function wsParseFrames(buf) {
  const frames = [];
  let offset = 0;
  while (offset + 2 <= buf.length) {
    const b0 = buf[offset], b1 = buf[offset + 1];
    const opcode = b0 & 0x0f;
    const masked = (b1 & 0x80) !== 0;
    let plen = b1 & 0x7f;
    let hlen = 2;

    if (plen === 126) {
      if (offset + 4 > buf.length) break;
      plen = buf.readUInt16BE(offset + 2);
      hlen = 4;
    } else if (plen === 127) {
      if (offset + 10 > buf.length) break;
      plen = Number(buf.readBigUInt64BE(offset + 2));
      hlen = 10;
    }

    const maskOffset = offset + hlen;
    const dataOffset = maskOffset + (masked ? 4 : 0);
    if (dataOffset + plen > buf.length) break;

    const raw = buf.slice(dataOffset, dataOffset + plen);
    let payload;
    if (masked) {
      const mask = buf.slice(maskOffset, maskOffset + 4);
      payload = Buffer.alloc(plen);
      for (let i = 0; i < plen; i++) payload[i] = raw[i] ^ mask[i % 4];
    } else {
      payload = raw;
    }

    if (opcode === 1) frames.push({ opcode, text: payload.toString('utf8') });
    else if (opcode === 8) frames.push({ opcode });   // close
    else if (opcode === 9) frames.push({ opcode, payload }); // ping

    offset = dataOffset + plen;
  }
  return { frames, remaining: buf.slice(offset) };
}

// ---------------------------------------------------------------------------
// Signaling state
// Room format: { host: socket, guest: socket | null }
// ---------------------------------------------------------------------------

const rooms = new Map(); // roomCode → { host, guest }
const socketToRoom = new Map(); // socket → { roomCode, role }

function genRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // no I/O to avoid confusion
  let code;
  do {
    code = Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  } while (rooms.has(code));
  return code;
}

function sendJson(socket, obj) {
  wsSend(socket, JSON.stringify(obj));
}

function relay(from, obj) {
  const info = socketToRoom.get(from);
  if (!info) return;
  const room = rooms.get(info.roomCode);
  if (!room) return;
  const target = info.role === 'host' ? room.guest : room.host;
  if (target) sendJson(target, obj);
}

function removeSocket(socket) {
  const info = socketToRoom.get(socket);
  socketToRoom.delete(socket);
  if (!info) return;
  const room = rooms.get(info.roomCode);
  if (!room) return;
  const peer = info.role === 'host' ? room.guest : room.host;
  if (peer) sendJson(peer, { type: 'peer-left' });
  rooms.delete(info.roomCode);
}

function handleSignalMessage(socket, text) {
  let msg;
  try { msg = JSON.parse(text); } catch { return; }

  switch (msg.type) {
    case 'host': {
      const roomCode = genRoomCode();
      rooms.set(roomCode, { host: socket, guest: null });
      socketToRoom.set(socket, { roomCode, role: 'host' });
      sendJson(socket, { type: 'room-created', roomCode });
      break;
    }
    case 'join': {
      const { roomCode } = msg;
      const room = rooms.get(roomCode);
      if (!room) { sendJson(socket, { type: 'room-not-found' }); break; }
      if (room.guest) { sendJson(socket, { type: 'room-full' }); break; }
      room.guest = socket;
      socketToRoom.set(socket, { roomCode, role: 'guest' });
      sendJson(socket, { type: 'room-joined' });
      sendJson(room.host, { type: 'guest-ready' });
      break;
    }
    case 'offer':
    case 'answer':
    case 'ice':
      relay(socket, msg);
      break;
    case 'leave':
      removeSocket(socket);
      break;
  }
}

function attachSignalingSocket(socket) {
  let buf = Buffer.alloc(0);

  socket.on('data', chunk => {
    buf = Buffer.concat([buf, chunk]);
    const { frames, remaining } = wsParseFrames(buf);
    buf = remaining;
    for (const frame of frames) {
      if (frame.opcode === 8) { removeSocket(socket); socket.destroy(); return; }
      if (frame.opcode === 9) { wsPong(socket, frame.payload ?? Buffer.alloc(0)); continue; }
      if (frame.opcode === 1) handleSignalMessage(socket, frame.text);
    }
  });

  socket.on('close', () => removeSocket(socket));
  socket.on('error', () => { removeSocket(socket); socket.destroy(); });
}

// ---------------------------------------------------------------------------
// HTTP server
// ---------------------------------------------------------------------------

const server = http.createServer((req, res) => {
  const requested = safePath(req.url || '/');
  if (!requested) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  let filePath = requested;
  if (existsSync(filePath) && statSync(filePath).isDirectory()) {
    filePath = join(filePath, 'index.html');
  }

  if (!existsSync(filePath) || !statSync(filePath).isFile()) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not found');
    return;
  }

  const type = mimeTypes[extname(filePath).toLowerCase()] || 'application/octet-stream';
  res.writeHead(200, {
    'Content-Type': type,
    'Cache-Control': 'no-store',
  });
  createReadStream(filePath).pipe(res);
});

server.on('upgrade', (req, socket, head) => {
  const url = new URL(req.url, `http://localhost`);
  if (url.pathname !== '/signal') {
    socket.write('HTTP/1.1 404 Not Found\r\n\r\n');
    socket.destroy();
    return;
  }
  if (!wsHandshake(req, socket)) return;
  attachSignalingSocket(socket);
});

server.listen(port, () => {
  console.log(`The Last Reading  →  http://localhost:${port}`);
  console.log(`Signaling server  →  ws://localhost:${port}/signal`);
});
