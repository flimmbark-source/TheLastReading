import { cardAdventureProfile } from '../data/adventure/cardNodes.mjs';
import { getEventApproaches } from '../data/adventure/eventApproaches.mjs';
import { sigilForNode } from '../data/adventure/sigils.mjs';
import { title as cardTitle } from '../ui/renderCard.mjs';

const STYLE_ID = 'adventure-card-sigils-runtime-style';
const SVG_NS = 'http://www.w3.org/2000/svg';
const REQUIREMENT_SET_KEY = '__tlrAdventureRequirementSetIndex';

const REWARD_CHOICE_KIND = Object.freeze({
  'Upgrade a Card': 'upgrade',
  'Seal a Card': 'seal',
  'Banish a Card': 'banish',
  'Transmutation Dust': 'transmute',
});

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

    body.mode-adventure #advApproachWeb .adv-approach-requirement{
      fill:#fff0bd;
      stroke:#160b05;
      stroke-width:2.6px;
      paint-order:stroke;
      font:900 10px/1 system-ui,sans-serif;
      text-anchor:middle;
      dominant-baseline:central;
      pointer-events:none;
    }

    body.mode-adventure #choices .choice-card[data-adv-reward-choice]{overflow:visible}
    body.mode-adventure #choices .choice-card .adv-choice-preview{
      position:absolute;
      z-index:35;
      pointer-events:none;
      font-family:system-ui,sans-serif;
      font-weight:900;
      line-height:1;
      text-shadow:0 1px 2px #000;
      transition:opacity .1s ease,transform .1s ease,filter .1s ease;
    }
    body.mode-adventure #choices .choice-card .adv-choice-preview--upgrade{
      top:31px;
      right:3px;
      padding:2px 4px;
      border-radius:8px;
      color:#eaffdf;
      background:rgba(25,93,43,.94);
      border:1px solid rgba(173,239,157,.8);
      font-size:8px;
      opacity:.88;
    }
    body.mode-adventure #choices .choice-card:hover .adv-choice-preview--upgrade,
    body.mode-adventure #choices .choice-card.adv-choice-preview-active .adv-choice-preview--upgrade{
      opacity:1;
      transform:scale(1.08);
      filter:drop-shadow(0 0 5px rgba(150,235,130,.75));
    }
    body.mode-adventure #choices .choice-card .adv-choice-preview--seal{
      left:50%;
      top:5px;
      transform:translateX(-50%) scale(.82);
      width:21px;
      height:21px;
      border-radius:50%;
      display:flex;
      align-items:center;
      justify-content:center;
      color:#3b1d0a;
      background:radial-gradient(circle at 35% 30%,#ffd46d,#a55718 68%,#5d270b);
      border:1px solid #ffe29a;
      box-shadow:0 1px 3px #000;
      opacity:.28;
      font-size:10px;
    }
    body.mode-adventure #choices .choice-card:hover .adv-choice-preview--seal,
    body.mode-adventure #choices .choice-card.adv-choice-preview-active .adv-choice-preview--seal{
      opacity:1;
      transform:translateX(-50%) scale(1);
    }
    body.mode-adventure #choices .choice-card .adv-choice-preview--banish{
      inset:0;
      display:flex;
      align-items:center;
      justify-content:center;
      color:#ffbbb1;
      background:rgba(68,8,5,.44);
      border:2px solid rgba(220,76,62,.82);
      border-radius:inherit;
      font:900 42px/1 Georgia,serif;
      opacity:0;
    }
    body.mode-adventure #choices .choice-card:hover .adv-choice-preview--banish,
    body.mode-adventure #choices .choice-card.adv-choice-preview-active .adv-choice-preview--banish{opacity:1}
    body.mode-adventure #choices .choice-card .adv-choice-preview--transmute{
      top:3px;
      left:23px;
      color:#d9f5c9;
      background:rgba(44,89,34,.94);
      border:1px solid rgba(164,220,137,.8);
      border-radius:8px;
      padding:2px 5px;
      font-size:10px;
      opacity:.7;
    }
    body.mode-adventure #choices .choice-card:hover .adv-choice-preview--transmute,
    body.mode-adventure #choices .choice-card.adv-choice-preview-active .adv-choice-preview--transmute{
      opacity:1;
      transform:scale(1.08);
    }

    @media(max-width:640px){
      body.mode-adventure .card > .adv-sigil-seal{
        width:13px;
        height:13px;
        top:2px;
        left:2px;
        font-size:10px;
      }
      body.mode-adventure #choices .choice-card .adv-choice-preview--upgrade{top:26px;font-size:7px}
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

function adventureDeckCards(target) {
  const cards = target.tlrAdventureBuildDeck?.();
  return Array.isArray(cards) ? cards : [];
}

function cardForElement(target, element) {
  const uid = String(element?.dataset?.uid ?? '');
  if (uid) {
    const runtime = allRuntimeCards(target).find(card => String(card?.uid ?? '') === uid);
    if (runtime) return runtime;
  }

  const renderedTitle = element?.querySelector?.('.title')?.textContent?.trim();
  if (!renderedTitle) return null;
  const pool = [...adventureDeckCards(target), ...allRuntimeCards(target)];
  return pool.find(card => {
    try {
      return cardTitle(card) === renderedTitle;
    } catch {
      return card?.name === renderedTitle;
    }
  }) || null;
}

function sigilForCard(card) {
  const node = card?.adventureNodeOverride || cardAdventureProfile(card)?.node || null;
  return sigilForNode(node);
}

function removeSigils(doc) {
  doc?.querySelectorAll('.adv-sigil-seal[data-adv-runtime-sigil="1"]').forEach(element => element.remove());
}

function clearRewardChoicePreview(element) {
  element?.removeAttribute('data-adv-reward-choice');
  element?.classList.remove('adv-choice-preview-active');
  element?.querySelectorAll('.adv-choice-preview').forEach(preview => preview.remove());
}

function decorateRewardChoices(target) {
  const doc = target.document;
  const title = doc.getElementById('modalTitle')?.textContent?.trim() || '';
  const kind = REWARD_CHOICE_KIND[title] || null;
  const choices = [...doc.querySelectorAll('#choices .choice-card')];

  for (const element of choices) {
    if (!kind || !target.__tlrAdventureActive) {
      clearRewardChoicePreview(element);
      continue;
    }

    const card = cardForElement(target, element);
    if (!card) {
      clearRewardChoicePreview(element);
      continue;
    }

    if (element.dataset.advRewardChoice !== kind) clearRewardChoicePreview(element);
    element.dataset.advRewardChoice = kind;

    let preview = element.querySelector(`:scope > .adv-choice-preview--${kind}`);
    if (!preview) {
      preview = doc.createElement('span');
      preview.className = `adv-choice-preview adv-choice-preview--${kind}`;
      preview.setAttribute('aria-hidden', 'true');
      element.appendChild(preview);
    }

    if (kind === 'upgrade') {
      const current = Number(card.points || 0);
      preview.textContent = `${current}→${Math.min(5, current + 1)}`;
      element.title = `${cardTitle(card)}: ${current} to ${Math.min(5, current + 1)}`;
    } else if (kind === 'seal') {
      preview.textContent = '◆';
      element.title = `${cardTitle(card)} will appear in every opening hand`;
    } else if (kind === 'banish') {
      preview.textContent = '×';
      element.title = `Banish ${cardTitle(card)}`;
    } else if (kind === 'transmute') {
      preview.textContent = `→ ${sigilForNode('transformation')?.glyph || '∿'}`;
      element.title = `${cardTitle(card)} gains the Serpent sigil`;
    }
  }
}

function decorateApproachRequirements(target) {
  const doc = target.document;
  const web = doc.getElementById('advApproachWeb');
  if (!web || web.classList.contains('hidden')) return;
  const eventId = doc.getElementById('advEventDeck')?.dataset?.eventId;
  if (!eventId) return;

  const setIndex = Math.max(0, Number(target[REQUIREMENT_SET_KEY] || 0));
  const requirements = new Map(getEventApproaches(eventId).map(approach => [
    approach.node,
    Math.min(5, Math.max(1, Number(approach.requirement || 1) + setIndex)),
  ]));

  const svg = web.querySelector('svg');
  if (!svg) return;
  const groups = [...svg.children].filter(child => child.tagName?.toLowerCase() === 'g');

  for (const group of groups) {
    const circle = group.querySelector(':scope > circle');
    const label = [...group.querySelectorAll(':scope > text')]
      .find(text => !text.hasAttribute('data-adv-approach-requirement'));
    const node = label?.textContent?.trim().toLowerCase();
    const requirement = requirements.get(node);
    let marker = group.querySelector(':scope > text[data-adv-approach-requirement]');

    if (!circle || !requirement) {
      marker?.remove();
      continue;
    }

    if (!marker) {
      marker = doc.createElementNS(SVG_NS, 'text');
      marker.setAttribute('data-adv-approach-requirement', '1');
      marker.setAttribute('class', 'adv-approach-requirement');
      group.appendChild(marker);
    }
    marker.setAttribute('x', circle.getAttribute('cx') || '0');
    marker.setAttribute('y', circle.getAttribute('cy') || '0');
    marker.textContent = String(requirement);
  }
}

function installRequirementSetTracking(target) {
  if (target.__tlrAdventureRequirementTrackingInstalled) return;
  target.__tlrAdventureRequirementTrackingInstalled = true;
  target[REQUIREMENT_SET_KEY] = 0;

  const wrapReset = name => {
    const original = target[name];
    if (typeof original !== 'function' || original.__tlrRequirementResetWrapped) return;
    const wrapped = function (...args) {
      target[REQUIREMENT_SET_KEY] = 0;
      return original.apply(this, args);
    };
    wrapped.__tlrRequirementResetWrapped = true;
    target[name] = wrapped;
  };

  wrapReset('tlrStartAdventure');
  wrapReset('tlrAdventureV3Restart');
  wrapReset('tlrAdventureRestart');

  const recovery = target.tlrAdventureV3Recovery;
  if (typeof recovery === 'function' && !recovery.__tlrRequirementAdvanceWrapped) {
    const wrappedRecovery = function (...args) {
      const result = recovery.apply(this, args);
      target[REQUIREMENT_SET_KEY] = Number(target[REQUIREMENT_SET_KEY] || 0) + 1;
      target.__tlrAdventureCardSigilsSchedule?.();
      return result;
    };
    wrappedRecovery.__tlrRequirementAdvanceWrapped = true;
    target.tlrAdventureV3Recovery = wrappedRecovery;
  }
}

function decorate(target = window) {
  const doc = target?.document;
  if (!doc) return;
  ensureStyle(doc);

  if (!target.__tlrAdventureActive || !doc.body.classList.contains('mode-adventure')) {
    removeSigils(doc);
    doc.querySelectorAll('#choices .choice-card').forEach(clearRewardChoicePreview);
    return;
  }

  doc.querySelectorAll('#hand .card, #spread .card, #choices .card, .card-detail-card .card').forEach(element => {
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

  decorateRewardChoices(target);
  decorateApproachRequirements(target);
}

export function installAdventureCardSigils(target = window) {
  const doc = target?.document;
  if (!doc) return;
  ensureStyle(doc);
  installRequirementSetTracking(target);

  if (target.__tlrAdventureCardSigilsInstalled) {
    target.__tlrAdventureCardSigilsSchedule?.();
    return;
  }
  target.__tlrAdventureCardSigilsInstalled = true;

  let frame = 0;
  const schedule = () => {
    if (frame) return;
    frame = target.requestAnimationFrame(() => {
      frame = 0;
      decorate(target);
    });
  };
  target.__tlrAdventureCardSigilsSchedule = schedule;

  const roots = () => [
    doc.getElementById('hand'),
    doc.getElementById('spread'),
    doc.getElementById('summary'),
    doc.getElementById('modal'),
    doc.getElementById('advApproachWeb'),
  ].filter(Boolean);

  const disconnectContent = () => {
    target.__tlrAdventureCardSigilsContentObservers?.forEach(observer => observer.disconnect());
    target.__tlrAdventureCardSigilsContentObservers = [];
  };

  const observeContent = () => {
    disconnectContent();
    if (!target.__tlrAdventureActive && !doc.body.classList.contains('mode-adventure')) return;
    target.__tlrAdventureCardSigilsContentObservers = roots().map(root => {
      const observer = new target.MutationObserver(schedule);
      observer.observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
      return observer;
    });
    schedule();
  };

  const syncMode = () => {
    if (target.__tlrAdventureActive || doc.body.classList.contains('mode-adventure')) {
      target.requestAnimationFrame(observeContent);
    } else {
      disconnectContent();
      removeSigils(doc);
    }
  };

  doc.addEventListener('pointerdown', event => {
    const card = event.target.closest?.('#choices .choice-card[data-adv-reward-choice]');
    if (card) card.classList.add('adv-choice-preview-active');
  }, true);
  doc.addEventListener('pointerup', event => {
    event.target.closest?.('#choices .choice-card[data-adv-reward-choice]')?.classList.remove('adv-choice-preview-active');
  }, true);
  doc.addEventListener('pointercancel', () => {
    doc.querySelectorAll('#choices .choice-card.adv-choice-preview-active').forEach(card => card.classList.remove('adv-choice-preview-active'));
  }, true);

  target.__tlrAdventureCardSigilsModeObserver?.disconnect?.();
  const modeObserver = new target.MutationObserver(syncMode);
  modeObserver.observe(doc.body, { attributes: true, attributeFilter: ['class'] });
  target.__tlrAdventureCardSigilsModeObserver = modeObserver;

  syncMode();
}
