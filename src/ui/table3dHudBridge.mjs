// Screen-space bridge for the hybrid seated table.
//
// The cabinet itself is real R3F geometry, while the legacy score sequencer
// still owns the timing of chip projectiles, the delayed roll-up, and each +1
// beat. This module projects a small live number patch onto the cabinet face so
// that old, proven timing remains the source of truth instead of duplicating it
// in the 3D renderer. It also replaces the large table action medallions with a
// tiny discard-charge row on the cloth while preserving the existing discard
// button as an invisible hit/drop target over that row.

const CABINET_CLASS = 'table3d-score-cabinet';
const SCORE_ID = 'table3dScoreValue';
const DISCARD_ID = 'table3dDiscardIcons';
const STYLE_ID = 'table3dHudBridgeStyle';

const DISCARD_INLINE_PROPERTIES = [
  'position',
  'left',
  'top',
  'right',
  'bottom',
  'width',
  'height',
  'min-width',
  'min-height',
  'margin',
  'padding',
  'transform',
  'opacity',
  'visibility',
  'display',
  'background',
  'background-image',
  'border',
  'border-radius',
  'box-shadow',
  'filter',
  'color',
  'font-size',
  'z-index',
  'pointer-events',
];

const PURGE_INLINE_PROPERTIES = ['display', 'visibility', 'pointer-events'];

function reducedMotion() {
  return Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
}

function numberFrom(id) {
  const raw = document.getElementById(id)?.textContent ?? '0';
  const value = Number(String(raw).replace(/[^0-9.-]/g, ''));
  return Number.isFinite(value) ? value : 0;
}

function clearInlineProperties(element, properties) {
  if (!element) return;
  for (const property of properties) element.style.removeProperty(property);
}

function setImportant(element, property, value) {
  element?.style.setProperty(property, value, 'important');
}

function ensureStyle() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    #${SCORE_ID} {
      position: fixed;
      left: var(--t3d-score-counter-x, -9999px);
      top: var(--t3d-score-counter-y, -9999px);
      z-index: 36;
      width: clamp(58px, 18vw, 78px);
      height: clamp(38px, 10vw, 48px);
      display: grid;
      place-items: center;
      transform: translate(-50%, -50%);
      border-radius: 5px;
      background:
        radial-gradient(ellipse at 50% 62%, rgba(93, 57, 18, .28), transparent 66%),
        linear-gradient(#231608, #0d0905);
      color: #ffe0a0;
      font: 700 clamp(24px, 7vw, 34px)/1 Georgia, "Times New Roman", serif;
      text-shadow: 0 0 11px rgba(235, 175, 70, .34), 0 2px 7px #000;
      box-shadow: 0 0 9px 5px rgba(13, 9, 5, .8);
      opacity: 0;
      visibility: hidden;
      pointer-events: none;
    }

    body.table3d-live.${CABINET_CLASS} #${SCORE_ID} {
      opacity: 1;
      visibility: visible;
    }

    #${DISCARD_ID} {
      position: fixed;
      left: var(--t3d-discard-icons-x, -9999px);
      top: var(--t3d-discard-icons-y, -9999px);
      z-index: 66;
      display: flex;
      align-items: center;
      gap: 3px;
      transform: translate(-50%, -50%) rotate(-4deg);
      opacity: 0;
      visibility: hidden;
      pointer-events: none;
      filter: drop-shadow(0 2px 3px rgba(0, 0, 0, .72));
    }

    body.table3d-live.${CABINET_CLASS} #${DISCARD_ID} {
      opacity: 1;
      visibility: visible;
    }

    #${DISCARD_ID} .table3d-discard-card {
      position: relative;
      width: 7px;
      height: 11px;
      box-sizing: border-box;
      border: 1px solid #b98a3f;
      border-radius: 1px;
      background: linear-gradient(145deg, #25180d, #090604 76%);
      box-shadow: inset 0 0 0 1px rgba(225, 183, 93, .14);
    }

    #${DISCARD_ID} .table3d-discard-card::after {
      content: "";
      position: absolute;
      left: 50%;
      top: 50%;
      width: 2px;
      height: 2px;
      border: 1px solid rgba(222, 176, 80, .82);
      transform: translate(-50%, -50%) rotate(45deg);
    }
  `;
  document.head.appendChild(style);
}

function ensureOverlay(id) {
  let element = document.getElementById(id);
  if (!element) {
    element = document.createElement('div');
    element.id = id;
    element.setAttribute('aria-hidden', 'true');
    document.body.appendChild(element);
  }
  return element;
}

function cabinetActive() {
  return Boolean(document.body?.classList.contains(CABINET_CLASS));
}

function updateActionButtons() {
  const discard = document.getElementById('discardBtn');
  const purge = document.getElementById('purgeBtn');

  // The on-cloth discard-charge row was removed (its count already lives in the
  // discard pips above the spread), so the discard button no longer overlays it
  // as an invisible hit target — leave it in its native spread-actions spot as a
  // normal, visible control.
  clearInlineProperties(discard, DISCARD_INLINE_PROPERTIES);

  if (!cabinetActive()) {
    clearInlineProperties(purge, PURGE_INLINE_PROPERTIES);
    return;
  }

  if (purge) {
    setImportant(purge, 'display', 'none');
    setImportant(purge, 'visibility', 'hidden');
    setImportant(purge, 'pointer-events', 'none');
  }
}

function updateScore() {
  const overlay = ensureOverlay(SCORE_ID);
  const next = String(numberFrom('current'));
  if (overlay.textContent === next) return;
  overlay.textContent = next;
  if (cabinetActive() && overlay.animate && !reducedMotion()) {
    overlay.animate(
      [
        { transform: 'translate(-50%, -50%) scale(1)' },
        { transform: 'translate(-50%, -50%) scale(1.14)', offset: .42 },
        { transform: 'translate(-50%, -50%) scale(.98)', offset: .75 },
        { transform: 'translate(-50%, -50%) scale(1)' },
      ],
      { duration: 220, easing: 'ease-out' },
    );
  }
}

function updateDiscards() {
  // The on-cloth discard-charge row is retired: the discard count is shown by
  // the discard pips above the spread. Keep the element empty and hidden so the
  // little card row no longer floats over the cloth above the hand.
  const overlay = ensureOverlay(DISCARD_ID);
  overlay.replaceChildren();
  overlay.style.setProperty('display', 'none', 'important');
}

function updateAll() {
  updateScore();
  updateDiscards();
  updateActionButtons();
}

function observeValue(id, observer) {
  const element = document.getElementById(id);
  if (element) observer.observe(element, { subtree: true, childList: true, characterData: true });
  return Boolean(element);
}

function install() {
  if (window.__tlrTable3dHudBridgeInstalled) return;
  ensureStyle();

  const boot = () => {
    const scoreReady = document.getElementById('current');
    const discardReady = document.getElementById('discards');
    if (!document.body || !scoreReady || !discardReady) {
      requestAnimationFrame(boot);
      return;
    }

    window.__tlrTable3dHudBridgeInstalled = true;
    ensureOverlay(SCORE_ID);
    ensureOverlay(DISCARD_ID);
    updateAll();

    const valueObserver = new MutationObserver(updateAll);
    observeValue('current', valueObserver);
    observeValue('discards', valueObserver);

    const bodyObserver = new MutationObserver(updateAll);
    bodyObserver.observe(document.body, { attributes: true, attributeFilter: ['class'] });

    window.addEventListener('resize', updateAll, { passive: true });
    window.__tlrTable3dHudBridge = { update: updateAll, valueObserver, bodyObserver };
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
}

export function scoreTargetRect() {
  const overlay = document.getElementById(SCORE_ID);
  if (cabinetActive() && overlay) {
    const rect = overlay.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) return rect;
  }
  const pill = document.querySelector('.score-stack .score-pill');
  return pill?.getBoundingClientRect() ?? null;
}

export function scoreTargetElement() {
  const overlay = document.getElementById(SCORE_ID);
  if (cabinetActive() && overlay) return overlay;
  return document.querySelector('.score-stack .score-pill');
}

install();
