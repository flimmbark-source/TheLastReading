// Reassembles the exact approved reference sheet from text chunks.
// Keeping the binary source as chunks lets the repository preserve the
// generated artwork without approximating it with hand-authored vectors.

// This project serves the repository root directly (scripts/serve.mjs), so
// files inside public/ remain under /public/ in the browser URL.
const PARTS = [0, 1, 2, 3].map(index =>
  `/public/ui/single-player-v2/reference-sheet/part-${String(index).padStart(2, '0')}.txt`
);

let objectUrl = null;
let loading = null;

function decodeBase64(base64) {
  const binary = atob(base64.replace(/\s+/g, ''));
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

export function installReferenceSheetAssets(target = window) {
  if (loading) return loading;
  const document = target?.document;
  if (!document) return Promise.resolve(false);

  loading = Promise.all(PARTS.map(async path => {
    const response = await fetch(path, { cache: 'no-store' });
    if (!response.ok) {
      throw new Error(`Unable to load reference art chunk: ${path} (${response.status})`);
    }
    return response.text();
  }))
    .then(parts => {
      const bytes = decodeBase64(parts.join(''));
      objectUrl = URL.createObjectURL(new Blob([bytes], { type: 'image/webp' }));
      document.documentElement.style.setProperty('--tlr-reference-sheet', `url("${objectUrl}")`);
      document.body?.classList.remove('reference-sheet-failed');
      document.body?.classList.add('reference-sheet-ready');
      return true;
    })
    .catch(error => {
      console.error('[single-player-v2] Reference sheet failed to load', error);
      document.body?.classList.add('reference-sheet-failed');
      return false;
    });

  target.addEventListener('pagehide', () => {
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    objectUrl = null;
  }, { once: true });

  return loading;
}
