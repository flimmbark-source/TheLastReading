// Tiny discard-count cards for the seated 3D table. This is display-only:
// gameplay continues to own the discard count, and this view mirrors it.

const STYLE_ID = 'table3d-discard-pips-style';
const PIPS_ID = 'table3dDiscardPips';

function installStyles(document) {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    #${PIPS_ID} {
      position: fixed;
      left: calc(var(--t3d-hand-c-x, 50vw) - clamp(82px, 29vw, 108px));
      top: calc(var(--t3d-hand-c-y, 76vh) - clamp(40px, 6.5vh, 58px));
      z-index: 41;
      display: none;
      align-items: flex-end;
      gap: 2px;
      transform: translate(-50%, -50%) rotate(-4deg);
      transform-origin: center;
      pointer-events: none;
    }

    body.table3d-live #${PIPS_ID} {
      display: flex;
    }

    #${PIPS_ID} .table3d-discard-pip {
      position: relative;
      box-sizing: border-box;
      width: 7px;
      height: 11px;
      flex: 0 0 7px;
      border: 1px solid rgba(205, 169, 91, .82);
      border-radius: 1px;
      background:
        linear-gradient(145deg, rgba(135, 98, 45, .38), transparent 42%),
        #17120c;
      box-shadow:
        0 1px 2px rgba(0, 0, 0, .82),
        inset 0 0 0 1px rgba(255, 222, 145, .08);
    }

    #${PIPS_ID} .table3d-discard-pip::after {
      content: '';
      position: absolute;
      left: 50%;
      top: 50%;
      width: 2px;
      height: 2px;
      border: 1px solid rgba(205, 169, 91, .58);
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
    document.body.appendChild(pips);
  }

  let shown = -1;
  const render = () => {
    const count = readDiscardCount(target, document);
    pips.setAttribute('aria-label', `${count} discard${count === 1 ? '' : 's'} remaining`);
    if (count === shown) return;
    shown = count;
    pips.replaceChildren(
      ...Array.from({ length: count }, () => {
        const card = document.createElement('span');
        card.className = 'table3d-discard-pip';
        card.setAttribute('aria-hidden', 'true');
        return card;
      }),
    );
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
  bindCounter();
}
