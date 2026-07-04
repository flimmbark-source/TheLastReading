import { installMpHandGestureAdapter } from './mpHandGestureAdapter.mjs';

function installDuelLayoutStyles(doc) {
  if (!doc.getElementById('mp-duel-layout-fix')) {
    const link = doc.createElement('link');
    link.id = 'mp-duel-layout-fix';
    link.rel = 'stylesheet';
    link.href = 'src/styles/mpDuelLayoutFix.css?v=1';
    doc.head.appendChild(link);
  }

  if (doc.getElementById('mp-reference-surface-style')) return;
  const style = doc.createElement('style');
  style.id = 'mp-reference-surface-style';
  style.textContent = `
    body.mp-game-active #scoringPullTab,
    body.mp-game-active #abilitiesPullTab { display: none !important; }

    body.mp-game-active #scoringPullWrap > .spv2-menu-close-tab,
    body.mp-game-active #abilitiesPullWrap > .spv2-menu-close-tab {
      display: none !important;
      left: 50% !important;
      right: auto !important;
      transform: translateX(-50%) !important;
    }

    body.mp-game-active #scoringPullWrap.open > .spv2-menu-close-tab,
    body.mp-game-active #abilitiesPullWrap.open > .spv2-menu-close-tab {
      display: flex !important;
    }
  `;
  doc.head.appendChild(style);
}

export function installMpAbilitySurfaceCleanup(target = window) {
  if (!target || target.__tlrMpAbilitySurfaceCleanupInstalled) return;
  target.__tlrMpAbilitySurfaceCleanupInstalled = true;
  const doc = target.document;
  if (!doc) return;
  installMpHandGestureAdapter(target);
  installDuelLayoutStyles(doc);
}
