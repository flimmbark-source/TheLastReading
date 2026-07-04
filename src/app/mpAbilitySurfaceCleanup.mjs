import { installMpHandGestureAdapter } from './mpHandGestureAdapter.mjs';

function installDuelReferenceSurfaceStyle(doc) {
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

    /* The utility buttons live inside #titleWrap while the drawers live inside
       .refs-layer. Put the drawer parent above the button parent; raising only
       the drawer child cannot escape its parent's stacking context. */
    body.mp-game-active #titleWrap {
      z-index: 2147483000 !important;
    }

    body.mp-game-active .refs-layer {
      z-index: 2147483200 !important;
    }

    body.mp-game-active #titleWrap .actions,
    body.mp-game-active #scoringBtn,
    body.mp-game-active #abilitiesBtn {
      z-index: auto !important;
    }

    body.mp-game-active #scoringPullWrap,
    body.mp-game-active #abilitiesPullWrap,
    body.mp-game-active #scoringPullWrap.open,
    body.mp-game-active #abilitiesPullWrap.open {
      z-index: 2147483250 !important;
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
  installDuelReferenceSurfaceStyle(doc);
}
