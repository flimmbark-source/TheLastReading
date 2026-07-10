// Accessibility and keyboard semantics for Adventure presentation surfaces.
// The Adventure controller remains the sole owner of reward mechanics; this
// bridge decorates its existing DOM after each render.

export function installAdventurePresentationA11y(target = window) {
  if (!target?.document || target.__tlrAdventurePresentationA11yInstalled) return;
  target.__tlrAdventurePresentationA11yInstalled = true;

  const doc = target.document;
  let observer = null;
  let raf = 0;

  const isAdventure = () => doc.body?.classList.contains('mode-adventure');

  const sync = () => {
    raf = 0;
    if (!isAdventure()) return;
    const summary = doc.getElementById('summary');
    const panel = summary?.querySelector(':scope > .result-panel');
    if (!summary || !panel) return;

    const heading = panel.querySelector('.rhead h3');
    if (heading) {
      if (!heading.id) heading.id = 'advPresentationHeading';
      heading.setAttribute('aria-live', 'polite');
      panel.setAttribute('aria-labelledby', heading.id);
    }
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'true');

    const rewardGroup = panel.querySelector('.adv-rewards');
    if (rewardGroup) {
      rewardGroup.setAttribute('role', 'group');
      rewardGroup.setAttribute('aria-label', heading?.textContent?.trim() || 'Adventure choices');
    }

    panel.querySelectorAll('.adv-reward').forEach((card, index) => {
      const disabled = card.classList.contains('adv-reward--disabled');
      const picked = card.classList.contains('adv-reward--picked');
      const name = card.querySelector('.adv-reward__name')?.textContent?.trim();
      const lane = card.querySelector('.adv-reward__lane')?.textContent?.trim();
      card.setAttribute('role', 'button');
      card.setAttribute('tabindex', disabled ? '-1' : '0');
      card.setAttribute('aria-disabled', String(disabled));
      card.setAttribute('aria-pressed', String(picked));
      if (name) card.setAttribute('aria-label', lane ? `${lane}: ${name}` : name);
      card.dataset.presentationChoiceIndex = String(index);
    });

    const tabs = panel.querySelector('.adv-offer-tabs');
    if (tabs) {
      tabs.setAttribute('role', 'tablist');
      tabs.querySelectorAll('button').forEach(button => {
        button.setAttribute('role', 'tab');
        button.setAttribute('tabindex', button.getAttribute('aria-pressed') === 'true' ? '0' : '-1');
        button.setAttribute('aria-selected', button.getAttribute('aria-pressed') || 'false');
      });
    }

    const confirm = panel.querySelector(':scope > .rbtns .btn-gold');
    if (confirm && heading?.id) confirm.setAttribute('aria-describedby', heading.id);
  };

  const schedule = () => {
    if (raf) return;
    raf = target.requestAnimationFrame(sync);
  };

  const focusRelativeChoice = (card, direction) => {
    const panel = card.closest('.result-panel');
    if (!panel) return;
    const choices = [...panel.querySelectorAll('.adv-reward:not(.adv-reward--disabled)')]
      .filter(choice => choice.getAttribute('aria-disabled') !== 'true');
    const current = choices.indexOf(card);
    if (current < 0 || choices.length < 2) return;
    choices[(current + direction + choices.length) % choices.length]?.focus();
  };

  const onKeyDown = event => {
    if (!isAdventure() || !(event.target instanceof Element)) return;
    const card = event.target.closest('.adv-reward');
    if (!card || card.classList.contains('adv-reward--disabled')) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      card.click();
      return;
    }
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      event.preventDefault();
      focusRelativeChoice(card, 1);
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      event.preventDefault();
      focusRelativeChoice(card, -1);
    }
  };

  doc.addEventListener('keydown', onKeyDown, true);

  const attach = () => {
    const summary = doc.getElementById('summary');
    if (!summary) {
      target.requestAnimationFrame(attach);
      return;
    }
    observer = new MutationObserver(schedule);
    observer.observe(summary, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: ['class', 'disabled'],
    });
    schedule();
  };

  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', attach, { once: true });
  else attach();

  target.__tlrAdventurePresentationA11yDestroy = () => {
    observer?.disconnect();
    observer = null;
    doc.removeEventListener('keydown', onKeyDown, true);
    if (raf) target.cancelAnimationFrame(raf);
    target.__tlrAdventurePresentationA11yInstalled = false;
  };
}
