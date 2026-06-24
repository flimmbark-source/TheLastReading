// Applies the approved single-player-v2 UI art. Each element is a pre-cut,
// alpha-keyed PNG (sliced from atlas-source.png) exposed to the stylesheet as a
// CSS custom property, plus the full-bleed table background. Keeping the same
// custom-property names means the tuned layout CSS needs no changes — only the
// underlying art improves.

const ELEMENT_BASE = '/public/ui/single-player-v2/elements/';

const ELEMENT_ART = {
  '--spv2-title-art': 'title.png',
  '--spv2-hud-frame-art': 'hud-frame.png',
  '--spv2-hud-reserve-art': 'hud-reserve.png',
  '--spv2-hud-score-art': 'hud-score.png',
  '--spv2-hud-threshold-art': 'hud-threshold.png',
  '--spv2-hud-discards-art': 'hud-discards.png',
  '--spv2-utility-reference-art': 'utility-reference.png',
  '--spv2-utility-settings-art': 'utility-settings.png',
  '--spv2-spread-slot-art': 'spread-slot.png',
  '--spv2-hand-dock-art': 'hand-dock.png',
  '--spv2-action-eye-art': 'action-eye.png',
  '--spv2-action-center-art': 'action-center.png',
  '--spv2-action-deck-art': 'action-deck.png',
  // Art-directed utility medallions (sliced from Options-Discs.png).
  '--spv2-option-menu-art': 'option-menu.png',
  '--spv2-option-scoring-art': 'option-scoring.png',
  '--spv2-option-abilities-art': 'option-abilities.png',
  '--spv2-option-archive-art': 'option-archive.png'
};

const TABLE_BG = '/public/ui/single-player-v2/table-bg.png';

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
