import http from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { extname, join, normalize, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildBundle } from './build-bundle.mjs';

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

// App code (html/js/mjs/css, plus anything under src/) must always be
// revalidated so local testing never runs against a stale build, mirroring
// the no-cache/no-store/must-revalidate rules in the production _headers
// file. Everything else (images, audio, fonts...) is free to be cached --
// those don't carry cache-busting `?v=` query params, so instead of a blind
// max-age we validate with Last-Modified/ETag: repeat draws/market visits
// in the same session get a cheap 304 instead of re-downloading every
// sprite sheet, while an edited asset is still picked up on the next request.
const ALWAYS_REVALIDATE_EXTS = new Set(['.html', '.js', '.mjs', '.css']);

function safePath(urlPath) {
  const decoded = decodeURIComponent(urlPath.split('?')[0] || '/');
  const clean = normalize(decoded).replace(/^([/\\])+/, '');
  const fullPath = resolve(join(root, clean || 'index.html'));
  return fullPath.startsWith(root) ? fullPath : null;
}

function isUnderSrc(filePath) {
  const rel = relative(root, filePath);
  return rel === 'src' || rel.startsWith(`src${sep}`);
}

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

  const stat = statSync(filePath);
  const type = mimeTypes[extname(filePath).toLowerCase()] || 'application/octet-stream';

  if (ALWAYS_REVALIDATE_EXTS.has(extname(filePath).toLowerCase()) || isUnderSrc(filePath)) {
    res.writeHead(200, {
      'Content-Type': type,
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    });
    createReadStream(filePath).pipe(res);
    return;
  }

  const etag = `"${stat.size.toString(16)}-${stat.mtimeMs.toString(16)}"`;
  const lastModified = stat.mtime.toUTCString();
  if (req.headers['if-none-match'] === etag || req.headers['if-modified-since'] === lastModified) {
    res.writeHead(304, { ETag: etag, 'Last-Modified': lastModified, 'Cache-Control': 'no-cache' });
    res.end();
    return;
  }

  res.writeHead(200, {
    'Content-Type': type,
    'Cache-Control': 'no-cache',
    ETag: etag,
    'Last-Modified': lastModified,
  });
  createReadStream(filePath).pipe(res);
});

// Build fresh before listening, regardless of how this script is invoked --
// `npm run dev/start/serve` isn't the only path here: several test scripts
// (validate-single-player-v2-visual-smoke.mjs, validate-mp-prompt-visual.mjs,
// cascade-probe.mjs) spawn `node scripts/serve.mjs` directly, bypassing any
// npm pre-hook. Doing the build here instead is the one place guaranteed to
// run no matter how the server is started.
await buildBundle();
server.listen(port, () => {
  console.log(`The Last Reading  →  http://localhost:${port}`);
});
