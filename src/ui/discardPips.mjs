// Small discard-count cards anchored to the actual rendered hand fan.
// Gameplay continues to own the discard count; this view only mirrors it.

const STYLE_ID = 'table3d-discard-pips-style';
const PIPS_ID = 'table3dDiscardPips';

function installStyles(document) {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    #${PIPS_ID} {
      position: fixed;
      left: 0;
      top: 0;
      z-index: 56;
      display: none;
      align-items: flex-end;
      gap: 3px;
      pointer-events: none;
      visibility: hidden;
    }

    body.table3d-live #${PIPS_ID} {
      display: flex;
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

function visibleHandFanRect(document) {
  const cards = [...document.querySelectorAll('#hand .card')]
    .map(card => card.getBoundingClientRect())
    .filter(rect => rect.width > 1 && rect.height > 1);

  if (!cards.length) return null;

  const left = Math.min(...cards.map(rect => rect.left));
  const right = Math.max(...cards.map(rect => rect.right));
  const top = Math.min(...cards.map(rect => rect.top));
  const bottom = Math.max(...cards.map(rect => rect.bottom));
  return { left, right, top, bottom };
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

  let positionFrame = 0;
  let settleTimer = 0;
  const positionNow = () => {
    const fan = visibleHandFanRect(document);
    if (!fan) {
      pips.style.visibility = 'hidden';
      return;
    }

    // Conventional videogame badge placement: directly above the rendered
    // hand fan's upper-left corner, not at a world-space table anchor.
    const left = Math.max(8, fan.left + 3);
    const top = Math.max(8, fan.top - 25);
    pips.style.left = `${left.toFixed(1)}px`;
    pips.style.top = `${top.toFixed(1)}px`;
    pips.style.visibility = 'visible';
  };

  const schedulePosition = () => {
    if (positionFrame) target.cancelAnimationFrame(positionFrame);
    positionFrame = target.requestAnimationFrame(() => {
      positionFrame = 0;
      positionNow();
    });
    target.clearTimeout(settleTimer);
    settleTimer = target.setTimeout(positionNow, 180);
  };

  let shown = -1;
  const render = () => {
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
    schedulePosition();
  };

  let valueObserver = null;
  let handObserver = null;
  let handResizeObserver = null;

  const bindHand = () => {
    const hand = document.getElementById('hand');
    if (!hand) {
      target.requestAnimationFrame(bindHand);
      return;
    }

    handObserver?.disconnect();
    handObserver = new MutationObserver(schedulePosition);
    handObserver.observe(hand, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'style'],
    });

    handResizeObserver?.disconnect();
    if (typeof ResizeObserver === 'function') {
      handResizeObserver = new ResizeObserver(schedulePosition);
      handResizeObserver.observe(hand);
    }

    hand.addEventListener('animationend', schedulePosition, true);
    hand.addEventListener('transitionend', schedulePosition, true);
    schedulePosition();
  };

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

  target.addEventListener('resize', schedulePosition, { passive: true });
  target.addEventListener('orientationchange', schedulePosition, { passive: true });
  document.addEventListener('pointerup', schedulePosition, true);

  target.__tlrRenderDiscardPips = render;
  bindHand();
  bindCounter();
}
