import { scorePlacedCards } from '../game/selectors.mjs';

const STYLE_ID = 'adventure-live-score-style';

function ensureStyle(doc) {
  if (!doc || doc.getElementById(STYLE_ID)) return;
  const style = doc.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    .adv-deck__live-score{
      display:flex;flex-direction:column;align-items:center;justify-content:center;
      margin-top:6px;padding:4px 8px;border-radius:7px;min-width:58px;
      background:rgba(255,255,255,.045);border:1px solid rgba(228,188,111,.28);
      font-family:system-ui,sans-serif;line-height:1
    }
    .adv-deck__live-score-label{font-size:7px;font-weight:800;letter-spacing:.16em;text-transform:uppercase;color:#a99878}
    .adv-deck__live-score-value{margin-top:2px;font-size:18px;font-weight:900;color:#f2dfb8;font-variant-numeric:tabular-nums}
    .adv-deck__live-score.is-success{border-color:rgba(159,209,127,.72);background:rgba(159,209,127,.1)}
    .adv-deck__live-score.is-success .adv-deck__live-score-value{color:#bfe5a4}
    .adv-deck__live-score.is-triumph{border-color:rgba(243,201,105,.9);background:rgba(243,201,105,.13);box-shadow:0 0 12px rgba(243,201,105,.2)}
    .adv-deck__live-score.is-triumph .adv-deck__live-score-value{color:#f3c969}
  `;
  doc.head.appendChild(style);
}

function parseTargets(scoresNode) {
  const values = (scoresNode?.textContent || '').match(/\d+(?:\.\d+)?/g)?.map(Number) || [];
  return { target: values[0] ?? Infinity, triumph: values[1] ?? Infinity };
}

function currentAdventureScore(target) {
  const store = target.tlrStore;
  if (!store || typeof store.getState !== 'function') return 0;
  try {
    return Number(scorePlacedCards(store.getState())?.finalScore || 0);
  } catch {
    return 0;
  }
}

function render(target) {
  const doc = target.document;
  if (!doc || !target.__tlrAdventureActive) return;
  const top = doc.querySelector('#advEventDeck .adv-deck__top');
  const scores = top?.querySelector('.adv-deck__scores');
  if (!top || !scores) return;

  let live = top.querySelector('.adv-deck__live-score');
  if (!live) {
    live = doc.createElement('div');
    live.className = 'adv-deck__live-score';
    live.innerHTML = '<span class="adv-deck__live-score-label">Score</span><span class="adv-deck__live-score-value">0</span>';
    top.insertBefore(live, scores);
  }

  const score = currentAdventureScore(target);
  const { target: successTarget, triumph } = parseTargets(scores);
  live.querySelector('.adv-deck__live-score-value').textContent = String(score);
  live.classList.toggle('is-success', score >= successTarget && score < triumph);
  live.classList.toggle('is-triumph', score >= triumph);
}

export function installAdventureLiveScore(target = window) {
  if (!target || target.__tlrAdventureLiveScoreInstalled) return;
  target.__tlrAdventureLiveScoreInstalled = true;
  const doc = target.document;
  ensureStyle(doc);

  let queued = false;
  const queueRender = () => {
    if (queued) return;
    queued = true;
    queueMicrotask(() => {
      queued = false;
      render(target);
    });
  };

  const attachStore = () => {
    if (target.tlrStore && typeof target.tlrStore.subscribe === 'function') {
      target.tlrStore.subscribe(queueRender);
      queueRender();
      return true;
    }
    return false;
  };

  if (!attachStore()) {
    const timer = target.setInterval(() => {
      if (attachStore()) target.clearInterval(timer);
    }, 100);
  }

  if (doc?.body && typeof MutationObserver !== 'undefined') {
    const observer = new MutationObserver(queueRender);
    observer.observe(doc.body, { childList: true, subtree: true });
  }

  target.addEventListener?.('tlr:adventure-started', queueRender);
  target.addEventListener?.('tlr:reading-started', queueRender);
  queueRender();
}

if (typeof window !== 'undefined') installAdventureLiveScore(window);
