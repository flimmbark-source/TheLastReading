const STYLE_ID = 'tlr-game-terms-style';
const STYLE_HREF = '/src/styles/gameTerms.css?v=1';
const POPOVER_ID = 'gameTermPopover';
const GLOSSARY_ID = 'gameTermsGlossary';

const EN_TERMS = Object.freeze({
  chips: {
    label: 'Chips',
    icon: '◆',
    category: 'scoring',
    definition: 'Base scoring value before Mult is applied.',
    auto: true,
  },
  mult: {
    label: 'Mult',
    icon: '×',
    category: 'scoring',
    definition: 'Multiplies your Chips to produce your final Score.',
    auto: true,
  },
  score: {
    label: 'Score',
    icon: 'Σ',
    category: 'scoring',
    definition: 'The final scoring value produced by Chips and Mult.',
    auto: true,
  },
  threshold: {
    label: 'Threshold',
    icon: '◇',
    category: 'scoring',
    definition: 'The Score required to clear the current Reading.',
    auto: true,
  },
  reserve: {
    label: 'Reserve',
    icon: '✦',
    category: 'economy',
    definition: 'Currency spent on Market purchases and upgrades.',
    auto: true,
  },
  play: {
    label: 'Play',
    category: 'action',
    definition: 'Move a card from your Hand into an open slot in the Spread.',
    auto: true,
  },
  draw: {
    label: 'Draw',
    category: 'action',
    definition: 'Move card(s) from the Deck into your Hand.',
    auto: true,
  },
  discard: {
    label: 'Discard',
    category: 'action',
    definition: 'Spend a Discard to use a card’s Ability instead of Playing it.',
    auto: true,
  },
  reveal: {
    label: 'Reveal',
    category: 'action',
    definition: 'Show cards without automatically moving them into your Hand.',
    auto: true,
  },
  take: {
    label: 'Take',
    category: 'action',
    definition: 'Move one of the revealed cards into your Hand.',
    auto: true,
  },
  choose: {
    label: 'Choose',
    category: 'instruction',
    definition: 'Select one of the available options.',
    auto: false,
  },
  banish: {
    label: 'Banish',
    category: 'action',
    definition: 'Permanently remove a card from the current Deck or play area, as specified.',
    auto: true,
  },
  echo: {
    label: 'Echo',
    category: 'action',
    definition: 'Add a second copy of the chosen card to your Adventure Deck.',
    auto: false,
  },
  upgrade: {
    label: 'Upgrade',
    category: 'action',
    definition: 'Increase the chosen card’s value by 1.',
    auto: false,
  },
  seal: {
    label: 'Seal',
    category: 'action',
    definition: 'Make the chosen Adventure card appear in every opening Hand at the cost of one Draw slot.',
    auto: false,
  },
  transmute: {
    label: 'Transmute',
    category: 'action',
    definition: 'Change a card’s Adventure sigil.',
    auto: false,
  },
  hand: {
    label: 'Hand',
    category: 'zone',
    definition: 'Cards currently available for you to Play or Discard.',
    auto: true,
  },
  spread: {
    label: 'Spread',
    category: 'zone',
    definition: 'The cards you have Played for the current Reading.',
    auto: true,
  },
  deck: {
    label: 'Deck',
    category: 'zone',
    definition: 'The cards that can still be Drawn.',
    auto: true,
  },
  ability: {
    label: 'Ability',
    category: 'system',
    definition: 'A card effect activated by Discarding that card.',
    auto: true,
  },
  pattern: {
    label: 'Pattern',
    category: 'system',
    definition: 'A qualifying group of cards that grants Chips, Mult, or both.',
    auto: true,
  },
  relic: {
    label: 'Relic',
    category: 'system',
    definition: 'A persistent item that changes the rules or scoring.',
    auto: true,
  },
  status: {
    label: 'Status',
    category: 'system',
    definition: 'A temporary or persistent Adventure effect.',
    auto: true,
  },
  reading: {
    label: 'Reading',
    category: 'system',
    definition: 'One scoring attempt built by Playing cards into the Spread.',
    auto: true,
  },
  resolve: {
    label: 'Resolve',
    category: 'resource',
    definition: 'Adventure endurance. The run ends when Resolve reaches zero.',
    auto: true,
  },
  potency: {
    label: 'Potency',
    category: 'resource',
    definition: 'A card’s strength when resolving an Adventure Event.',
    auto: true,
  },
  event: {
    label: 'Event',
    category: 'system',
    definition: 'An Adventure challenge resolved by Playing a card.',
    auto: true,
  },
  search: {
    label: 'Search',
    category: 'ability',
    definition: 'Look through the Deck, Take a card, then shuffle.',
    auto: false,
  },
  peek: {
    label: 'Peek',
    category: 'ability',
    definition: 'Reveal a limited group of cards and Take one.',
    auto: false,
  },
  neighbor: {
    label: 'Neighbor',
    category: 'ability',
    definition: 'Reveal cards adjacent to a chosen card in sequence.',
    auto: false,
  },
  kin: {
    label: 'Kin',
    category: 'ability',
    definition: 'Reveal cards sharing the chosen card’s Arcana.',
    auto: false,
  },
  between: {
    label: 'Between',
    category: 'ability',
    definition: 'Reveal cards whose values fall between two chosen cards.',
    auto: false,
  },
  mirror: {
    label: 'Mirror',
    category: 'ability',
    definition: 'Find the card opposite a chosen card across its Arcana.',
    auto: false,
  },
});

const localeRegistry = { en: EN_TERMS };
export const GAME_TERM_LOCALES = localeRegistry;
export const GAME_TERMS = EN_TERMS;

const REQUIRED_IDS = Object.freeze(Object.keys(EN_TERMS));
const INTERACTIVE_SELECTOR = 'button,a,input,select,textarea,[role="button"],[role="link"]';
const TITLE_SELECTOR = [
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'legend',
  'caption',
  'th',
  'label',
  '[role="heading"]',
  '.spv2-label',
  '[class*="title"]',
  '[class*="heading"]',
  '[class*="header"]',
  '[class*="label"]',
].join(',');
const SKIP_SELECTOR = [
  '[data-game-terms="off"]',
  '.game-term',
  '.scoring-sheet',
  'script',
  'style',
  'code',
  'pre',
  'textarea',
  '.inv-item-paper',
  '.inv-detail-content',
  '.inv-detail-text-overlay-inner',
  '.archive-source',
  '.adv-narrative',
  '.adv-event-desc',
].join(',');

const MECHANICAL_SURFACES = Object.freeze([
  '#tutText',
  '#abilityPromptText',
  '#modalPrompt',
  '#scoringPanel',
  '#abilitiesPanel',
  '#ref',
  '#abilityRef',
  '#scoringPullWrap',
  '#abilitiesPullWrap',
  '.score-stack',
  '.score-preview',
  '.result-panel',
  '.relic-callout-desc',
  '.store-card-desc',
  '.store-card-name',
  '.store-pack-callout',
  '.ability-description',
  '.ability-prompt',
  '.hint-callout',
  '.adv-rewards',
  '.adv-status-popover',
  '.adv-item-popover',
  '.adv-played-card',
  '.adv-statuschg',
  '.mp-action-panel',
  '.mp-overlay',
  '.mp-prompt',
  '.loadout-desc-text',
  '.loadout-desc-reminder',
]);

let activeLocale = 'en';
let activePopoverAnchor = null;
let scanQueued = false;

function localeTerms(locale = activeLocale) {
  return GAME_TERM_LOCALES[locale] || GAME_TERM_LOCALES.en;
}

export function registerGameTermsLocale(locale, terms) {
  const key = String(locale || '').trim();
  if (!key || !terms || typeof terms !== 'object') return false;
  const merged = {};
  for (const id of REQUIRED_IDS) {
    const base = EN_TERMS[id];
    const translated = terms[id] || {};
    merged[id] = Object.freeze({ ...base, ...translated });
  }
  localeRegistry[key] = Object.freeze(merged);
  return true;
}

export function getGameTerm(id, locale = activeLocale) {
  return localeTerms(locale)[String(id || '').toLowerCase()] || null;
}

export function listGameTerms(locale = activeLocale) {
  return Object.entries(localeTerms(locale)).map(([id, term]) => ({ id, ...term }));
}

export function gameTermMarkup(id, label = '') {
  const key = String(id || '').toLowerCase();
  if (!getGameTerm(key)) throw new Error(`Unknown game term: ${id}`);
  return label ? `[[${key}|${label}]]` : `[[${key}]]`;
}

function ensureStyles(doc) {
  if (!doc || doc.getElementById(STYLE_ID)) return;
  const link = doc.createElement('link');
  link.id = STYLE_ID;
  link.rel = 'stylesheet';
  link.href = STYLE_HREF;
  doc.head.appendChild(link);
}

function makeTermElement(doc, id, label, parent) {
  const term = getGameTerm(id);
  if (!term) return doc.createTextNode(label || `[[${id}]]`);
  const span = doc.createElement('span');
  span.className = `game-term game-term--${term.category} game-term--${id}`;
  span.dataset.termId = id;
  span.dataset.termCategory = term.category;
  span.dataset.termIcon = term.icon || '';
  span.dataset.termCustomLabel = label ? 'true' : 'false';
  span.textContent = label || term.label;
  span.title = term.definition;
  span.setAttribute('aria-label', `${label || term.label}: ${term.definition}`);
  if (!parent?.closest?.(INTERACTIVE_SELECTOR)) {
    span.tabIndex = 0;
    span.setAttribute('role', 'button');
  }
  return span;
}

function explicitParts(text) {
  const parts = [];
  const regex = /\[\[([a-z0-9_-]+)(?:\|([^\]]+))?\]\]/gi;
  let cursor = 0;
  let match;
  while ((match = regex.exec(text))) {
    if (match.index > cursor) parts.push({ text: text.slice(cursor, match.index) });
    parts.push({ id: match[1].toLowerCase(), label: match[2] || '' });
    cursor = regex.lastIndex;
  }
  if (cursor < text.length) parts.push({ text: text.slice(cursor) });
  return parts;
}

function autoRegex() {
  const labels = Object.values(localeTerms())
    .filter(term => term.auto)
    .map(term => term.label)
    .sort((a, b) => b.length - a.length)
    .map(label => label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  return new RegExp(`\\b(${labels.join('|')})\\b`, 'gi');
}

function autoIdForLabel(label) {
  const lower = String(label).toLowerCase();
  return Object.entries(localeTerms()).find(([, term]) => term.auto && term.label.toLowerCase() === lower)?.[0] || null;
}

function plainTitleText(text) {
  return String(text).replace(/\[\[([a-z0-9_-]+)(?:\|([^\]]+))?\]\]/gi, (_match, id, label) => {
    return label || getGameTerm(id)?.label || id;
  });
}

function normalizeTitleSurfaces(root) {
  const surfaces = [];
  if (root?.nodeType === 1 && root.matches?.(TITLE_SELECTOR)) surfaces.push(root);
  root?.querySelectorAll?.(TITLE_SELECTOR).forEach(surface => surfaces.push(surface));

  for (const surface of surfaces) {
    surface.querySelectorAll('.game-term').forEach(term => {
      term.replaceWith(surface.ownerDocument.createTextNode(term.textContent || ''));
    });
    const doc = surface.ownerDocument;
    const showText = doc.defaultView?.NodeFilter?.SHOW_TEXT ?? 4;
    const walker = doc.createTreeWalker(surface, showText);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    for (const node of nodes) {
      const plain = plainTitleText(node.nodeValue || '');
      if (plain !== node.nodeValue) node.nodeValue = plain;
    }
    if (surface.dataset.gameTerms !== 'off') surface.dataset.gameTerms = 'off';
  }
}

function replaceTextNode(node, auto) {
  const text = node.nodeValue || '';
  if (!text || (!text.includes('[[') && !auto)) return false;
  const parent = node.parentElement;
  if (!parent) return false;
  const titleSurface = parent.closest(TITLE_SELECTOR);
  if (titleSurface) {
    const plain = plainTitleText(text);
    if (plain !== text) node.nodeValue = plain;
    if (titleSurface.dataset.gameTerms !== 'off') titleSurface.dataset.gameTerms = 'off';
    return false;
  }
  if (parent.closest(SKIP_SELECTOR)) return false;

  const doc = node.ownerDocument;
  const fragment = doc.createDocumentFragment();
  let changed = false;

  const appendAutoText = value => {
    if (!auto || !value) {
      fragment.appendChild(doc.createTextNode(value));
      return;
    }
    const regex = autoRegex();
    let cursor = 0;
    let match;
    while ((match = regex.exec(value))) {
      if (match.index > cursor) fragment.appendChild(doc.createTextNode(value.slice(cursor, match.index)));
      const id = autoIdForLabel(match[0]);
      if (id) {
        fragment.appendChild(makeTermElement(doc, id, match[0], parent));
        changed = true;
      } else {
        fragment.appendChild(doc.createTextNode(match[0]));
      }
      cursor = regex.lastIndex;
    }
    if (cursor < value.length) fragment.appendChild(doc.createTextNode(value.slice(cursor)));
  };

  for (const part of explicitParts(text)) {
    if (part.id) {
      fragment.appendChild(makeTermElement(doc, part.id, part.label, parent));
      changed = true;
    } else {
      appendAutoText(part.text);
    }
  }

  if (!changed) return false;
  node.replaceWith(fragment);
  return true;
}

export function applyGameTerms(root, options = {}) {
  if (!root) return 0;
  normalizeTitleSurfaces(root);
  const auto = options.auto ?? root.dataset?.gameTerms === 'auto';
  const doc = root.ownerDocument || root;
  const showText = doc.defaultView?.NodeFilter?.SHOW_TEXT ?? 4;
  const walker = doc.createTreeWalker(root, showText);
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  let count = 0;
  for (const node of nodes) if (replaceTextNode(node, auto)) count += 1;
  if (root.dataset) root.dataset.gameTermsReady = 'true';
  return count;
}

function markMechanicalSurfaces(doc) {
  for (const selector of MECHANICAL_SURFACES) {
    doc.querySelectorAll(selector).forEach(element => {
      if (element.closest('[data-game-terms="off"]')) return;
      element.dataset.gameTerms = 'auto';
    });
  }
}

function scanDocument(doc) {
  applyGameTerms(doc.body, { auto: false });
  markMechanicalSurfaces(doc);
  doc.querySelectorAll('[data-game-terms="auto"],[data-game-terms="markup"]').forEach(element => {
    applyGameTerms(element, { auto: element.dataset.gameTerms === 'auto' });
  });
}

function queueScan(target) {
  if (scanQueued) return;
  scanQueued = true;
  target.requestAnimationFrame(() => {
    scanQueued = false;
    scanDocument(target.document);
  });
}

function ensurePopover(doc) {
  let popover = doc.getElementById(POPOVER_ID);
  if (popover) return popover;
  popover = doc.createElement('div');
  popover.id = POPOVER_ID;
  popover.className = 'game-term-popover';
  popover.hidden = true;
  popover.setAttribute('role', 'tooltip');
  popover.innerHTML = '<div class="game-term-popover__title"></div><div class="game-term-popover__definition"></div>';
  doc.body.appendChild(popover);
  return popover;
}

function closePopover(doc) {
  const popover = doc.getElementById(POPOVER_ID);
  if (popover) popover.hidden = true;
  activePopoverAnchor = null;
}

function openPopover(target, anchor) {
  const doc = target.document;
  const id = anchor?.dataset?.termId;
  const term = getGameTerm(id);
  if (!term) return;
  const popover = ensurePopover(doc);
  popover.querySelector('.game-term-popover__title').textContent = term.label;
  popover.querySelector('.game-term-popover__definition').textContent = term.definition;
  popover.hidden = false;
  activePopoverAnchor = anchor;
  const rect = anchor.getBoundingClientRect();
  target.requestAnimationFrame(() => {
    const margin = 10;
    const width = popover.offsetWidth;
    const height = popover.offsetHeight;
    let left = rect.left + rect.width / 2 - width / 2;
    left = Math.max(margin, Math.min(target.innerWidth - width - margin, left));
    let top = rect.bottom + 8;
    if (top + height > target.innerHeight - margin) top = Math.max(margin, rect.top - height - 8);
    popover.style.left = `${left}px`;
    popover.style.top = `${top}px`;
  });
  target.dispatchEvent(new CustomEvent('tlr:term-open', { detail: { termId: id } }));
}

function ensureGlossary(doc) {
  let modal = doc.getElementById(GLOSSARY_ID);
  if (modal) return modal;
  modal = doc.createElement('div');
  modal.id = GLOSSARY_ID;
  modal.className = 'game-terms-glossary';
  modal.hidden = true;
  modal.innerHTML = `
    <div class="game-terms-glossary__panel" role="dialog" aria-modal="true" aria-labelledby="gameTermsGlossaryTitle">
      <button class="game-terms-glossary__close" type="button" aria-label="Close terminology glossary">×</button>
      <h2 id="gameTermsGlossaryTitle">Game Terms</h2>
      <div class="game-terms-glossary__groups"></div>
    </div>`;
  doc.body.appendChild(modal);
  modal.querySelector('.game-terms-glossary__close').addEventListener('click', () => closeGameTermsGlossary(doc.defaultView));
  modal.addEventListener('pointerdown', event => {
    if (event.target === modal) closeGameTermsGlossary(doc.defaultView);
  });
  return modal;
}

function renderGlossary(doc) {
  const modal = ensureGlossary(doc);
  const groups = modal.querySelector('.game-terms-glossary__groups');
  const categoryOrder = ['scoring', 'economy', 'action', 'zone', 'system', 'resource', 'ability', 'instruction'];
  groups.innerHTML = '';
  for (const category of categoryOrder) {
    const terms = listGameTerms().filter(term => term.category === category);
    if (!terms.length) continue;
    const section = doc.createElement('section');
    section.className = `game-terms-glossary__group game-terms-glossary__group--${category}`;
    const title = doc.createElement('h3');
    title.textContent = category === 'zone' ? 'Game Areas' : `${category[0].toUpperCase()}${category.slice(1)}`;
    section.appendChild(title);
    for (const term of terms) {
      const row = doc.createElement('div');
      row.className = 'game-terms-glossary__row';
      const label = makeTermElement(doc, term.id, term.label, row);
      label.removeAttribute('role');
      label.removeAttribute('tabindex');
      row.appendChild(label);
      const definition = doc.createElement('p');
      definition.textContent = term.definition;
      row.appendChild(definition);
      section.appendChild(row);
    }
    groups.appendChild(section);
  }
  return modal;
}

export function openGameTermsGlossary(target = window) {
  const modal = renderGlossary(target.document);
  modal.hidden = false;
  modal.querySelector('.game-terms-glossary__close')?.focus();
  target.dispatchEvent(new CustomEvent('tlr:glossary-open'));
}

export function closeGameTermsGlossary(target = window) {
  const modal = target.document?.getElementById(GLOSSARY_ID);
  if (modal) modal.hidden = true;
}

function ensureGlossaryButton(doc) {
  if (doc.getElementById('gameTermsGlossaryButton')) return;
  const host = doc.getElementById('settingsPanel') || doc.querySelector('#menuPullWrap .settings-panel') || doc.getElementById('menuPullWrap');
  if (!host) return;
  const button = doc.createElement('button');
  button.id = 'gameTermsGlossaryButton';
  button.type = 'button';
  button.className = 'game-terms-glossary-button';
  button.textContent = 'Game Terms';
  button.addEventListener('click', () => openGameTermsGlossary(doc.defaultView));
  host.appendChild(button);
}

export function setGameTermsLocale(locale, target = window) {
  if (!GAME_TERM_LOCALES[locale]) return false;
  activeLocale = locale;
  target.document?.querySelectorAll('.game-term').forEach(element => {
    const term = getGameTerm(element.dataset.termId, locale);
    if (!term) return;
    if (element.dataset.termCustomLabel !== 'true') element.textContent = term.label;
    element.title = term.definition;
    element.setAttribute('aria-label', `${element.textContent}: ${term.definition}`);
  });
  return true;
}

export function installGameTerms(target = window) {
  if (!target?.document || target.__tlrGameTermsInstalled) return;
  target.__tlrGameTermsInstalled = true;
  const doc = target.document;
  ensureStyles(doc);
  ensurePopover(doc);

  target.tlrGameTerms = GAME_TERMS;
  target.tlrGetGameTerm = getGameTerm;
  target.tlrApplyGameTerms = applyGameTerms;
  target.tlrOpenGameTermsGlossary = () => openGameTermsGlossary(target);
  target.tlrCloseGameTermsGlossary = () => closeGameTermsGlossary(target);
  target.tlrSetGameTermsLocale = locale => setGameTermsLocale(locale, target);
  target.tlrRegisterGameTermsLocale = registerGameTermsLocale;

  const activate = event => {
    const element = event.target instanceof Element ? event.target.closest('.game-term') : null;
    if (!element) return;
    if (event.type === 'keydown' && event.key !== 'Enter' && event.key !== ' ') return;
    if (event.type === 'keydown') event.preventDefault();
    openPopover(target, element);
  };
  doc.addEventListener('pointerdown', activate);
  doc.addEventListener('keydown', activate);
  doc.addEventListener('pointerdown', event => {
    const element = event.target instanceof Element ? event.target : null;
    if (!activePopoverAnchor || element?.closest('.game-term') || element?.closest(`#${POPOVER_ID}`)) return;
    closePopover(doc);
  }, true);
  doc.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;
    if (!doc.getElementById(GLOSSARY_ID)?.hidden) closeGameTermsGlossary(target);
    closePopover(doc);
  });

  const observer = new MutationObserver(() => {
    ensureGlossaryButton(doc);
    queueScan(target);
  });
  observer.observe(doc.body, { childList: true, subtree: true, characterData: true });
  target.__tlrGameTermsObserver = observer;
  ensureGlossaryButton(doc);
  queueScan(target);
}

export const GAME_TERM_IDS = REQUIRED_IDS;
