const STYLE_ID = 'stamp-sigils-style';

const SUIT_BADGE_CHAR = Object.freeze({ Cups: 'C', Wands: 'W', Swords: 'S', Pentacles: 'P' });
const SUIT_COLOR = Object.freeze({
  Cups: '#3a7fd5',
  Wands: '#c97c2a',
  Swords: '#6b8fa8',
  Pentacles: '#4a8f5a',
});

function ensureStyle(doc) {
  if (!doc || doc.getElementById(STYLE_ID)) return;
  const style = doc.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    .card > .stamp-sigil {
      position: absolute;
      bottom: 4px;
      left: 4px;
      width: 15px;
      height: 15px;
      border-radius: 50%;
      z-index: 20;
      display: flex;
      align-items: center;
      justify-content: center;
      font: 900 7px/1 Arial, sans-serif;
      color: #fff;
      border: 1px solid rgba(255,255,255,.55);
      box-shadow: 0 1px 3px rgba(0,0,0,.8);
      pointer-events: none;
      letter-spacing: 0;
    }
    .card-detail-card .card > .stamp-sigil {
      width: 22px;
      height: 22px;
      bottom: 7px;
      left: 7px;
      font-size: 10px;
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
    const badge = suits.map(s => SUIT_BADGE_CHAR[s] || s[0]).join('/');
    seal.style.background = SUIT_COLOR[primarySuit] || '#888';
    seal.textContent = badge;
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
