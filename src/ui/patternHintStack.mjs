// Single-player pattern-hint stack. Mirrors the pattern-completion labels of
// the currently selected/pressed card into the fixed #patternHintStack panel
// (game.html), which CSS pins into the gap between the two bottom utility
// medallion sets on mobile. Each pattern renders on its own line, replacing the
// classic "pattern + pattern" pill that floats above the card.
//
// A real element is required because that classic pill is a card ::after and so
// is trapped inside the card's transformed ancestor -- position:fixed on it
// resolves against the card, not the viewport, so it can't reach the medallion
// gap. This element lives directly under <body>, free of any transform.
//
// The active card is whichever card would currently show the classic pill; the
// selector list mirrors hand.css's own ::after opacity triggers so the panel
// appears and disappears in lockstep with that pill's show/hide states.

const ACTIVE_SELECTOR = [
  '.hand .card.sel[data-hint-lines]',
  '.hand .card.press-highlight[data-hint-lines]',
  '.hand .card.ability-picked[data-hint-lines]',
  '.spread .card.press-highlight[data-hint-lines]',
  '.spread .card.ability-picked[data-hint-lines]',
  '.spread .card.ability-target.press-highlight[data-hint-lines]',
  '.choices .card.press-highlight[data-hint-lines]',
].join(',');

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
    const card = textHintsEnabled() ? doc.querySelector(ACTIVE_SELECTOR) : null;
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

  target.__patternHintStackRefresh = schedule;
  schedule();
}
