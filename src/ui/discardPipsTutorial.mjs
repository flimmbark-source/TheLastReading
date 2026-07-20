// Inserts a short first-reading tutorial beat between the Ability flick/use
// explanation and the Abilities reference drawer. tutorialCore owns the main
// sequence; this presentation hook temporarily uses its existing callout so the
// new diegetic discard pips can be introduced without duplicating tutorial UI.

const ABILITY_USE_STEP = 'ability-flick';
const ABILITY_PANEL_STEP = 'ability-panel-intro';
const INTRO_STEP = 'story-intro';
const PIPS_TUTORIAL_TEXT = 'This shows how many Abilities you can use in a reading.';

function isVisible(element) {
  if (!element || !element.isConnected) return false;
  const style = getComputedStyle(element);
  if (style.display === 'none' || style.visibility === 'hidden') return false;
  const rect = element.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

function positionTip(target, document, pips) {
  const tip = document.getElementById('tutTip');
  if (!tip || !isVisible(pips)) return;

  const edge = 8;
  const gap = 14;
  const maxTipWidth = Math.min(300, target.innerWidth * 0.88);
  tip.style.maxWidth = `${maxTipWidth}px`;
  tip.style.width = '';

  const targetRect = pips.getBoundingClientRect();
  const measuredTip = tip.getBoundingClientRect();
  const tipWidth = Math.min(measuredTip.width || maxTipWidth, maxTipWidth);
  const tipHeight = measuredTip.height;
  const anchorX = targetRect.left + targetRect.width / 2;

  let left = anchorX - tipWidth / 2;
  left = Math.max(edge, Math.min(left, target.innerWidth - tipWidth - edge));

  const roomAbove = targetRect.top - gap - edge;
  const roomBelow = target.innerHeight - targetRect.bottom - gap - edge;
  let arrowDirection = 'down';
  if (roomAbove < tipHeight && roomBelow > roomAbove) arrowDirection = 'up';

  let top = arrowDirection === 'down'
    ? targetRect.top - gap - tipHeight
    : targetRect.bottom + gap;
  top = Math.max(edge, Math.min(top, target.innerHeight - tipHeight - edge));

  tip.style.left = `${left}px`;
  tip.style.right = '';
  tip.style.top = `${top}px`;
  tip.style.bottom = '';

  const arrow = tip.querySelector('.tut-arrow');
  if (!arrow) return;
  arrow.className = `tut-arrow ${arrowDirection}`;
  const arrowX = anchorX - left;
  arrow.style.left = `${Math.max(16, Math.min(arrowX, tipWidth - 16))}px`;
}

export function installDiscardPipsTutorial(target = window, pipsElement = null) {
  if (!target || target.__tlrDiscardPipsTutorialInstalled) return;
  target.__tlrDiscardPipsTutorialInstalled = true;

  const document = target.document;
  if (!document) return;

  let lastTutorialStep = null;
  let shownThisRun = false;
  let active = false;
  let bypassAbilityPanel = false;
  let showTimer = 0;
  let positionTimer = 0;

  const pips = () => pipsElement || document.getElementById('table3dDiscardPips');

  const clearPositionWork = () => {
    target.clearTimeout(showTimer);
    target.clearTimeout(positionTimer);
    showTimer = 0;
    positionTimer = 0;
  };

  const clearCustomMarker = () => {
    const tip = document.getElementById('tutTip');
    tip?.removeAttribute('data-discard-pips-step');
  };

  const place = () => {
    if (!active) return;
    positionTip(target, document, pips());
  };

  const showPipsStep = () => {
    const pipTarget = pips();
    const tip = document.getElementById('tutTip');
    const text = document.getElementById('tutText');
    if (!isVisible(pipTarget) || !tip || !text || typeof target.tutShow !== 'function') return;

    // The official Ability-panel step has just rendered. Clear it and its
    // delayed positioning work, then use the same callout for this inserted
    // tap-advanced beat. The panel step is restored after the next tap.
    target.tutHide?.();
    active = true;
    tip.dataset.discardPipsStep = 'true';
    tip.classList.remove('tut-center', 'tut-demo-flick');
    tip.style.cssText = '';
    text.textContent = PIPS_TUTORIAL_TEXT;
    const tapPrompt = tip.querySelector('.tut-tap-prompt');
    if (tapPrompt) tapPrompt.style.display = '';
    tip.classList.add('show');

    target.requestAnimationFrame(() => {
      place();
      target.requestAnimationFrame(place);
    });
    positionTimer = target.setTimeout(place, 180);
  };

  const restoreAbilityPanelStep = () => {
    if (!active) return;
    active = false;
    clearPositionWork();
    clearCustomMarker();
    bypassAbilityPanel = true;
    target.tutShow?.(ABILITY_PANEL_STEP, { force: true });
    bypassAbilityPanel = false;
  };

  const onTutorialStep = event => {
    const step = event?.detail?.step;
    if (!step) return;

    if (step === INTRO_STEP) shownThisRun = false;

    const shouldInsert = step === ABILITY_PANEL_STEP
      && lastTutorialStep === ABILITY_USE_STEP
      && !shownThisRun
      && !bypassAbilityPanel;

    lastTutorialStep = step;
    if (!shouldInsert) return;

    shownThisRun = true;
    target.clearTimeout(showTimer);
    // tutorialCore dispatches the step event before it paints the new callout;
    // defer until that synchronous render is complete, then replace it.
    showTimer = target.setTimeout(showPipsStep, 0);
  };

  const onClick = event => {
    if (!active) return;
    const element = event.target instanceof Element ? event.target : null;

    // Preserve the existing Skip Tutorial control. tutorialCore's internal
    // step is intentionally clear while this inserted beat is visible, but its
    // skip routine still marks the complete tutorial and hides the callout.
    if (element?.closest('#tutSkipBtn')) {
      active = false;
      clearPositionWork();
      clearCustomMarker();
      return;
    }

    if (element?.closest('.game-term, .game-term-popover, .game-terms-glossary')) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    restoreAbilityPanelStep();
  };

  const onResize = () => {
    if (active) target.requestAnimationFrame(place);
  };

  target.addEventListener('tlr:tutorial-step', onTutorialStep);
  document.addEventListener('click', onClick, true);
  target.addEventListener('resize', onResize, { passive: true });

  target.__tlrDiscardPipsTutorialDestroy = () => {
    clearPositionWork();
    active = false;
    clearCustomMarker();
    target.removeEventListener('tlr:tutorial-step', onTutorialStep);
    document.removeEventListener('click', onClick, true);
    target.removeEventListener('resize', onResize);
    target.__tlrDiscardPipsTutorialInstalled = false;
  };
}
