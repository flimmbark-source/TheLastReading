// Contextual card hint panel (single-player readings). Replaces the old
// one-line pattern pill with a compact "decision lens" anchored to the active
// hand card: a placement value, a few pattern rows with progress, the card's
// discard ability, and symbolic modifier icons.
//
// The panel's data is produced once per render by applyHint() (renderHints.mjs)
// and serialized onto the card element as data-hint-panel; this module only
// picks the active card, reads that payload, computes the live placement delta
// for the selected card, and paints the fixed #patternHintStack element (kept
// under <body>, free of any card transform, so it can be positioned freely).
// The element id is retained from the earlier pattern-stack so its tuned mobile
// placement CSS carries over unchanged.
import { scorePreview as selectScorePreview } from '../game/selectors.mjs';

// Only ever the player's own hand card, and only via states that mean "I'm
// considering this card" — never spread/ability/choice cards, which belong to
// targeting flows the panel hides for.
const ACTIVE_SELECTOR = '.hand .card.sel[data-hint-panel], .hand .card.press-highlight[data-hint-panel]';

function formatValue(n){
  const v = Number(n);
  if(!Number.isFinite(v)) return null;
  return v >= 0 ? `+${v}` : `${v}`;
}

export function installCardHintPanel(target = window){
  if(!target || target.__cardHintPanelInstalled) return;
  const doc = target.document;
  if(!doc) return;
  const panel = doc.getElementById('patternHintStack');
  if(!panel) return;
  target.__cardHintPanelInstalled = true;

  const textHintsEnabled = () => {
    const settings = (target.tlrRuntime && target.tlrRuntime.hintSettings) || target.hintSettings;
    return !settings || settings.patternText !== false;
  };

  // Purge and ability targeting own the board; the decision-lens panel steps
  // aside so it never competes with those flows' own prompts/highlights.
  const isTargeting = () => {
    const run = target.tlrStore?.getState?.()?.run;
    if(run && (run.ability?.targeting || run.purge != null)) return true;
    const legacy = target.state;
    if(legacy && (legacy.abilitySelect || (legacy.purgeSelect != null))) return true;
    return false;
  };

  // scorePreview is defined for the store's selected card; use its delta only
  // when the active card IS that selection. Otherwise (a press without select,
  // or no store) fall back to the card's own base points.
  const placementValue = (cardEl, payload) => {
    if(cardEl.classList.contains('sel')){
      const state = target.tlrStore?.getState?.();
      if(state){
        try{
          const preview = selectScorePreview(state);
          if(preview && Number.isFinite(preview.delta)) return preview.delta;
        }catch{ /* fall through to base */ }
      }
    }
    return payload.base;
  };

  const row = (cls, text) => {
    const el = doc.createElement('div');
    el.className = cls;
    el.textContent = text;
    return el;
  };

  const buildRows = (payload, cardEl) => {
    const frag = doc.createDocumentFragment();

    const value = formatValue(placementValue(cardEl, payload));
    if(value != null) frag.appendChild(row('chp-value', value));

    for(const pat of payload.patterns || []){
      const el = row('pattern-hint-line chp-pattern', pat.have && pat.need
        ? `${pat.label} (${pat.have}/${pat.need})`
        : pat.label);
      if(pat.level === 'complete') el.classList.add('is-complete');
      frag.appendChild(el);
    }

    if(payload.discard) frag.appendChild(row('chp-discard', `Discard: ${payload.discard}`));

    if(Array.isArray(payload.modifiers) && payload.modifiers.length){
      const mods = doc.createElement('div');
      mods.className = 'chp-mods';
      for(const mod of payload.modifiers){
        const chip = doc.createElement('span');
        chip.className = 'chp-mod';
        chip.textContent = mod.icon;
        mods.appendChild(chip);
      }
      frag.appendChild(mods);
    }
    return frag;
  };

  const isDesktop = () => {
    try{ return target.matchMedia('(min-width: 641px)').matches; }
    catch{ return false; }
  };

  // Mobile keeps the tuned bottom-gap placement owned by CSS. Desktop anchors
  // the panel just above the active card, clamped inside the viewport.
  const positionOnce = cardEl => {
    if(!isDesktop()){
      panel.style.removeProperty('left');
      panel.style.removeProperty('top');
      return;
    }
    const card = cardEl.getBoundingClientRect();
    const rect = panel.getBoundingClientRect();
    const margin = 8;
    let left = card.left + card.width / 2 - rect.width / 2;
    left = Math.max(margin, Math.min(left, target.innerWidth - rect.width - margin));
    let top = card.top - rect.height - margin;
    if(top < margin) top = Math.min(card.bottom + margin, target.innerHeight - rect.height - margin);
    panel.style.left = `${Math.round(left)}px`;
    panel.style.top = `${Math.round(top)}px`;
  };

  // A freshly selected card lifts over ~0.18s, so its rect is still mid-animation
  // on the first pass; re-anchor once the transition settles (and only if this
  // card is still the active one) so the panel doesn't land on top of it.
  const position = cardEl => {
    positionOnce(cardEl);
    if(!isDesktop()) return;
    cardEl.addEventListener('transitionend', function reanchor(){
      cardEl.removeEventListener('transitionend', reanchor);
      if(doc.querySelector(ACTIVE_SELECTOR) === cardEl) positionOnce(cardEl);
    }, { once: true });
    target.setTimeout(() => {
      if(doc.querySelector(ACTIVE_SELECTOR) === cardEl) positionOnce(cardEl);
    }, 220);
  };

  const hide = () => {
    if(panel.classList.contains('is-visible')) panel.classList.remove('is-visible');
    if(panel.dataset.key){
      panel.dataset.key = '';
      panel.replaceChildren();
    }
    panel.style.removeProperty('left');
    panel.style.removeProperty('top');
  };

  let frame = 0;
  const render = () => {
    frame = 0;
    if(!textHintsEnabled() || isTargeting()){ hide(); return; }
    const cardEl = doc.querySelector(ACTIVE_SELECTOR);
    const raw = cardEl ? cardEl.dataset.hintPanel : null;
    if(!raw){ hide(); return; }
    let payload;
    try{ payload = JSON.parse(raw); }
    catch{ hide(); return; }

    // Rebuild only when the underlying card/payload changes; the live placement
    // value is part of the key so a re-score refreshes the top row.
    const key = `${cardEl.dataset.uid || ''}|${placementValue(cardEl, payload)}|${raw}`;
    if(panel.dataset.key !== key){
      panel.dataset.key = key;
      panel.replaceChildren(buildRows(payload, cardEl));
    }
    panel.classList.add('is-visible');
    position(cardEl);
  };
  const schedule = () => { if(!frame) frame = target.requestAnimationFrame(render); };

  const observer = new target.MutationObserver(schedule);
  const observe = id => {
    const node = doc.getElementById(id);
    if(node) observer.observe(node, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['class', 'data-hint-panel'],
    });
  };
  observe('hand');
  observe('spread');

  target.addEventListener('resize', schedule);
  target.__cardHintPanelRefresh = schedule;
  schedule();
}
