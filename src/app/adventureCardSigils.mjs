import { cardAdventureProfile } from '../data/adventure/cardNodes.mjs';
import { sigilForNode } from '../data/adventure/sigils.mjs';

const STYLE_ID = 'adventure-card-sigils-runtime-style';

function ensureStyle(doc) {
  if (!doc || doc.getElementById(STYLE_ID)) return;
  const style = doc.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    body.mode-adventure .card > .adv-sigil-seal{
      display:flex!important;
      position:absolute;
      width:16px;
      height:16px;
      top:4px;
      left:4px;
      border-radius:50%;
      z-index:20;
      align-items:center;
      justify-content:center;
      color:#d9edff;
      font:900 9px/1 Georgia,serif;
      background:radial-gradient(circle at 34% 30%,#4d9bd4 0%,#1c5f98 46%,#0a3159 76%,#061c35 100%);
      border:1px solid rgba(164,215,247,.82);
      box-shadow:0 1px 3px #000,inset 0 0 0 1px rgba(255,255,255,.14),0 0 7px rgba(60,142,205,.62);
      transform:none!important;
      pointer-events:none;
    }
    body.mode-adventure .card > .adv-sigil-seal::after{
      content:'';
      position:absolute;
      inset:2px;
      border:1px solid rgba(214,239,255,.22);
      border-radius:50%;
    }
    @media(max-width:640px){
      body.mode-adventure .card > .adv-sigil-seal{
        width:14px;
        height:14px;
        top:2px;
        left:2px;
        font-size:8px;
      }
    }
  `;
  doc.head.appendChild(style);
}

function allRuntimeCards(target) {
  const state = target.state || {};
  return [
    ...(state.hand || []),
    ...(state.spread || []).filter(Boolean),
    ...(state.deck || []),
    ...(state.discard || []),
  ];
}

function cardForElement(target, element) {
  const uid = String(element?.dataset?.uid ?? '');
  if (!uid) return null;
  return allRuntimeCards(target).find(card => String(card?.uid ?? '') === uid) || null;
}

function sigilForCard(card) {
  const node = card?.adventureNodeOverride || cardAdventureProfile(card)?.node || null;
  return sigilForNode(node);
}

function removeSigils(doc) {
  doc?.querySelectorAll('.adv-sigil-seal[data-adv-runtime-sigil="1"]').forEach(element => element.remove());
}

function decorate(target = window) {
  const doc = target?.document;
  if (!doc) return;
  ensureStyle(doc);

  if (!target.__tlrAdventureActive || !doc.body.classList.contains('mode-adventure')) {
    removeSigils(doc);
    return;
  }

  doc.querySelectorAll('#hand .card[data-uid], #spread .card[data-uid], .choices .card[data-uid], .card-detail-card .card[data-uid]').forEach(element => {
    const card = cardForElement(target, element);
    const sigil = sigilForCard(card);
    if (!sigil) return;

    element.querySelectorAll('.art > .adv-sigil-seal[data-adv-runtime-sigil="1"]').forEach(hidden => hidden.remove());

    let seal = element.querySelector(':scope > .adv-sigil-seal[data-adv-runtime-sigil="1"]');
    if (!seal) {
      seal = doc.createElement('div');
      seal.className = 'adv-sigil-seal';
      seal.dataset.advRuntimeSigil = '1';
      element.prepend(seal);
    }
    seal.textContent = sigil.glyph;
    seal.title = `${sigil.name} Sigil`;
    seal.setAttribute('aria-label', `${sigil.name} Sigil`);
  });
}

export function installAdventureCardSigils(target = window) {
  const doc = target?.document;
  if (!doc || target.__tlrAdventureCardSigilsInstalled) return;
  target.__tlrAdventureCardSigilsInstalled = true;
  ensureStyle(doc);

  let frame = 0;
  const schedule = () => {
    if (frame) return;
    frame = target.requestAnimationFrame(() => {
      frame = 0;
      decorate(target);
    });
  };

  const contentObserver = new target.MutationObserver(schedule);
  contentObserver.observe(doc.body, { childList: true, subtree: true });

  const modeObserver = new target.MutationObserver(schedule);
  modeObserver.observe(doc.body, { attributes: true, attributeFilter: ['class'] });

  schedule();
}

if (typeof window !== 'undefined') installAdventureCardSigils(window);
