import { getAbility } from '../data/abilities.mjs';

function betweenRevealLimit() {
  return Math.max(1, Number(getAbility('BETWEEN_2')?.count || 2));
}

function isBetweenResultModal(doc) {
  const modal = doc.getElementById('modal');
  if (!modal?.classList?.contains('show')) return false;
  const title = doc.getElementById('modalTitle')?.textContent?.trim() || '';
  return title.startsWith('Between —');
}

function trimBetweenChoices(doc) {
  if (!doc.body.classList.contains('mp-game-active')) return;
  if (!isBetweenResultModal(doc)) return;

  const choices = doc.getElementById('choices');
  if (!choices) return;
  const limit = betweenRevealLimit();
  const cards = [...choices.querySelectorAll(':scope > .card')];
  cards.slice(limit).forEach(card => card.remove());

  const prompt = doc.getElementById('modalPrompt');
  if (prompt && !prompt.dataset.betweenLimited) {
    prompt.textContent = `Cards found between them. Take 1. Revealed up to ${limit}.`;
    prompt.dataset.betweenLimited = '1';
  }
}

export function installMpBetweenChoiceLimit(target = window) {
  if (!target || target.__tlrMpBetweenChoiceLimitInstalled) return;
  target.__tlrMpBetweenChoiceLimitInstalled = true;

  const doc = target.document;
  if (!doc) return;

  const MutationObserverCtor = target.MutationObserver || globalThis.MutationObserver;
  if (!MutationObserverCtor) return;

  let queued = false;
  const queueTrim = () => {
    if (queued) return;
    queued = true;
    target.requestAnimationFrame?.(() => {
      queued = false;
      trimBetweenChoices(doc);
    }) ?? trimBetweenChoices(doc);
  };

  const observer = new MutationObserverCtor(queueTrim);
  observer.observe(doc.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
  queueTrim();
}
