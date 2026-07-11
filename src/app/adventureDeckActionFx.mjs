// Visual confirmation for Adventure rewards that permanently change the deck.
// This module observes the existing picker confirmation. Reward callbacks remain
// owned by adventureModeV3.mjs and run normally after this capture-phase listener.

const STYLE_ID = 'adventure-deck-action-fx-style';
const STAGE_ID = 'advDeckActionStage';
const STYLE_HREF = '/src/styles/presentation/adventureDeckActionFx.css?v=1';

const LABELS = Object.freeze({
  echo: 'Echoed into the Deck',
  upgrade: 'Card Strengthened',
  seal: 'Card Sealed',
  banish: 'Card Banished',
  transmute: 'Sigil Transmuted',
});

const GLYPHS = Object.freeze({
  echo: '×2',
  upgrade: '+1',
  seal: '◆',
  banish: '×',
  transmute: '∿',
});

function ensureStyles(doc) {
  if (doc.getElementById(STYLE_ID)) return;
  const link = doc.createElement('link');
  link.id = STYLE_ID;
  link.rel = 'stylesheet';
  link.href = STYLE_HREF;
  doc.head.appendChild(link);
}

function inferKind(card, doc) {
  const effect = card?.querySelector('.adv-reward-card-effect');
  const className = effect?.className || '';
  for (const kind of Object.keys(LABELS)) {
    if (className.includes(`adv-reward-card-effect--${kind}`)) return kind;
  }
  const title = doc.getElementById('modalTitle')?.textContent?.toLowerCase() || '';
  if (title.includes('echo')) return 'echo';
  if (title.includes('upgrade')) return 'upgrade';
  if (title.includes('seal')) return 'seal';
  if (title.includes('banish')) return 'banish';
  if (title.includes('transmut')) return 'transmute';
  return null;
}

function cleanClone(card) {
  const clone = card.cloneNode(true);
  clone.removeAttribute('id');
  clone.removeAttribute('tabindex');
  clone.removeAttribute('aria-pressed');
  clone.removeAttribute('data-uid');
  clone.disabled = true;
  clone.setAttribute('aria-hidden', 'true');
  clone.querySelectorAll('[id]').forEach(node => node.removeAttribute('id'));
  clone.querySelectorAll('.adv-reward-card-effect').forEach(node => node.remove());
  clone.classList.remove('adv-reward-card-selected');
  return clone;
}

function particlesMarkup() {
  return Array.from({ length: 12 }, (_, index) => {
    const angle = `${index * 30}deg`;
    const delay = `${80 + (index % 4) * 24}ms`;
    return `<span class="adv-deck-action-particle" style="--a:${angle};--d:${delay}"></span>`;
  }).join('');
}

function soundFor(kind) {
  if (kind === 'echo') return 'draw';
  if (kind === 'banish') return 'discard';
  return 'relic';
}

function hapticFor(kind) {
  if (kind === 'banish') return [0, 22, 34, 12];
  if (kind === 'seal') return [0, 12, 28, 24];
  if (kind === 'echo') return [0, 8, 24, 8];
  return [0, 10, 28, 14];
}

function showDeckAction(target, kind, selectedCard) {
  const doc = target.document;
  doc.getElementById(STAGE_ID)?.remove();

  const rect = selectedCard.getBoundingClientRect();
  const width = Math.max(86, Math.min(150, rect.width || 124));
  const height = Math.max(126, Math.min(220, rect.height || 184));
  const clone = cleanClone(selectedCard);
  clone.classList.add('adv-deck-action-card');

  const stage = doc.createElement('div');
  stage.id = STAGE_ID;
  stage.className = 'adv-deck-action-stage';
  stage.dataset.kind = kind;
  stage.style.setProperty('--deck-fx-card-w', `${width}px`);
  stage.style.setProperty('--deck-fx-card-h', `${height}px`);
  stage.setAttribute('aria-hidden', 'true');

  const cardWrap = doc.createElement('div');
  cardWrap.className = 'adv-deck-action-card-wrap';
  cardWrap.appendChild(clone);
  stage.appendChild(cardWrap);

  if (kind === 'echo') {
    const twinWrap = doc.createElement('div');
    twinWrap.className = 'adv-deck-action-twin-wrap';
    const twin = cleanClone(selectedCard);
    twin.classList.add('adv-deck-action-twin');
    twinWrap.appendChild(twin);
    stage.appendChild(twinWrap);
  }

  const deck = doc.createElement('div');
  deck.className = 'adv-deck-action-deck';
  deck.innerHTML = '<span class="adv-deck-action-deck-card"></span><span class="adv-deck-action-deck-label">Your Deck</span>';
  stage.appendChild(deck);

  const title = doc.createElement('div');
  title.className = 'adv-deck-action-title';
  title.textContent = LABELS[kind];
  stage.appendChild(title);

  const glyph = doc.createElement('div');
  glyph.className = 'adv-deck-action-glyph';
  glyph.textContent = GLYPHS[kind];
  stage.appendChild(glyph);

  const particles = doc.createElement('div');
  particles.className = 'adv-deck-action-particles';
  particles.innerHTML = particlesMarkup();
  stage.appendChild(particles);

  doc.body.appendChild(stage);
  target.requestAnimationFrame(() => stage.classList.add('is-active'));

  target.setTimeout(() => {
    target.playSound?.(soundFor(kind));
    target.haptic?.(hapticFor(kind));
  }, 90);

  const reduced = target.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
  target.setTimeout(() => {
    stage.classList.remove('is-active');
    target.setTimeout(() => stage.remove(), reduced ? 60 : 150);
  }, reduced ? 170 : 1080);
}

export function installAdventureDeckActionFx(target = window) {
  if (!target?.document || target.__tlrAdventureDeckActionFxInstalled) return;
  target.__tlrAdventureDeckActionFxInstalled = true;
  ensureStyles(target.document);

  const onClick = event => {
    if (!(event.target instanceof Element)) return;
    const confirm = event.target.closest('.adv-reward-card-actions .btn-gold');
    if (!confirm || confirm.disabled) return;
    const modal = confirm.closest('#modal.ability-reveal.show');
    const selected = modal?.querySelector('.choice-card.adv-reward-card-selected');
    if (!selected) return;
    const kind = inferKind(selected, target.document);
    if (!kind) return;
    showDeckAction(target, kind, selected);
  };

  target.document.addEventListener('click', onClick, true);
  target.__tlrAdventureDeckActionFxDestroy = () => {
    target.document.removeEventListener('click', onClick, true);
    target.document.getElementById(STAGE_ID)?.remove();
    target.__tlrAdventureDeckActionFxInstalled = false;
  };
}
