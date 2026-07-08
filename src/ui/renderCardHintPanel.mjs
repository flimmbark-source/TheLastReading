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

const PANEL_STYLE_ID = 'card-hint-panel-plaque-style';

function installPanelStyles(doc){
  if(!doc || doc.getElementById(PANEL_STYLE_ID)) return;
  const style = doc.createElement('style');
  style.id = PANEL_STYLE_ID;
  style.textContent = `
html body.single-player-v2.generated-sheet-ready #patternHintStack.pattern-hint-stack {
  position: fixed !important;
  z-index: 10065 !important;
  display: block !important;
  width: clamp(148px, 39vw, 224px) !important;
  max-width: calc(100vw - 12px) !important;
  padding: 10px 11px 11px !important;
  box-sizing: border-box !important;
  border: 1px solid rgba(224, 181, 91, .78) !important;
  border-radius: 5px !important;
  background:
    radial-gradient(circle at 18% 0%, rgba(255, 215, 120, .13), transparent 48%),
    linear-gradient(180deg, rgba(20, 14, 8, .97), rgba(6, 4, 3, .985)) !important;
  box-shadow:
    0 18px 38px rgba(0, 0, 0, .78),
    0 0 0 1px rgba(64, 40, 16, .95),
    inset 0 0 0 1px rgba(255, 231, 150, .11),
    0 0 22px rgba(255, 185, 70, .16) !important;
  opacity: 0;
  pointer-events: none !important;
  transform: none !important;
  bottom: auto !important;
  transition: opacity .12s ease !important;
}
html body.single-player-v2.generated-sheet-ready #patternHintStack.pattern-hint-stack.is-visible {
  opacity: 1;
}
html body.single-player-v2.generated-sheet-ready #patternHintStack.pattern-hint-stack::before {
  content: "";
  position: absolute;
  left: -7px;
  top: 44%;
  width: 12px;
  height: 12px;
  transform: rotate(45deg);
  background: rgba(8, 5, 3, .98);
  border-left: 1px solid rgba(224, 181, 91, .78);
  border-bottom: 1px solid rgba(224, 181, 91, .78);
  box-shadow: -2px 2px 8px rgba(0, 0, 0, .35);
}
html body.single-player-v2.generated-sheet-ready #patternHintStack.pattern-hint-stack.point-right::before {
  left: auto;
  right: -7px;
  border-left: 0;
  border-bottom: 0;
  border-right: 1px solid rgba(224, 181, 91, .78);
  border-top: 1px solid rgba(224, 181, 91, .78);
  box-shadow: 2px -2px 8px rgba(0, 0, 0, .35);
}
html body.single-player-v2.generated-sheet-ready #patternHintStack.pattern-hint-stack .chp-value,
html body.single-player-v2.generated-sheet-ready #patternHintStack.pattern-hint-stack .chp-pattern,
html body.single-player-v2.generated-sheet-ready #patternHintStack.pattern-hint-stack .chp-discard {
  display: grid !important;
  grid-template-columns: 24px minmax(0, 1fr) !important;
  align-items: center !important;
  min-height: 29px !important;
  margin: 0 !important;
  padding: 0 !important;
  border: 0 !important;
  border-top: 1px solid rgba(224, 181, 91, .17) !important;
  border-radius: 0 !important;
  background: transparent !important;
  box-shadow: none !important;
  color: #ead8aa !important;
  font: 600 12px/1.12 Georgia, "Times New Roman", serif !important;
  letter-spacing: .01em !important;
  text-shadow: 0 1px 2px rgba(0, 0, 0, .85) !important;
  white-space: nowrap !important;
  overflow: hidden !important;
  text-overflow: ellipsis !important;
}
html body.single-player-v2.generated-sheet-ready #patternHintStack.pattern-hint-stack .chp-value {
  min-height: 28px !important;
  border-top: 0 !important;
  color: #f5dfaa !important;
  font: 700 13px/1 "Cinzel", Georgia, serif !important;
  letter-spacing: .03em !important;
  text-shadow: 0 1px 3px rgba(0, 0, 0, .85), 0 0 10px rgba(255, 210, 120, .35) !important;
}
html body.single-player-v2.generated-sheet-ready #patternHintStack.pattern-hint-stack .chp-pattern.is-complete {
  color: #fff0c8 !important;
}
html body.single-player-v2.generated-sheet-ready #patternHintStack.pattern-hint-stack .chp-discard {
  color: #d8c08a !important;
  font-size: 10.5px !important;
  letter-spacing: .025em !important;
}
html body.single-player-v2.generated-sheet-ready #patternHintStack.pattern-hint-stack .chp-value::before,
html body.single-player-v2.generated-sheet-ready #patternHintStack.pattern-hint-stack .chp-pattern::before,
html body.single-player-v2.generated-sheet-ready #patternHintStack.pattern-hint-stack .chp-discard::before {
  display: block;
  width: 24px;
  text-align: center;
  color: #d6a952;
  text-shadow: 0 0 8px rgba(226, 184, 95, .4), 0 1px 2px #000;
}
html body.single-player-v2.generated-sheet-ready #patternHintStack.pattern-hint-stack .chp-value::before { content: "✴"; }
html body.single-player-v2.generated-sheet-ready #patternHintStack.pattern-hint-stack .chp-pattern::before { content: "♜"; }
html body.single-player-v2.generated-sheet-ready #patternHintStack.pattern-hint-stack .chp-discard::before { content: "✦"; opacity: .72; }
html body.single-player-v2.generated-sheet-ready #patternHintStack.pattern-hint-stack .chp-mods {
  display: flex !important;
  gap: 12px !important;
  align-items: center !important;
  justify-content: center !important;
  margin: 3px 0 0 !important;
  padding: 9px 0 0 !important;
  border-top: 1px solid rgba(224, 181, 91, .17) !important;
}
html body.single-player-v2.generated-sheet-ready #patternHintStack.pattern-hint-stack .chp-mod {
  display: inline-flex !important;
  align-items: center !important;
  justify-content: center !important;
  width: 26px !important;
  height: 26px !important;
  min-width: 26px !important;
  padding: 0 !important;
  border-radius: 50% !important;
  border: 1px solid rgba(226, 184, 95, .78) !important;
  background:
    radial-gradient(circle at 40% 35%, rgba(255, 218, 130, .25), rgba(55, 32, 13, .95) 68%),
    #120b06 !important;
  color: #f1d28a !important;
  font: 700 13px/26px Georgia, "Times New Roman", serif !important;
  text-align: center !important;
  text-shadow: 0 1px 2px rgba(0, 0, 0, .85) !important;
  box-shadow:
    0 3px 8px rgba(0, 0, 0, .65),
    inset 0 0 0 2px rgba(0, 0, 0, .4),
    0 0 9px rgba(220, 170, 70, .25) !important;
}
@media (max-width: 640px) {
  html body.single-player-v2.generated-sheet-ready #patternHintStack.pattern-hint-stack {
    width: clamp(144px, 39vw, 168px) !important;
    padding: 9px 10px 10px !important;
  }
  html body.single-player-v2.generated-sheet-ready #patternHintStack.pattern-hint-stack .chp-value,
  html body.single-player-v2.generated-sheet-ready #patternHintStack.pattern-hint-stack .chp-pattern,
  html body.single-player-v2.generated-sheet-ready #patternHintStack.pattern-hint-stack .chp-discard {
    grid-template-columns: 22px minmax(0, 1fr) !important;
    min-height: 27px !important;
    font-size: 11px !important;
  }
  html body.single-player-v2.generated-sheet-ready #patternHintStack.pattern-hint-stack .chp-value {
    font-size: 12px !important;
  }
  html body.single-player-v2.generated-sheet-ready #patternHintStack.pattern-hint-stack .chp-mods {
    gap: 9px !important;
  }
  html body.single-player-v2.generated-sheet-ready #patternHintStack.pattern-hint-stack .chp-mod {
    width: 23px !important;
    height: 23px !important;
    min-width: 23px !important;
    font-size: 12px !important;
    line-height: 23px !important;
  }
}
`;
  doc.head.appendChild(style);
}

function formatValue(n){
  const v = Number(n);
  if(!Number.isFinite(v)) return null;
  return v >= 0 ? `+${v}` : `${v}`;
}

export function installCardHintPanel(target = window){
  if(!target || target.__cardHintPanelInstalled) return;
  const doc = target.document;
  if(!doc) return;
  installPanelStyles(doc);
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

  // Anchor beside the active card at every breakpoint. The panel prefers the
  // card's right edge (matching the reference) and only flips left for cards
  // already living in the far-right portion of the viewport.
  const positionOnce = cardEl => {
    const card = cardEl.getBoundingClientRect();
    const rect = panel.getBoundingClientRect();
    const margin = 6;
    const gap = target.innerWidth <= 640 ? 8 : 10;
    const maxLeft = Math.max(margin, target.innerWidth - rect.width - margin);
    const preferredRight = card.right + gap;
    const preferredLeft = card.left - rect.width - gap;
    const enoughRight = preferredRight <= maxLeft;
    const enoughLeft = preferredLeft >= margin;
    const shouldFlipLeft = !enoughRight && enoughLeft && card.left > target.innerWidth * .55;

    let left;
    if(shouldFlipLeft){
      left = preferredLeft;
      panel.classList.add('point-right');
    }else{
      left = Math.min(preferredRight, maxLeft);
      panel.classList.remove('point-right');
    }

    let top = card.top + card.height * .12;
    if(target.innerWidth <= 640) top = card.top + card.height * .08;
    top = Math.max(margin, Math.min(top, target.innerHeight - rect.height - margin));

    panel.style.left = `${Math.round(Math.max(margin, Math.min(left, maxLeft)))}px`;
    panel.style.top = `${Math.round(top)}px`;
    panel.style.removeProperty('bottom');
  };

  // A freshly selected card lifts over ~0.18s, so its rect is still mid-animation
  // on the first pass; re-anchor once the transition settles (and only if this
  // card is still the active one) so the panel doesn't land on top of it.
  const position = cardEl => {
    positionOnce(cardEl);
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
    panel.classList.remove('point-right');
    if(panel.dataset.key){
      panel.dataset.key = '';
      panel.replaceChildren();
    }
    panel.style.removeProperty('left');
    panel.style.removeProperty('top');
    panel.style.removeProperty('bottom');
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
