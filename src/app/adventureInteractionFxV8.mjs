import { ACTION_NODES } from '../data/adventure/nodes.mjs';
import {
  NODE_VISUALS,
  OUTCOME_VISUALS,
  installAdventureInteractionFxV6,
  playAdventureInteractionFx as playAdventureInteractionFxV6,
} from './adventureInteractionFxV6.mjs';
import {
  playAggressionApparition,
} from './apparitions/aggressionApparition.mjs';

// V8 replaces the baked WebP apparition used in V7 with a fully code-driven
// spectral blade (see ./apparitions/aggressionApparition.mjs). The orchestration
// is otherwise identical: the apparition plays above the played card while the
// shared V6 sequence handles the event's outcome reaction, and the bridge keeps
// the result panel hidden until both have finished.

const STYLE_ID = 'adventure-interaction-fx-v8-style';

export { NODE_VISUALS, OUTCOME_VISUALS };

function ensureStyle(doc) {
  if (!doc || doc.getElementById(STYLE_ID)) return;
  const style = doc.createElement('style');
  style.id = STYLE_ID;
  // While the code apparition is on screen we hide V6's own static blade sprite
  // and its label so the two don't fight for the same space above the card.
  style.textContent = `
    body.adv-aggression-code-active #advInteractionFxV6 .adv-node-sprite-stage,
    body.adv-aggression-code-active #advInteractionFxV6 .adv-node-sprite-label{
      visibility:hidden!important;
    }
  `;
  doc.head.appendChild(style);
}

function findPlacedCard(target, slotIndex) {
  const slot = target._slotEls?.[slotIndex]
    || target.document?.querySelectorAll?.('#spread > .slot')?.[slotIndex]
    || null;
  return slot?.querySelector?.(':scope > .card') || slot || null;
}

function rectOf(card) {
  const rect = card?.getBoundingClientRect?.();
  if (!rect || !rect.width || !rect.height) return null;
  return { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
}

// A short directional recoil + flash on the played card when the slash lands,
// so the blade reads as actually striking the Event rather than passing over it.
function joltCard(card) {
  if (!card?.animate) return;
  card.animate([
    { transform: 'translate(0,0) rotate(0deg)', filter: 'brightness(1)' },
    { transform: 'translate(4px,5px) rotate(1.4deg)', filter: 'brightness(1.45)', offset: 0.22 },
    { transform: 'translate(-3px,-2px) rotate(-.8deg)', filter: 'brightness(1.12)', offset: 0.5 },
    { transform: 'translate(2px,1px) rotate(.4deg)', filter: 'brightness(1.04)', offset: 0.75 },
    { transform: 'translate(0,0) rotate(0deg)', filter: 'brightness(1)' },
  ], { duration: 340, easing: 'cubic-bezier(.3,.7,.3,1)' });
}

export function installAdventureInteractionFxV8(target = window) {
  if (!target?.document || target.__tlrAdventureInteractionFxV8Installed) return;
  target.__tlrAdventureInteractionFxV8Installed = true;
  ensureStyle(target.document);
  installAdventureInteractionFxV6(target);
}

export async function playAdventureInteractionFx(options) {
  const target = options?.target || window;
  installAdventureInteractionFxV8(target);

  if (options?.resolution?.resolvedNode !== ACTION_NODES.AGGRESSION) {
    return playAdventureInteractionFxV6(options);
  }

  const card = findPlacedCard(target, options.slotIndex);
  const anchor = rectOf(card);
  if (!anchor) return playAdventureInteractionFxV6(options);

  const reduced = target.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false;
  target.document.body.classList.add('adv-aggression-code-active');
  const apparition = playAggressionApparition(target, anchor, {
    reduced,
    onImpact: () => joltCard(card),
  }).catch(() => false);
  try {
    const result = await playAdventureInteractionFxV6(options);
    await apparition;
    return result;
  } finally {
    target.document.body.classList.remove('adv-aggression-code-active');
  }
}

if (typeof window !== 'undefined') installAdventureInteractionFxV8(window);
