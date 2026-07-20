// Small discard-count cards locked to the spread's top-left corner.
// Gameplay continues to own the discard count; this view only mirrors it.

import { installDiscardPipsTutorial } from './discardPipsTutorial.mjs';

const STYLE_ID = 'table3d-discard-pips-style';
const PIPS_ID = 'table3dDiscardPips';

function installStyles(document) {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    #${PIPS_ID} {
      position: absolute;
      left: 8px;
      top: 8px;
      z-index: 56;
      display: none;
      align-items: flex-start;
      gap: 3px;
      pointer-events: none;
      visibility: hidden;
      transform: none;
    }

    body.table3d-live #${PIPS_ID} {
      display: flex;
      visibility: visible;
    }

    #${PIPS_ID} .table3d-discard-pip {
      position: relative;
      box-sizing: border-box;
      width: 14px;
      height: 20px;
      flex: 0 0 14px;
      border: 1px solid rgba(219, 181, 94, .92);
      border-radius: 2px;
      background:
        linear-gradient(145deg, rgba(147, 104, 45, .48), transparent 44%),
        linear-gradient(180deg, #21180e, #0f0b08);
      box-shadow:
        0 2px 4px rgba(0, 0, 0, .88),
        inset 0 0 0 1px rgba(255, 226, 153, .11);
    }

    #${PIPS_ID} .table3d-discard-pip::before {
      content: '';
      position: absolute;
      inset: 2px;
      border: 1px solid rgba(188, 143, 64, .45);
      border-radius: 1px;
    }

    #${PIPS_ID} .table3d-discard-pip::after {
      content: '';
      position: absolute;
      left: 50%;
      top: 50%;
      width: 4px;
      height: 4px;
      border: 1px solid rgba(219, 181, 94, .72);
      transform: translate(-50%, -50%) rotate(45deg);
    }
  `;
  document.head.appendChild(style);
}

function readDiscardCount(target, document) {
  const storeValue = target.tlrStore?.getState?.()?.run?.discards;
  if (Number.isFinite(Number(storeValue))) return Math.max(0, Math.floor(Number(storeValue)));

  const raw = document.getElementById('discards')?.textContent ?? '0';
  const parsed = Number(String(raw).replace(/[^0-9.-]/g, ''));
  return Number.isFinite(parsed) ? Math.max(0, Math.floor(parsed)) : 0;
}

export function installDiscardPips(target = window) {
  if (!target || target.__tlrDiscardPipsInstalled) return;
  target.__tlrDiscardPipsInstalled = true;

  const document = target.document;
  if (!document) return;
  installStyles(document);

  let pips = document.getElementById(PIPS_ID);
  if (!pips) {
    pips = document.createElement('div');
    pips.id = PIPS_ID;
    pips.setAttribute('role', 'img');
  }
  installDiscardPipsTutorial(target, pips);

  let spreadObserver = null;

  const attachToSpread = () => {
    const spread = document.getElementById('spread');
    if (!spread) {
      if (!pips.isConnected) document.body.appendChild(pips);
      target.requestAnimationFrame(attachToSpread);
      return;
    }

    if (pips.parentElement !== spread) spread.appendChild(pips);

    spreadObserver?.disconnect();
    spreadObserver = new MutationObserver(() => {
      // renderSpread may rebuild the slot children with replaceChildren().
      // Re-append the pips immediately so their containing block remains the
      // spread itself instead of falling back to viewport coordinates.
      if (pips.parentElement !== spread) spread.appendChild(pips);
    });
    spreadObserver.observe(spread, { childList: true });
  };

  let shown = -1;
  const render = () => {
    attachToSpread();
    const count = readDiscardCount(target, document);
    pips.setAttribute('aria-label', `${count} discard${count === 1 ? '' : 's'} remaining`);
    if (count !== shown) {
      shown = count;
      pips.replaceChildren(
        ...Array.from({ length: count }, () => {
          const card = document.createElement('span');
          card.className = 'table3d-discard-pip';
          card.setAttribute('aria-hidden', 'true');
          return card;
        }),
      );
    }
  };

  let valueObserver = null;
  const bindCounter = () => {
    const counter = document.getElementById('discards');
    if (!counter) {
      target.requestAnimationFrame(bindCounter);
      return;
    }
    valueObserver?.disconnect();
    valueObserver = new MutationObserver(render);
    valueObserver.observe(counter, { subtree: true, childList: true, characterData: true });
    render();
  };

  target.__tlrRenderDiscardPips = render;
  attachToSpread();
  bindCounter();
}
