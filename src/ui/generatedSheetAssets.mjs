// Decodes the approved generated UI sheet and exposes each tile as an
// independent runtime image. Checkerboard preview pixels are removed or
// replaced before the images are applied to the live interface.

const SOURCE_WIDTH = 1024;
const SOURCE_HEIGHT = 1337;

const REGIONS = {
  '--spv2-title-art': { box: [12, 12, 462, 202], mode: 'transparent' },
  '--spv2-hud-frame-art': { box: [486, 12, 500, 238], mode: 'transparent' },
  '--spv2-hud-reserve-art': { box: [12, 262, 210, 245], mode: 'reserve-panel' },
  '--spv2-hud-score-art': { box: [234, 262, 215, 245], mode: 'score-panel' },
  '--spv2-hud-threshold-art': { box: [461, 262, 216, 245], mode: 'threshold-panel' },
  '--spv2-hud-discards-art': { box: [689, 262, 236, 245], mode: 'discard-panel' },
  '--spv2-utility-reference-art': { box: [12, 519, 125, 125], mode: 'transparent' },
  '--spv2-utility-settings-art': { box: [149, 519, 125, 125], mode: 'transparent' },
  '--spv2-spread-slot-art': { box: [286, 519, 164, 280], mode: 'transparent' },
  '--spv2-reading-circle-art': { box: [462, 519, 380, 348], mode: 'transparent' },
  '--spv2-hand-dock-art': { box: [12, 879, 503, 172], mode: 'transparent' },
  '--spv2-action-eye-art': { box: [527, 879, 129, 149], mode: 'transparent' },
  '--spv2-action-center-art': { box: [668, 879, 153, 143], mode: 'transparent' },
  '--spv2-action-deck-art': { box: [833, 879, 129, 139], mode: 'transparent' },
  '--spv2-table-bg-art': { box: [12, 1063, 426, 262], mode: 'background' }
};

const PANEL_COLORS = {
  'reserve-panel': [5, 14, 24],
  'score-panel': [25, 18, 8],
  'threshold-panel': [19, 12, 30],
  'discard-panel': [10, 8, 8]
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
    canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Unable to create generated UI tile')), 'image/webp', .94);
  });
}

async function loadImage(url) {
  const image = new Image();
  image.decoding = 'async';
  image.src = url;
  await image.decode();
  return image;
}

function isCheckerPixel(red, green, blue) {
  const maximum = Math.max(red, green, blue);
  const minimum = Math.min(red, green, blue);
  const neutral = maximum - minimum < 9;
  const luminance = (red + green + blue) / 3;
  return neutral && luminance >= 28 && luminance <= 112;
}

function cleanTile(context, width, height, mode) {
  if (mode === 'background') return;

  const imageData = context.getImageData(0, 0, width, height);
  const pixels = imageData.data;
  const panelColor = PANEL_COLORS[mode] || null;

  for (let index = 0; index < pixels.length; index += 4) {
    const red = pixels[index];
    const green = pixels[index + 1];
    const blue = pixels[index + 2];

    if (!isCheckerPixel(red, green, blue)) continue;

    if (panelColor) {
      pixels[index] = panelColor[0];
      pixels[index + 1] = panelColor[1];
      pixels[index + 2] = panelColor[2];
      pixels[index + 3] = 255;
    } else {
      pixels[index + 3] = 0;
    }
  }

  context.putImageData(imageData, 0, 0);
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

      await Promise.all(Object.entries(REGIONS).map(async ([property, definition]) => {
        const [x, y, width, height] = definition.box;
        const sx = Math.round(x * scaleX);
        const sy = Math.round(y * scaleY);
        const sw = Math.max(1, Math.round(width * scaleX));
        const sh = Math.max(1, Math.round(height * scaleY));

        // Sample and clean the region at the source sheet's native scale so the
        // checker-removal heuristic operates on the same pixels it was tuned for.
        const sourceCanvas = document.createElement('canvas');
        sourceCanvas.width = sw;
        sourceCanvas.height = sh;
        const sourceContext = sourceCanvas.getContext('2d', { alpha: true, willReadFrequently: true });
        if (!sourceContext) throw new Error('Canvas is unavailable for generated UI assets');
        sourceContext.drawImage(image, sx, sy, sw, sh, 0, 0, sw, sh);
        cleanTile(sourceContext, sw, sh, definition.mode);

        // Emit each tile at its full design resolution. When a full-res sheet is
        // supplied this is a 1:1 copy; for the low-res placeholder it performs a
        // single high-quality upscale here instead of letting the browser
        // nearest-neighbour stretch a thumbnail-sized slice again at paint time.
        const tileCanvas = document.createElement('canvas');
        tileCanvas.width = width;
        tileCanvas.height = height;
        const tileContext = tileCanvas.getContext('2d', { alpha: true });
        if (!tileContext) throw new Error('Canvas is unavailable for generated UI assets');
        tileContext.imageSmoothingEnabled = true;
        tileContext.imageSmoothingQuality = 'high';
        tileContext.drawImage(sourceCanvas, 0, 0, sw, sh, 0, 0, width, height);

        const tileUrl = URL.createObjectURL(await canvasBlob(tileCanvas));
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
