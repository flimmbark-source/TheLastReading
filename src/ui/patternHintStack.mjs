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

const ADVENTURE_ACTIVE_SELECTOR = [
  '.hand .card.sel[data-hint]',
  '.hand .card.press-highlight[data-hint]',
  '.hand .card.ability-picked[data-hint]',
  '.spread .card.press-highlight[data-hint]',
  '.spread .card.ability-picked[data-hint]',
  '.spread .card.ability-target.press-highlight[data-hint]',
  '.choices .card.press-highlight[data-hint]',
].join(',');

const ADVENTURE_STYLE_ID = 'adventure-hint-stack-style';

function ensureAdventureHintStackStyle(doc){
  if(!doc || doc.getElementById(ADVENTURE_STYLE_ID))return;
  const style = doc.createElement('style');
  style.id = ADVENTURE_STYLE_ID;
  style.textContent = `
    body.mode-adventure.single-player-v2.generated-sheet-ready .pattern-hint-stack {
      position: fixed;
      left: 50%;
      top: calc(20px + clamp(132px, 36vw, 178px) + 3px);
      bottom: auto;
      transform: translate(-50%, -100%);
      z-index: 121;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 2px;
      max-width: 190px;
      pointer-events: none;
      opacity: 0;
      transition: opacity .12s ease;
    }

    body.mode-adventure.single-player-v2.generated-sheet-ready .pattern-hint-stack.is-visible {
      opacity: 1;
    }

    body.mode-adventure.single-player-v2.generated-sheet-ready .pattern-hint-stack .pattern-hint-line {
      border-color: rgba(116, 169, 213, .75);
      color: #d9edff;
      box-shadow:
        0 6px 16px rgba(0, 0, 0, .5),
        0 0 10px rgba(80, 160, 240, .35),
        inset 0 1px 0 rgba(255, 255, 255, .08),
        inset 0 0 0 1px rgba(0, 0, 0, .4);
    }

    @media (max-width: 640px) {
      body.mode-adventure.single-player-v2.generated-sheet-ready .pattern-hint-stack {
        top: auto;
        bottom: calc(max(7px, env(safe-area-inset-bottom)) + 50px);
        transform: translateX(-50%);
      }
    }

    @media (min-width: 760px) {
      body.mode-adventure.single-player-v2.generated-sheet-ready .pattern-hint-stack {
        top: 211px;
      }
    }
  `;
  doc.head.appendChild(style);
}

export function installPatternHintStack(target = window){
  if(!target || target.__patternHintStackInstalled)return;
  const doc = target.document;
  if(!doc)return;
  const stack = doc.getElementById('patternHintStack');
  if(!stack)return;
  target.__patternHintStackInstalled = true;
  ensureAdventureHintStackStyle(doc);

  // The stack follows the "Text" scoring-hint level directly rather than only
  // the card's data-hint-lines attribute: the hand renderer reuses card
  // elements by uid, so lowering the level (Text -> Glow/None) leaves stale
  // attributes on cards that still had hints, and pressing one would otherwise
  // re-show the panel after the setting was turned off. Adventure mode is the
  // exception: its approach label is core card text, not an optional scoring
  // hint, and adventure cards already expose it through data-hint.
  const adventureModeActive = () => !!target.__tlrAdventureActive || !!doc.body?.classList.contains('mode-adventure');
  const textHintsEnabled = () => {
    if(adventureModeActive())return true;
    const settings = (target.tlrRuntime && target.tlrRuntime.hintSettings) || target.hintSettings;
    return !settings || settings.patternText !== false;
  };

  let frame = 0;
  const render = () => {
    frame = 0;
    const activeSelector = adventureModeActive() ? `${ACTIVE_SELECTOR},${ADVENTURE_ACTIVE_SELECTOR}` : ACTIVE_SELECTOR;
    const card = textHintsEnabled() ? doc.querySelector(activeSelector) : null;
    const raw = card ? (adventureModeActive() ? (card.dataset.hintLines || card.dataset.hint || '') : (card.dataset.hintLines || '')) : '';
    const lines = raw.split('\n').filter(Boolean);
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
      attributeFilter: ['class', 'data-hint', 'data-hint-lines'],
    });
  };
  observeContainer('hand');
  observeContainer('spread');
  observeContainer('choices');
  if(doc.body)observer.observe(doc.body, { attributes: true, attributeFilter: ['class'] });

  target.__patternHintStackRefresh = schedule;
  schedule();
}
