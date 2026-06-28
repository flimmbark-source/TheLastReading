const STYLE_ID = 'stamp-sigils-style';

const SUIT_GLYPH = Object.freeze({ Cups: '🍷', Wands: '🪄', Swords: '🗡', Pentacles: '𖤐' });
const SUIT_COLOR = Object.freeze({
  Cups: '#1e6fd4',
  Wands: '#d46a08',
  Swords: '#3a6aa0',
  Pentacles: '#2e7d42',
});

function ensureStyle(doc) {
  if (!doc || doc.getElementById(STYLE_ID)) return;
  const style = doc.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    .card > .stamp-sigil {
      position: absolute;
      top: 4px;
      left: 4px;
      width: 20px;
      height: 20px;
      border-radius: 50%;
      z-index: 20;
      display: flex;
      align-items: center;
      justify-content: center;
      font: 400 12px/1 "Segoe UI Emoji", "Apple Color Emoji", sans-serif;
      color: #fff;
      text-shadow: 0 1px 3px rgba(0,0,0,1);
      border: 2px solid rgba(255,255,255,.75);
      box-shadow: 0 1px 5px rgba(0,0,0,1), 0 0 0 1px rgba(0,0,0,.6);
      pointer-events: none;
      letter-spacing: 0;
    }
    .card-detail-card .card > .stamp-sigil {
      width: 26px;
      height: 26px;
      top: 7px;
      left: 7px;
      font-size: 15px;
      border-width: 2px;
    }
    .stamp-suit-badge {
      display: inline-block;
      width: 36px;
      height: 36px;
      border-radius: 50%;
      background: #c97c2a;
      color: #fff;
      font: 900 13px/36px Arial, sans-serif;
      text-align: center;
      letter-spacing: 0;
    }
  `;
  doc.head.appendChild(style);
}

function allRuntimeCards(target) {
  const state = target.state || {};
  return [
    ...(state.hand || []),
    ...(state.spread || []).filter(Boolean),
    ...(state.deck || []),
    ...(state.discard || []),
  ];
}

function cardForElement(target, element) {
  const uid = String(element?.dataset?.uid ?? '');
  if (!uid) return null;
  return allRuntimeCards(target).find(card => String(card?.uid ?? '') === uid) || null;
}

function decorate(target = window) {
  const doc = target?.document;
  if (!doc) return;
  ensureStyle(doc);

  const persist = target.persist || {};
  const stampedIds = new Set(persist.stampedMajors || []);

  doc.querySelectorAll('#hand .card[data-uid], #spread .card[data-uid], .choices .card[data-uid], .card-detail-card .card[data-uid]').forEach(element => {
    const card = cardForElement(target, element);
    const existing = element.querySelector(':scope > .stamp-sigil[data-stamp-runtime="1"]');

    if (!card || card.type !== 'major' || !stampedIds.has(card.id) || !Array.isArray(card.suits) || !card.suits.length) {
      if (existing) existing.remove();
      return;
    }

    let seal = existing;
    if (!seal) {
      seal = doc.createElement('div');
      seal.className = 'stamp-sigil';
      seal.dataset.stampRuntime = '1';
      element.appendChild(seal);
    }

    const suits = card.suits;
    const primarySuit = suits[0];
    seal.style.background = SUIT_COLOR[primarySuit] || '#888';
    seal.textContent = SUIT_GLYPH[primarySuit] || primarySuit[0];
    seal.title = `Suit Stamp: ${suits.join(', ')}`;
    seal.setAttribute('aria-label', `Suit Stamp: ${suits.join(', ')}`);
  });
}

export function installStampSigils(target = window) {
  const doc = target?.document;
  if (!doc || target.__tlrStampSigilsInstalled) return;
  target.__tlrStampSigilsInstalled = true;
  ensureStyle(doc);

  let frame = 0;
  const schedule = () => {
    if (frame) return;
    frame = target.requestAnimationFrame(() => {
      frame = 0;
      decorate(target);
    });
  };

  const observer = new target.MutationObserver(schedule);
  observer.observe(doc.body, { childList: true, subtree: true });
  schedule();
}

if (typeof window !== 'undefined') installStampSigils(window);
