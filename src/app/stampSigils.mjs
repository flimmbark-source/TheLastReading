const STYLE_ID = 'stamp-sigils-style';

// Simple thematic glyphs — rendered as text (no color emoji) so they read
// cleanly at small sizes in the wax-seal style.
const SUIT_GLYPH = Object.freeze({ Cups: '♥', Wands: '✦', Swords: '✠', Pentacles: '★' });

// Dark, rich radial-gradient backgrounds matching the .seal.tr wax-seal look.
const SUIT_GRADIENT = Object.freeze({
  Cups:      'radial-gradient(circle at 35% 35%,#3a6bbf,#152a5c 72%,#070e1e)',
  Wands:     'radial-gradient(circle at 35% 35%,#b85e10,#5c2804 72%,#200e00)',
  Swords:    'radial-gradient(circle at 35% 35%,#4a5f70,#1e2f3c 72%,#0a1218)',
  Pentacles: 'radial-gradient(circle at 35% 35%,#2a6e36,#103018 72%,#051408)',
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
      font: 900 10px/1 Georgia, serif;
      color: #f5e0b4;
      text-shadow: 0 1px 2px rgba(0,0,0,.9);
      border: 1.5px solid rgba(210,175,100,.65);
      box-shadow: 0 1px 4px rgba(0,0,0,.9), 0 0 0 1px rgba(0,0,0,.5);
      pointer-events: none;
      letter-spacing: 0;
    }
    .card-detail-card .card > .stamp-sigil {
      width: 26px;
      height: 26px;
      top: 7px;
      left: 7px;
      font-size: 13px;
      border-width: 2px;
    }
    .stamp-suit-badge {
      display: inline-block;
      width: 36px;
      height: 36px;
      border-radius: 50%;
      background: radial-gradient(circle at 35% 35%,#555,#222 72%,#111);
      color: #f5e0b4;
      font: 900 14px/36px Georgia, serif;
      text-align: center;
      letter-spacing: 0;
      border: 1.5px solid rgba(210,175,100,.5);
      box-shadow: 0 1px 4px rgba(0,0,0,.8);
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
    seal.style.background = SUIT_GRADIENT[primarySuit] || 'radial-gradient(circle at 35% 35%,#555,#222 72%,#111)';
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
