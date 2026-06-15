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

  installOverlayLayerFix(doc);
  installEmptySpaceDeselect(target, doc);
  installMpModalFlowFix(target, doc);
  removeInjectedMpTopRefTabs(doc);
  restoreExistingRefButtons(doc);

  const syncLater = () => {
    removeInjectedMpTopRefTabs(doc);
    restoreExistingRefButtons(doc);
    syncDrawerTabs(target);
    suppressBetweenSetResults(doc);
    syncMultSpans(target, doc, stateRef, myIndex);
    target.requestAnimationFrame?.(() => {
      removeInjectedMpTopRefTabs(doc);
      restoreExistingRefButtons(doc);
      syncDrawerTabs(target);
      suppressBetweenSetResults(doc);
      syncMultSpans(target, doc, stateRef, myIndex);
      syncOverlayLayerClass(doc);
    });
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
      const selectedUid = shouldPreserveSelection(action, myIndex) ? currentSelectedHandUid(doc) : null;
      stateRef = state;
      const result = onLocalAction.apply(this, arguments);
      syncLater();
      restoreSelectionIfNeeded(target, doc, selectedUid);
      return result;
    };
  }

  const onPeerAction = target.tlrMpOnPeerAction;
  if (typeof onPeerAction === 'function') {
    target.tlrMpOnPeerAction = function (action, state) {
      const selectedUid = shouldPreserveSelection(action, myIndex) ? currentSelectedHandUid(doc) : null;
      stateRef = state;
      const result = onPeerAction.apply(this, arguments);
      syncLater();
      restoreSelectionIfNeeded(target, doc, selectedUid);
      return result;
    };
  }

  const onLeave = target.tlrMpLeave;
  if (typeof onLeave === 'function') {
    target.tlrMpLeave = function () {
      stateRef = null;
      removeInjectedMpTopRefTabs(doc);
      restoreExistingRefButtons(doc);
      doc.body.classList.remove('mp-overlay-active', 'mp-ability-flow-active');
      closeAllMpAbilitySurfaces(doc);
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
    body.mp-game-active .handDock{z-index:2147481200!important}
    body.mp-game-active #hand{position:relative!important;z-index:2147481201!important}
    body.mp-game-active #hand .card{z-index:2147481202!important}
    body.mp-game-active #hand .card.sel,
    body.mp-game-active #hand .card:hover{z-index:2147481300!important}
    body.mp-game-active #modal.show,
    body.mp-game-active #modal.collapsed{z-index:2147483300!important;pointer-events:auto!important}
    body.mp-game-active.mp-overlay-active #mpGame{z-index:2147483400!important}
    body.mp-game-active.mp-overlay-active #mpOverlay:not(.mp-ov-hidden){position:fixed!important;inset:0!important;z-index:2147483500!important}
    body.mp-game-active.mp-overlay-active #mpOvBox{position:relative!important;z-index:2147483510!important}
    body.mp-game-active .mp-bar{justify-content:flex-start!important;position:relative!important;padding-right:230px!important}
    body.mp-game-active .mp-leave-btn{flex:0 0 auto!important}
    body.mp-game-active .mp-turn-badge{flex:0 1 auto!important;text-align:left!important;margin-left:8px!important;margin-right:auto!important;max-width:calc(100vw - 340px)!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important}
    body.mp-game-active .mp-round-label{display:none!important}
    body.mp-game-active #mpOverlay.mp-hide-between-results{display:none!important;pointer-events:none!important}
    body.mp-game-active #mpOverlay:not(.mp-ov-hidden){position:fixed!important;inset:0!important;z-index:2147483000!important}
    body.mp-game-active .refs-layer{position:fixed!important;z-index:2147483100!important;pointer-events:none!important}
    body.mp-game-active .refs-layer .ref:not(.hidden){pointer-events:auto!important}
    body.mp-game-active #scoringPullWrap,
    body.mp-game-active #abilitiesPullWrap{display:block!important;z-index:2147483200!important}
    body.mp-game-active #scoringPullTab{left:calc(100vw - 196px)!important}
    body.mp-game-active #abilitiesPullTab{left:calc(100vw - 100px)!important}
    body.mp-game-active #scoringPullWrap .tlr-pull-tab,
    body.mp-game-active #abilitiesPullWrap .tlr-pull-tab{pointer-events:auto!important}
    body.mp-game-active #scoringPullWrap.open,
    body.mp-game-active #abilitiesPullWrap.open{pointer-events:auto!important}
  `;
}

function installMpModalFlowFix(target, doc) {
  if (target.__tlrMpModalFlowFixInstalled) return;
  target.__tlrMpModalFlowFixInstalled = true;

  const isMp = () => doc.body.classList.contains('mp-game-active');
  const modal = () => doc.getElementById('modal');
  const toggle = () => doc.getElementById('modalToggle');
  const choices = () => doc.getElementById('choices');
  const abilityPrompt = () => doc.getElementById('abilityPrompt');
  const purgePrompt = () => doc.getElementById('purgePrompt');

  function setToggleLabel() {
    const m = modal();
    const t = toggle();
    if (!m || !t) return;
    t.textContent = m.classList.contains('collapsed') ? 'Show' : 'Hide';
  }

  function clearUnderlyingTargetSelector() {
    doc.querySelectorAll('body.mp-game-active #hand .card, body.mp-game-active #spread .card').forEach(cardEl => {
      cardEl.classList.remove('ability-target', 'ability-picked', 'ability-disabled');
    });
    doc.querySelectorAll('body.mp-game-active #spread .slot').forEach(slot => {
      slot.classList.remove('ability-target-slot', 'ability-picked-slot', 'ability-disabled-slot', 'ability-empty-slot');
    });
  }

  function hideCardChoiceModal({ clearChoices = false } = {}) {
    const m = modal();
    if (!m) return;
    m.classList.remove('show', 'collapsed');
    const t = toggle();
    if (t) t.textContent = 'Hide';
    if (clearChoices) {
      const ch = choices();
      if (ch) ch.innerHTML = '';
    }
  }

  function hideAnchorPrompt() {
    abilityPrompt()?.classList.remove('show');
    purgePrompt()?.classList.remove('show');
    clearUnderlyingTargetSelector();
  }

  function showOnlyCardChoiceModal() {
    if (!isMp()) return;
    const m = modal();
    if (!m || !m.classList.contains('show')) return;
    hideAnchorPrompt();
    if (m.classList.contains('collapsed')) m.classList.remove('collapsed');
    setToggleLabel();
  }

  function showOnlyAnchorPrompt() {
    if (!isMp()) return;
    const prompt = abilityPrompt();
    if (!prompt || !prompt.classList.contains('show')) return;
    hideCardChoiceModal({ clearChoices: true });
  }

  function reconcileAbilitySurface() {
    if (!isMp()) return;
    const m = modal();
    const prompt = abilityPrompt();
    const modalOpen = !!m?.classList.contains('show');
    const promptOpen = !!prompt?.classList.contains('show');
    if (modalOpen) showOnlyCardChoiceModal();
    else if (promptOpen) showOnlyAnchorPrompt();
  }

  function observeModal() {
    if (typeof MutationObserver === 'undefined') return;
    const m = modal();
    const title = doc.getElementById('modalTitle');
    const prompt = doc.getElementById('modalPrompt');
    const ch = choices();
    if (!m || !title || !prompt || !ch || target.__tlrMpModalContentObserver) return;
    const observer = new MutationObserver(() => target.requestAnimationFrame?.(reconcileAbilitySurface));
    observer.observe(m, { attributes: true, attributeFilter: ['class'] });
    observer.observe(title, { childList: true, characterData: true, subtree: true });
    observer.observe(prompt, { childList: true, characterData: true, subtree: true });
    observer.observe(ch, { childList: true, subtree: false });
    target.__tlrMpModalContentObserver = observer;
  }

  function observeAbilityPrompt() {
    if (typeof MutationObserver === 'undefined') return;
    const prompt = abilityPrompt();
    if (!prompt || target.__tlrMpAbilityPromptObserver) return;
    const observer = new MutationObserver(() => target.requestAnimationFrame?.(reconcileAbilitySurface));
    observer.observe(prompt, { attributes: true, attributeFilter: ['class'] });
    target.__tlrMpAbilityPromptObserver = observer;
  }

  doc.addEventListener('click', event => {
    if (!isMp()) return;
    if (!event.target?.closest?.('#modalToggle')) return;
    target.requestAnimationFrame?.(setToggleLabel);
  }, true);

  observeModal();
  observeAbilityPrompt();
  target.setTimeout?.(observeModal, 250);
  target.setTimeout?.(observeAbilityPrompt, 250);
  target.setTimeout?.(observeModal, 1000);
  target.setTimeout?.(observeAbilityPrompt, 1000);
}

function closeAllMpAbilitySurfaces(doc) {
  doc.getElementById('modal')?.classList.remove('show', 'collapsed');
  doc.getElementById('abilityPrompt')?.classList.remove('show');
  doc.getElementById('purgePrompt')?.classList.remove('show');
  doc.querySelectorAll('body.mp-game-active #hand .card, body.mp-game-active #spread .card').forEach(cardEl => {
    cardEl.classList.remove('ability-target', 'ability-picked', 'ability-disabled');
  });
  doc.querySelectorAll('body.mp-game-active #spread .slot').forEach(slot => {
    slot.classList.remove('ability-target-slot', 'ability-picked-slot', 'ability-disabled-slot', 'ability-empty-slot');
  });
  const toggle = doc.getElementById('modalToggle');
  if (toggle) toggle.textContent = 'Hide';
}

function shouldPreserveSelection(action, myIndex) {
  if (action?.type !== 'MP_SUBMIT_ACTION') return false;
  return action.playerIndex !== myIndex;
}

function currentSelectedHandUid(doc) {
  return doc.querySelector('#hand .card.sel[data-uid]')?.dataset?.uid || null;
}

function restoreSelectionIfNeeded(target, doc, uid) {
  if (!uid) return;
  target.requestAnimationFrame?.(() => {
    if (!doc.body.classList.contains('mp-game-active')) return;
    const card = doc.querySelector(`#hand .card[data-uid="${cssEscape(uid)}"]`);
    if (!card || card.classList.contains('sel')) return;
    card.click();
  });
}

function installEmptySpaceDeselect(target, doc) {
  if (target.__tlrMpEmptySpaceDeselectInstalled) return;
  target.__tlrMpEmptySpaceDeselectInstalled = true;
  doc.addEventListener('click', event => {
    if (!doc.body.classList.contains('mp-game-active')) return;
    const selected = doc.querySelector('#hand .card.sel[data-uid]');
    if (!selected) return;
    if (!isMpEmptySpaceClick(event.target)) return;
    selected.click();
  }, true);
}

function isMpEmptySpaceClick(target) {
  const blocked = target?.closest?.(
    '.card,.slot,button,a,input,select,textarea,label,.tlr-pull-wrap,.mp-overlay,.ref,.modal,#settingsPanel,#abilityPrompt,#purgePrompt,.mp-mid-wrap,.mp-bar,.mp-opp-hand'
  );
  return !blocked;
}

function cssEscape(value) {
  if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') return CSS.escape(String(value));
  return String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function syncDrawerTabs(target) {
  target.tlrFanPullTabs?.();
  target.tlrFitDrawerHeights?.();
}

function restoreExistingRefButtons(doc) {
  const movedWrap = doc.getElementById('mpExistingRefTabs');
  const actions = doc.querySelector('#titleWrap .actions');
  const scoring = doc.getElementById('scoringBtn');
  const abilities = doc.getElementById('abilitiesBtn');
  if (movedWrap && actions && scoring && abilities) {
    actions.insertBefore(abilities, actions.firstChild);
    actions.insertBefore(scoring, abilities);
  }
  movedWrap?.remove();
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
