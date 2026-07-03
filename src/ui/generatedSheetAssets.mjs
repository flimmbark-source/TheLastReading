// Applies the approved single-player-v2 UI art. Each element is a pre-cut,
// alpha-keyed PNG (sliced from atlas-source.png) exposed to the stylesheet as a
// CSS custom property, plus the full-bleed table background. Keeping the same
// custom-property names means the tuned layout CSS needs no changes — only the
// underlying art improves.

const ELEMENT_BASE = '/public/ui/single-player-v2/elements/';

const ELEMENT_ART = {
  '--spv2-title-art': 'title.webp',
  '--spv2-hud-frame-art': 'hud-frame.webp',
  '--spv2-hud-reserve-art': 'hud-reserve.webp',
  '--spv2-hud-score-art': 'hud-score.webp',
  '--spv2-hud-threshold-art': 'hud-threshold.webp',
  '--spv2-hud-discards-art': 'hud-discards.webp',
  '--spv2-utility-reference-art': 'utility-reference.webp',
  '--spv2-utility-settings-art': 'utility-settings.webp',
  '--spv2-spread-slot-art': 'spread-slot.webp',
  '--spv2-hand-dock-art': 'hand-dock.webp',
  '--spv2-action-eye-art': 'action-eye.webp',
  '--spv2-action-center-art': 'action-center.webp',
  '--spv2-action-deck-art': 'action-deck.webp',
  // Art-directed utility medallions (sliced from Options-Discs.png).
  '--spv2-option-menu-art': 'option-menu.webp',
  '--spv2-option-scoring-art': 'option-abilities.webp',
  '--spv2-option-abilities-art': 'option-scoring.webp',
  '--spv2-option-archive-art': 'option-archive.webp'
};

const ROOT_ART = {
  // The constellation circle remains a standalone SVG in the runtime kit.
  // Keep the CSS custom property populated so spread art does not disappear
  // if the integration layer enables the separate circle overlay again.
  '--spv2-reading-circle-art': 'reading-circle.svg',
  '--spv2-card-back-art': 'card-back.svg'
};

const TABLE_BG = '/public/ui/single-player-v2/table-bg.webp';

let applied = null;

function preload(target, url) {
  return new Promise(resolve => {
    const image = new target.Image();
    image.decoding = 'async';
    image.onload = () => resolve(true);
    image.onerror = () => resolve(false);
    image.src = url;
  });
}

export function installGeneratedSheetAssets(target = window) {
  if (applied) return applied;
  const document = target?.document;
  if (!document) return Promise.resolve(false);

  const root = document.documentElement;
  const urls = [];
  for (const [property, file] of Object.entries(ELEMENT_ART)) {
    const url = `${ELEMENT_BASE}${file}`;
    root.style.setProperty(property, `url("${url}")`);
    urls.push(url);
  }
  for (const [property, file] of Object.entries(ROOT_ART)) {
    const url = `/public/ui/single-player-v2/${file}`;
    root.style.setProperty(property, `url("${url}")`);
    urls.push(url);
  }
  root.style.setProperty('--spv2-table-bg-art', `url("${TABLE_BG}")`);
  urls.push(TABLE_BG);

  // Reveal the skin once the art is warmed in cache so the layout does not
  // flash a frame of empty frames. Any individual miss does not block the skin.
  applied = Promise.all(urls.map(url => preload(target, url)))
    .then(results => {
      document.body?.classList.remove('generated-sheet-failed');
      document.body?.classList.add('generated-sheet-ready');
      return results.every(Boolean);
    })
    .catch(error => {
      console.error('[single-player-v2] Failed to apply UI assets', error);
      document.body?.classList.add('generated-sheet-failed');
      return false;
    });

  return applied;
}
