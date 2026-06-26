const STYLE_LINK_ID = 'adventure-event-hero-v2-style';
const STYLE_HREF = '/src/styles/adventureEventHeroV2.css?v=2';

export const EVENT_HERO_SPRITES = Object.freeze({
  iron_gate: { page: 1, row: 0 },
  ambush: { page: 1, row: 1 },
  strange_shrine: { page: 1, row: 2 },
  flooded_road: { page: 1, row: 3 },
  cornered_beast: { page: 2, row: 0 },
  traveling_merchant: { page: 2, row: 1 },
  suspicious_villagers: { page: 2, row: 2 },
  unmarked_grave: { page: 2, row: 3 },
  beneath_the_floor: { page: 3, row: 0 },
  whispering_tree: { page: 3, row: 1 },
  recovery_camp: { page: 3, row: 2 },
  woman_in_the_well: { page: 3, row: 3 },
});

const ROW_POSITIONS = ['0%', '33.333%', '66.667%', '100%'];

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, ch => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]
  ));
}

function ensureStylesheet(doc) {
  if (!doc) return;
  const existing = doc.getElementById(STYLE_LINK_ID);
  if (existing) {
    if (!existing.href.endsWith('adventureEventHeroV2.css?v=2')) existing.href = STYLE_HREF;
    return;
  }
  const link = doc.createElement('link');
  link.id = STYLE_LINK_ID;
  link.rel = 'stylesheet';
  link.href = STYLE_HREF;
  doc.head.appendChild(link);
}

function heroMarkup(deck) {
  const eventId = deck.dataset.eventId || '';
  const sprite = EVENT_HERO_SPRITES[eventId];
  if (!sprite) return null;

  const title = deck.querySelector('.adv-deck__art')?.getAttribute('alt')
    || deck.querySelector('.adv-deck__title')?.textContent
    || eventId.replaceAll('_', ' ');
  const description = deck.querySelector('.adv-event-desc')?.textContent || '';
  const nextText = deck.querySelector('.adv-next-event')?.textContent || '';
  const image = `/Events-page${sprite.page}.png`;
  const row = ROW_POSITIONS[sprite.row] || '0%';

  return `<section class="adv-encounter" aria-label="${esc(title)}">
    <div class="adv-encounter__scene" style="background-image:url('${image}');--adv-event-row:${row}" aria-hidden="true"></div>
    <h2 class="adv-encounter__title">${esc(title)}</h2>
    <div class="adv-encounter__copy">${esc(description)}</div>
    ${nextText ? `<div class="adv-encounter__next">${esc(nextText)}</div>` : ''}
  </section>`;
}

function syncLayout(target, deck) {
  if (!target?.document?.body?.classList.contains('mode-adventure')) return;
  const encounter = deck?.querySelector(':scope > .adv-encounter');
  if (!encounter) return;

  const rect = encounter.getBoundingClientRect();
  if (!rect.height) return;

  const actionGap = target.innerWidth <= 640 ? 18 : 22;
  const actionHeight = target.innerWidth <= 640 ? 66 : 72;
  const actionTop = Math.ceil(rect.bottom + actionGap);
  target.document.body.style.setProperty('--adv-action-top', `${actionTop}px`);
  target.document.body.style.setProperty('--adv-spread-top', `${actionTop + actionHeight}px`);
}

function upgradeDeck(target, deck) {
  if (!deck || deck.querySelector(':scope > .adv-encounter')) return false;
  const markup = heroMarkup(deck);
  if (!markup) return false;
  deck.innerHTML = markup;
  target.requestAnimationFrame(() => syncLayout(target, deck));
  return true;
}

export function installAdventureEventHero(target = window) {
  const doc = target?.document;
  if (!doc || target.__tlrAdventureEventHeroInstalled) return;
  target.__tlrAdventureEventHeroInstalled = true;
  ensureStylesheet(doc);

  const observeDeck = deck => {
    if (!deck || deck.__tlrAdventureHeroObserved) return;
    deck.__tlrAdventureHeroObserved = true;

    const schedule = () => target.requestAnimationFrame(() => syncLayout(target, deck));
    const observer = new target.MutationObserver(() => {
      upgradeDeck(target, deck);
      schedule();
    });
    observer.observe(deck, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['data-event-id'],
    });

    if (target.ResizeObserver) {
      const resizeObserver = new target.ResizeObserver(schedule);
      resizeObserver.observe(deck);
    }
    target.addEventListener('resize', schedule, { passive: true });

    upgradeDeck(target, deck);
    schedule();
  };

  const mountObserver = new target.MutationObserver(() => {
    observeDeck(doc.getElementById('advEventDeck'));
  });
  mountObserver.observe(doc.body, { childList: true, subtree: true });
  observeDeck(doc.getElementById('advEventDeck'));
}

if (typeof window !== 'undefined') installAdventureEventHero(window);
