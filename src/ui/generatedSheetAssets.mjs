// Decodes the approved generated UI sprite and exposes every tile as an
// independent transparent CSS image. The packed source is fetched once.

const SOURCE_WIDTH = 1024;
const SOURCE_HEIGHT = 1337;

const REGIONS = {
  '--spv2-title-art': [12, 12, 462, 202],
  '--spv2-hud-frame-art': [486, 12, 500, 238],
  '--spv2-hud-reserve-art': [12, 262, 210, 245],
  '--spv2-hud-score-art': [234, 262, 215, 245],
  '--spv2-hud-threshold-art': [461, 262, 216, 245],
  '--spv2-hud-discards-art': [689, 262, 236, 245],
  '--spv2-utility-reference-art': [12, 519, 125, 125],
  '--spv2-utility-settings-art': [149, 519, 125, 125],
  '--spv2-spread-slot-art': [286, 519, 164, 280],
  '--spv2-reading-circle-art': [462, 519, 380, 348],
  '--spv2-hand-dock-art': [12, 879, 503, 172],
  '--spv2-action-eye-art': [527, 879, 129, 149],
  '--spv2-action-center-art': [668, 879, 153, 143],
  '--spv2-action-deck-art': [833, 879, 129, 139],
  '--spv2-table-bg-art': [12, 1063, 426, 262]
};

let loading = null;
const objectUrls = [];

function decodeBase64(text) {
  const binary = atob(text.replace(/\s+/g, ''));
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function canvasBlob(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Unable to create generated UI tile')), 'image/png');
  });
}

async function loadImage(url) {
  const image = new Image();
  image.decoding = 'async';
  image.src = url;
  await image.decode();
  return image;
}

export function installGeneratedSheetAssets(target = window) {
  if (loading) return loading;
  const document = target?.document;
  if (!document) return Promise.resolve(false);

  loading = fetch('/public/ui/single-player-v2/generated-sheet.b64.txt', { cache: 'force-cache' })
    .then(response => {
      if (!response.ok) throw new Error(`Unable to load generated UI sprite (${response.status})`);
      return response.text();
    })
    .then(async text => {
      const sourceBlob = new Blob([decodeBase64(text)], { type: 'image/webp' });
      const sourceUrl = URL.createObjectURL(sourceBlob);
      objectUrls.push(sourceUrl);
      const image = await loadImage(sourceUrl);
      const scaleX = image.naturalWidth / SOURCE_WIDTH;
      const scaleY = image.naturalHeight / SOURCE_HEIGHT;
      const root = document.documentElement;

      await Promise.all(Object.entries(REGIONS).map(async ([property, region]) => {
        const [x, y, width, height] = region;
        const sx = Math.round(x * scaleX);
        const sy = Math.round(y * scaleY);
        const sw = Math.max(1, Math.round(width * scaleX));
        const sh = Math.max(1, Math.round(height * scaleY));
        const canvas = document.createElement('canvas');
        canvas.width = sw;
        canvas.height = sh;
        const context = canvas.getContext('2d', { alpha: true });
        if (!context) throw new Error('Canvas is unavailable for generated UI assets');
        context.drawImage(image, sx, sy, sw, sh, 0, 0, sw, sh);
        const tileUrl = URL.createObjectURL(await canvasBlob(canvas));
        objectUrls.push(tileUrl);
        root.style.setProperty(property, `url("${tileUrl}")`);
      }));

      document.body?.classList.remove('generated-sheet-failed');
      document.body?.classList.add('generated-sheet-ready');
      return true;
    })
    .catch(error => {
      console.error('[single-player-v2] Generated asset sheet failed to load', error);
      document.body?.classList.add('generated-sheet-failed');
      return false;
    });

  target.addEventListener('pagehide', () => {
    objectUrls.splice(0).forEach(url => URL.revokeObjectURL(url));
    loading = null;
  }, { once: true });

  return loading;
}
