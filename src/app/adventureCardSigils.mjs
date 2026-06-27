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
      width:15px;
      height:15px;
      top:4px;
      left:4px;
      border-radius:50%;
      z-index:20;
      align-items:center;
      justify-content:center;
      color:#fff;
      font:900 11px/1 Arial,sans-serif;
      background:#164f7d;
      border:1px solid rgba(230,246,255,.95);
      box-shadow:0 1px 2px #000,0 0 0 1px rgba(0,0,0,.72),0 0 4px rgba(65,158,220,.55);
      text-shadow:0 1px 1px #000,-1px 0 #000,1px 0 #000,0 -1px #000;
      transform:none!important;
      pointer-events:none;
    }
    body.mode-adventure .card > .adv-sigil-seal::after{display:none}
    body.mode-adventure .card > .adv-sigil-seal[data-sigil-id="might"]{background:#2d69a8}
    body.mode-adventure .card > .adv-sigil-seal[data-sigil-id="blade"]{background:#a73535}
    body.mode-adventure .card > .adv-sigil-seal[data-sigil-id="shield"]{background:#3f6f92}
    body.mode-adventure .card > .adv-sigil-seal[data-sigil-id="mountain"]{background:#6b5b46}
    body.mode-adventure .card > .adv-sigil-seal[data-sigil-id="heart"]{background:#a33d62}
    body.mode-adventure .card > .adv-sigil-seal[data-sigil-id="crown"]{background:#8b6a20}
    body.mode-adventure .card > .adv-sigil-seal[data-sigil-id="moon"]{background:#584c9b}
    body.mode-adventure .card > .adv-sigil-seal[data-sigil-id="mask"]{background:#6c4b78}
    body.mode-adventure .card > .adv-sigil-seal[data-sigil-id="eye"]{background:#2f7a72}
    body.mode-adventure .card > .adv-sigil-seal[data-sigil-id="serpent"]{background:#4d7b3b}
    body.mode-adventure .card > .adv-sigil-seal[data-sigil-id="forge"]{background:#a45a25}
    body.mode-adventure .card > .adv-sigil-seal[data-sigil-id="wheel"]{background:#8a7730}
    body.mode-adventure .card-detail-card .card > .adv-sigil-seal{
      width:24px;
      height:24px;
      top:7px;
      left:7px;
      font-size:18px;
      border-width:2px;
      box-shadow:0 2px 4px #000,0 0 0 1px rgba(0,0,0,.78),0 0 7px rgba(65,158,220,.65);
    }
    @media(max-width:640px){
      body.mode-adventure .card > .adv-sigil-seal{
        width:13px;
        height:13px;
        top:2px;
        left:2px;
        font-size:10px;
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
    seal.dataset.sigilId = sigil.id;
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
