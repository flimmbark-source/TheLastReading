import { getPersona } from '../multiplayer/personas.mjs';
import { title as cardTitle } from '../ui/renderCard.mjs';

export function installMpPersonaAbilityPrompt(target = window) {
  if (!target || target.__tlrMpPersonaAbilityPromptInstalled) return;
  target.__tlrMpPersonaAbilityPromptInstalled = true;

  const doc = target.document;
  if (!doc) return;

  let personaSwapRequested = false;

  installStyle(doc);
  wrapSwapStart(target, () => { personaSwapRequested = true; syncPersonaPrompt(target, personaSwapRequested); });
  wrapCancel(target, () => { personaSwapRequested = false; syncPersonaPrompt(target, personaSwapRequested); });
  wrapMatchCallbacks(target, () => { personaSwapRequested = false; syncPersonaPrompt(target, personaSwapRequested); });
  installMutationSync(target, doc, () => syncPersonaPrompt(target, personaSwapRequested));
  target.requestAnimationFrame?.(() => syncPersonaPrompt(target, personaSwapRequested));
}

function myIndex(target) {
  return target.tlrMpGetRole?.() === 'guest' ? 1 : 0;
}

function currentPersona(target) {
  const state = target.tlrMpGetState?.();
  const personaId = state?.players?.[myIndex(target)]?.persona;
  return getPersona(personaId);
}

function selectedSpreadCard(doc, target) {
  const slot = doc.querySelector('body.mp-game-active #spread .slot.mp-swap-a');
  if (!slot) return null;
  const slots = [...doc.querySelectorAll('body.mp-game-active #spread .slot')];
  const index = slots.indexOf(slot);
  if (index < 0) return null;
  return target.tlrMpGetState?.()?.players?.[myIndex(target)]?.spread?.[index] || null;
}

function cleanCardName(card) {
  if (!card) return 'that card';
  try { return cardTitle(card).replace(/<[^>]+>/g, ''); }
  catch (_) { return card?.name || card?.id || 'that card'; }
}

function syncPersonaPrompt(target = window, personaSwapRequested = false) {
  const doc = target.document;
  if (!doc) return;
  const promptBox = doc.getElementById('abilityPrompt');
  const title = doc.getElementById('abilityPromptTitle');
  const text = doc.getElementById('abilityPromptText');
  const button = doc.getElementById('abilityConfirm');
  if (!promptBox || !title || !text || !button) return;

  if (!personaSwapRequested) {
    doc.body.classList.remove('mp-persona-ability-active');
    if (promptBox.dataset.mpPersonaPrompt === '1') {
      promptBox.classList.remove('show');
      promptBox.dataset.mpPersonaPrompt = '';
      title.textContent = '';
      text.textContent = '';
      button.disabled = true;
      button.textContent = 'Choose';
      button.onclick = null;
    }
    return;
  }

  const persona = currentPersona(target);
  const ability = persona?.ability;
  const chosenSpreadCard = selectedSpreadCard(doc, target);
  const firstStep = !chosenSpreadCard;

  doc.body.classList.add('mp-persona-ability-active');
  promptBox.dataset.mpPersonaPrompt = '1';
  promptBox.classList.add('show');
  title.textContent = ability?.name || 'Persona Ability';
  text.innerHTML = firstStep
    ? `<b>${escapeHtml(persona?.name || 'Persona')}:</b> Choose a card in your <b>Spread</b>. Then choose a card in your <b>Hand</b> to swap with it.`
    : `Selected <b>${escapeHtml(cleanCardName(chosenSpreadCard))}</b>. Now choose a card in your <b>Hand</b> to swap with it.`;
  button.disabled = false;
  button.textContent = 'Cancel';
  button.onclick = () => target.tlrMpCancelAction?.();
}

function wrapSwapStart(target, afterStart) {
  const original = target.tlrMpStartSwap;
  if (typeof original !== 'function') return;
  target.tlrMpStartSwap = function (...args) {
    const result = original.apply(this, args);
    afterStart(target);
    target.requestAnimationFrame?.(() => afterStart(target));
    return result;
  };
}

function wrapCancel(target, afterCancel) {
  const original = target.tlrMpCancelAction;
  if (typeof original !== 'function') return;
  target.tlrMpCancelAction = function (...args) {
    const result = original.apply(this, args);
    afterCancel(target);
    target.requestAnimationFrame?.(() => afterCancel(target));
    return result;
  };
}

function wrapMatchCallbacks(target, afterAction) {
  const wrap = name => {
    const original = target[name];
    if (typeof original !== 'function') return;
    target[name] = function (...args) {
      const result = original.apply(this, args);
      afterAction(target);
      target.requestAnimationFrame?.(() => afterAction(target));
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
      return node?.closest?.('#spread,#hand,#abilityPrompt,.mp-pills-actions');
    })) return;
    if (queued) return;
    queued = true;
    target.requestAnimationFrame?.(() => {
      queued = false;
      sync(target);
    });
  });
  observer.observe(doc.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'disabled', 'data-uid'] });
}

function installStyle(doc) {
  if (doc.getElementById('mp-persona-ability-prompt-style')) return;
  const style = doc.createElement('style');
  style.id = 'mp-persona-ability-prompt-style';
  style.textContent = `
    body.mp-game-active.mp-persona-ability-active #abilityPrompt {
      display: flex !important;
      z-index: 2147482600 !important;
    }
    body.mp-game-active.mp-persona-ability-active #spread .slot.mp-swap-pick {
      border-color: rgba(190, 138, 216, .95) !important;
      box-shadow: 0 0 0 2px rgba(190, 138, 216, .46), 0 0 22px rgba(190, 138, 216, .5) !important;
      cursor: pointer !important;
    }
    body.mp-game-active.mp-persona-ability-active #spread .slot.mp-swap-a {
      border-color: rgba(255, 221, 144, .98) !important;
      box-shadow: 0 0 0 2px rgba(255, 221, 144, .6), 0 0 28px rgba(255, 221, 144, .58) !important;
    }
    body.mp-game-active.mp-persona-ability-active #hand .card.mp-surgeon-swap-target {
      border-color: rgba(120, 220, 150, .95) !important;
      box-shadow: 0 0 0 2px rgba(120, 220, 150, .42), 0 0 22px rgba(120, 220, 150, .5) !important;
      cursor: pointer !important;
    }
  `;
  doc.head.appendChild(style);
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}
