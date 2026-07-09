// Single-player pattern-hint stack. Mirrors the pattern-completion labels of
// the currently pressed/ability-focused card into the fixed #patternHintStack
// panel (game.html), which CSS pins into the gap between the two bottom utility
// medallion sets on mobile. Each pattern renders on its own line, replacing the
// classic "pattern + pattern" pill that floats above the card.
//
// A real element is required because that classic pill is a card ::after and so
// is trapped inside the card's transformed ancestor -- position:fixed on it
// resolves against the card, not the viewport, so it can't reach the medallion
// gap. This element lives directly under <body>, free of any transform.
//
// Press state is owned by gesturePressHighlight.mjs. When a card is actively
// pressed, that card is the only possible hint source. This avoids the stale
// selected-card path where `.hand .card.sel` briefly wins while a new press is
// resolving into the next selection.

const FALLBACK_SELECTOR = [
  '.hand .card.ability-picked[data-hint-lines]',
  '.spread .card.press-highlight[data-hint-lines]',
  '.spread .card.ability-picked[data-hint-lines]',
  '.spread .card.ability-target.press-highlight[data-hint-lines]',
  '.choices .card.press-highlight[data-hint-lines]',
].join(',');

const ACTIVE_PRESS_EVENT = 'tlr:active-press-card-change';

function escapeAttrValue(target,value){
  const raw=String(value);
  const esc=target.CSS&&typeof target.CSS.escape==='function'?target.CSS.escape(raw):raw.replace(/["\\]/g,'\\$&');
  return esc;
}

function activePressedCard(doc,target){
  const uid=target.__tlrActivePressCardUid;
  if(uid==null||uid==='')return { hasActivePress:false, card:null };
  const escaped=escapeAttrValue(target,uid);
  const card=doc.querySelector(`.card.press-highlight[data-uid="${escaped}"][data-hint-lines]`);
  return { hasActivePress:true, card };
}

export function installPatternHintStack(target = window){
  if(!target || target.__patternHintStackInstalled)return;
  const doc = target.document;
  if(!doc)return;
  const stack = doc.getElementById('patternHintStack');
  if(!stack)return;
  target.__patternHintStackInstalled = true;

  // The stack follows the "Text" scoring-hint level directly rather than only
  // the card's data-hint-lines attribute: the hand renderer reuses card
  // elements by uid, so lowering the level (Text -> Glow/None) leaves stale
  // attributes on cards that still had hints, and pressing one would otherwise
  // re-show the panel after the setting was turned off.
  const textHintsEnabled = () => {
    const settings = (target.tlrRuntime && target.tlrRuntime.hintSettings) || target.hintSettings;
    return !settings || settings.patternText !== false;
  };

  let frame = 0;
  const render = () => {
    frame = 0;
    let card = null;
    if(textHintsEnabled()){
      const pressed=activePressedCard(doc,target);
      card = pressed.hasActivePress ? pressed.card : doc.querySelector(FALLBACK_SELECTOR);
    }
    const lines = card ? (card.dataset.hintLines || '').split('\n').filter(Boolean) : [];
    const key = lines.join('\n');
    if(stack.dataset.key !== key){
      stack.dataset.key = key;
      if(!lines.length){
        stack.replaceChildren();
      }else{
        const frag = doc.createDocumentFragment();
        for(const label of lines){
          const line = doc.createElement('div');
          line.className = 'pattern-hint-line';
          line.textContent = label;
          frag.appendChild(line);
        }
        stack.replaceChildren(frag);
      }
    }
    stack.classList.toggle('is-visible', lines.length > 0);
  };
  const schedule = () => { if(!frame)frame = target.requestAnimationFrame(render); };

  const observer = new target.MutationObserver(schedule);
  const observeContainer = id => {
    const node = doc.getElementById(id);
    if(node)observer.observe(node, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['class', 'data-hint-lines'],
    });
  };
  observeContainer('hand');
  observeContainer('spread');
  observeContainer('choices');
  target.addEventListener(ACTIVE_PRESS_EVENT,schedule);

  target.__patternHintStackRefresh = schedule;
  schedule();
}
