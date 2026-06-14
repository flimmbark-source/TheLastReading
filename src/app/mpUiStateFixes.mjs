import { computeScore } from '../systems/scoring.mjs';

export function installMpUiStateFixes(target = window) {
  if (!target || target.__tlrMpUiStateFixesInstalled) return;
  target.__tlrMpUiStateFixesInstalled = true;

  const doc = target.document;
  if (!doc) return;

  installStyle(doc);
  wrapMatchCallbacks(target, syncMultSpans);
  installMutationSync(target, doc, syncMultSpans);
  target.requestAnimationFrame?.(() => syncMultSpans(target));
}

function myIndex(target) {
  return target.tlrMpGetRole?.() === 'guest' ? 1 : 0;
}

function formatMult(value) {
  const number = Number(value);
  const safe = Number.isFinite(number) ? Math.max(1, number) : 1;
  return safe.toFixed(2).replace(/\.00$/, '').replace(/(\.\d)0$/, '$1');
}

function scoredCards(player) {
  const silenced = new Set(player?.silencedCardUids || []);
  return (player?.spread || []).filter(card => card && !silenced.has(card.uid));
}

function fallbackSpreadMult(player) {
  const cards = scoredCards(player);
  if (!cards.length) return 1;
  const score = computeScore(cards, { skipFlatBonuses: true, skipRelics: true });
  return score.mult || 1;
}

function currentMult(player) {
  const roundMult = Number(player?.roundMult);
  if (Number.isFinite(roundMult)) return Math.max(1, roundMult);
  return fallbackSpreadMult(player);
}

function ensureMultSpan(scoreId, sideClass, target = window) {
  const doc = target.document;
  const scoreNode = doc?.getElementById(scoreId);
  const pill = scoreNode?.closest?.('.mp-pill-score') || scoreNode?.parentElement;
  if (!pill) return null;

  let mult = pill.querySelector(':scope > .mp-mult-inline');
  if (!mult) {
    const parent = pill.parentElement;
    const siblingSelector = sideClass === 'mp-mult-right' ? '.mp-mult-inline.mp-mult-right' : '.mp-mult-inline.mp-mult-left';
    mult = parent?.querySelector?.(siblingSelector) || null;
  }
  if (!mult) {
    mult = doc.createElement('span');
    mult.className = 'mp-mult-inline';
    pill.appendChild(mult);
  }

  mult.classList.toggle('mp-mult-left', sideClass === 'mp-mult-left');
  mult.classList.toggle('mp-mult-right', sideClass === 'mp-mult-right');
  return mult;
}

function syncMultSpans(target = window) {
  const state = target.tlrMpGetState?.();
  const doc = target.document;
  if (!state?.players || !doc?.body?.classList?.contains('mp-game-active')) return;

  const mine = myIndex(target);
  const foe = 1 - mine;
  const mineMult = ensureMultSpan('mpMyScore', 'mp-mult-left', target);
  const foeMult = ensureMultSpan('mpOppScore', 'mp-mult-right', target);

  if (mineMult) mineMult.textContent = `${formatMult(currentMult(state.players[mine]))}x`;
  if (foeMult) foeMult.textContent = `${formatMult(currentMult(state.players[foe]))}x`;
}

function wrapMatchCallbacks(target, sync) {
  const wrap = name => {
    const original = target[name];
    if (typeof original !== 'function') return;
    target[name] = function (...args) {
      const result = original.apply(this, args);
      sync(target);
      target.requestAnimationFrame?.(() => sync(target));
      return result;
    };
  };

  wrap('tlrMpOnMatchStart');
  wrap('tlrMpOnLocalAction');
  wrap('tlrMpOnPeerAction');
}

function installMutationSync(target, doc, sync) {
  const MutationObserverCtor = target.MutationObserver || globalThis.MutationObserver;
  if (!MutationObserverCtor) return;
  let queued = false;
  const observer = new MutationObserverCtor(records => {
    if (!doc.body.classList.contains('mp-game-active')) return;
    if (!records.some(record => {
      const node = record.target?.nodeType === 1 ? record.target : record.target?.parentElement;
      return node?.closest?.('#mpMidWrap,.mp-pill-score,.mp-mult-inline');
    })) return;
    if (queued) return;
    queued = true;
    target.requestAnimationFrame?.(() => {
      queued = false;
      sync(target);
    });
  });
  observer.observe(doc.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
}

function installStyle(doc) {
  if (doc.getElementById('mp-ui-state-fixes-style')) return;
  const style = doc.createElement('style');
  style.id = 'mp-ui-state-fixes-style';
  style.textContent = `
    body.mp-game-active #mpAbilityBtn.mp-visible {
      display: inline-flex !important;
      align-items: center !important;
      justify-content: center !important;
    }
    body.mp-game-active .mp-mult-inline {
      color: #ff5a4f !important;
      font-weight: 800 !important;
      white-space: nowrap !important;
    }
  `;
  doc.head.appendChild(style);
}
