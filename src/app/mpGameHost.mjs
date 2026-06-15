import { installMpGame as installBaseMpGame } from './mpGame.mjs';

function normalizeMult(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 1;
  return Math.max(1, Number(number.toFixed(2)));
}

function formatMult(value) {
  const number = normalizeMult(value);
  return Number.isInteger(number) ? String(number) : String(number).replace(/0+$/, '').replace(/\.$/, '');
}

function installMpHostFixes(target = window) {
  if (!target || target.__tlrMpHostFixesInstalled) return;
  target.__tlrMpHostFixesInstalled = true;

  const doc = target.document;
  if (!doc) return;

  let stateRef = null;
  let myIndex = 0;
  let refTabsHome = null;

  installOverlayLayerFix(doc);
  removeInjectedMpTopRefTabs(doc);

  const syncLater = () => {
    mountExistingRefTabs(doc, refTabsHomeRef);
    removeInjectedMpTopRefTabs(doc);
    suppressBetweenSetResults(doc);
    syncMultSpans(target, doc, stateRef, myIndex);
    target.requestAnimationFrame?.(() => {
      mountExistingRefTabs(doc, refTabsHomeRef);
      removeInjectedMpTopRefTabs(doc);
      suppressBetweenSetResults(doc);
      syncMultSpans(target, doc, stateRef, myIndex);
      syncOverlayLayerClass(doc);
    });
  };

  const refTabsHomeRef = {
    get value() { return refTabsHome; },
    set value(next) { refTabsHome = next; },
  };

  const onMatchStart = target.tlrMpOnMatchStart;
  if (typeof onMatchStart === 'function') {
    target.tlrMpOnMatchStart = function (state, meta = {}) {
      stateRef = state;
      myIndex = meta.role === 'host' ? 0 : 1;
      const result = onMatchStart.apply(this, arguments);
      syncLater();
      return result;
    };
  }

  const onLocalAction = target.tlrMpOnLocalAction;
  if (typeof onLocalAction === 'function') {
    target.tlrMpOnLocalAction = function (action, state) {
      stateRef = state;
      const result = onLocalAction.apply(this, arguments);
      syncLater();
      return result;
    };
  }

  const onPeerAction = target.tlrMpOnPeerAction;
  if (typeof onPeerAction === 'function') {
    target.tlrMpOnPeerAction = function (action, state) {
      stateRef = state;
      const result = onPeerAction.apply(this, arguments);
      syncLater();
      return result;
    };
  }

  const onLeave = target.tlrMpLeave;
  if (typeof onLeave === 'function') {
    target.tlrMpLeave = function () {
      stateRef = null;
      removeInjectedMpTopRefTabs(doc);
      restoreExistingRefTabs(doc, refTabsHomeRef);
      doc.body.classList.remove('mp-overlay-active');
      return onLeave.apply(this, arguments);
    };
  }
}

function installOverlayLayerFix(doc) {
  let style = doc.getElementById('mp-host-layer-fix-style');
  if (!style) {
    style = doc.createElement('style');
    style.id = 'mp-host-layer-fix-style';
    doc.head.appendChild(style);
  }
  style.textContent = `
    body.mp-game-active .spread-wrap{z-index:2147480500!important}
    body.mp-game-active #mpOverlay.mp-hide-between-results{display:none!important;pointer-events:none!important}
    body.mp-game-active #mpOverlay:not(.mp-ov-hidden){position:fixed!important;inset:0!important;z-index:2147483000!important}
    body.mp-game-active .refs-layer{position:fixed!important;z-index:2147483100!important;pointer-events:none!important}
    body.mp-game-active .refs-layer .ref:not(.hidden){pointer-events:auto!important}
    .mp-existing-ref-tabs{display:inline-flex;align-items:center;gap:6px;flex-shrink:0}
    .mp-existing-ref-tabs #scoringBtn,
    .mp-existing-ref-tabs #abilitiesBtn{display:inline-flex!important;align-items:center!important;justify-content:center!important;height:26px!important;padding:0 9px!important;border-radius:999px!important;border:1px solid rgba(180,140,90,.36)!important;background:rgba(28,18,10,.58)!important;color:#b09060!important;font:800 10px/1 system-ui,sans-serif!important;letter-spacing:.08em!important;text-transform:uppercase!important;cursor:pointer!important;margin:0!important}
    .mp-existing-ref-tabs #scoringBtn:hover,
    .mp-existing-ref-tabs #abilitiesBtn:hover{color:#f0d58a!important;border-color:rgba(220,176,92,.62)!important;background:rgba(70,44,18,.78)!important}
  `;
}

function mountExistingRefTabs(doc, homeRef) {
  const bar = doc.querySelector('#mpGame .mp-bar');
  const scoring = doc.getElementById('scoringBtn');
  const abilities = doc.getElementById('abilitiesBtn');
  if (!bar || !scoring || !abilities) return;

  let wrap = doc.getElementById('mpExistingRefTabs');
  if (!wrap) {
    wrap = doc.createElement('div');
    wrap.id = 'mpExistingRefTabs';
    wrap.className = 'mp-existing-ref-tabs';
  }

  if (!homeRef.value) {
    homeRef.value = { parent: scoring.parentElement, next: scoring.nextSibling };
  }

  if (scoring.parentElement !== wrap) wrap.appendChild(scoring);
  if (abilities.parentElement !== wrap) wrap.appendChild(abilities);

  const round = doc.getElementById('mpRoundLabel');
  if (wrap.parentElement !== bar) {
    if (round?.parentElement === bar) bar.insertBefore(wrap, round);
    else bar.appendChild(wrap);
  }
}

function restoreExistingRefTabs(doc, homeRef) {
  const home = homeRef.value;
  const scoring = doc.getElementById('scoringBtn');
  const abilities = doc.getElementById('abilitiesBtn');
  const wrap = doc.getElementById('mpExistingRefTabs');
  const parent = home?.parent || doc.querySelector('#titleWrap .actions');
  if (parent && scoring && abilities) {
    parent.insertBefore(abilities, parent.firstChild);
    parent.insertBefore(scoring, abilities);
  }
  wrap?.remove();
  homeRef.value = null;
}

function removeInjectedMpTopRefTabs(doc) {
  doc.getElementById('mpTopRefTabs')?.remove();
  doc.querySelectorAll('#mpGame .mp-top-ref-tabs').forEach(node => node.remove());
}

function suppressBetweenSetResults(doc) {
  const overlay = doc.getElementById('mpOverlay');
  const box = doc.getElementById('mpOvBox');
  if (!overlay || !box) return;
  const title = box.querySelector('.mp-ov-title')?.textContent?.trim() || '';
  const isBetweenSetResult = /^Round\s+\d+\s+Complete$/i.test(title);
  overlay.classList.toggle('mp-hide-between-results', isBetweenSetResult);
  if (isBetweenSetResult) {
    overlay.classList.add('mp-ov-hidden');
    doc.body.classList.remove('mp-overlay-active');
  }
}

function syncOverlayLayerClass(doc) {
  const overlay = doc.getElementById('mpOverlay');
  const active = !!overlay
    && !overlay.classList.contains('mp-ov-hidden')
    && !overlay.classList.contains('mp-hide-between-results')
    && doc.body.classList.contains('mp-game-active');
  doc.body.classList.toggle('mp-overlay-active', active);
}

function syncMultSpans(target, doc, state, myIndex) {
  if (!state?.players || !doc.body.classList.contains('mp-game-active')) return;
  syncOneMultSpan(target, doc, 'mpMyScore', state.players[myIndex]);
  syncOneMultSpan(target, doc, 'mpOppScore', state.players[1 - myIndex]);
}

function syncOneMultSpan(target, doc, scoreId, player) {
  const scoreNode = doc.getElementById(scoreId);
  const pill = scoreNode?.closest?.('.mp-pill-score') || scoreNode?.parentElement;
  const parent = pill?.parentElement;
  if (!pill || !parent) return;

  let mult = pill.querySelector(':scope > .mp-mult-inline')
    || (pill.previousElementSibling?.classList?.contains('mp-mult-inline') ? pill.previousElementSibling : null)
    || (pill.nextElementSibling?.classList?.contains('mp-mult-inline') ? pill.nextElementSibling : null);
  if (!mult) {
    mult = doc.createElement('span');
    mult.className = 'mp-mult-inline';
    pill.appendChild(mult);
  }

  const text = `${formatMult(player?.roundMult ?? 1)}x`;
  if (mult.textContent !== text) mult.textContent = text;

  const isDesktop = target.matchMedia?.('(min-width: 641px)').matches ?? false;
  const putRight = isDesktop && pill.classList.contains('mp-pill-opp-score');
  if (putRight) {
    if (mult.parentElement !== parent || pill.nextElementSibling !== mult) parent.insertBefore(mult, pill.nextSibling);
    mult.classList.add('mp-mult-right');
    mult.classList.remove('mp-mult-left');
  } else {
    if (mult.parentElement !== parent || mult.nextElementSibling !== pill) parent.insertBefore(mult, pill);
    mult.classList.add('mp-mult-left');
    mult.classList.remove('mp-mult-right');
    parent.classList.add('mp-has-left-mult');
  }
  pill.style.setProperty('width', '118px', 'important');
  pill.style.setProperty('gap', '5px', 'important');
}

// The multiplayer game is self-contained in mpGame.mjs. The host keeps the
// stable import path from main.mjs and patches integration seams where the MP
// renderer crosses singleplayer UI systems.
export function installMpGame(target = window) {
  installBaseMpGame(target);
  installMpHostFixes(target);
}
