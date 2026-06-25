import {
  NODE_VISUALS,
  OUTCOME_VISUALS,
  installAdventureInteractionFxV6,
  playAdventureInteractionFx as playAdventureInteractionFxV6,
} from './adventureInteractionFxV6.mjs';
import { apparitionFor } from './apparitions/registry.mjs';

// V8 replaces V6's baked sprite-sheet node animation with fully code-driven
// apparitions: each action node summons a ghostly object that acts on the Event
// (see ./apparitions/). The apparition plays above the played card while the
// shared V6 sequence handles the outcome reaction, and the bridge keeps the
// result panel hidden until both have finished. Any node without an apparition
// falls back to V6's original sprite.

const STYLE_ID = 'adventure-interaction-fx-v8-style';

export { NODE_VISUALS, OUTCOME_VISUALS };

function ensureStyle(doc) {
  if (!doc || doc.getElementById(STYLE_ID)) return;
  const style = doc.createElement('style');
  style.id = STYLE_ID;
  // While a code apparition is on screen we hide V6's own static node sprite and
  // its label so the two don't fight for the same space above the card.
  style.textContent = `
    body.adv-apparition-active #advInteractionFxV6 .adv-node-sprite-stage,
    body.adv-apparition-active #advInteractionFxV6 .adv-node-sprite-label{
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
// The amplitude scales subtly with potency (1 at the baseline of 3).
function joltCard(card, amp = 1) {
  if (!card?.animate) return;
  const x = (v) => (v * amp).toFixed(2);
  card.animate([
    { transform: 'translate(0,0) rotate(0deg)', filter: 'brightness(1)' },
    { transform: `translate(${x(4)}px,${x(5)}px) rotate(${x(1.4)}deg)`, filter: 'brightness(1.45)', offset: 0.22 },
    { transform: `translate(${x(-3)}px,${x(-2)}px) rotate(${x(-0.8)}deg)`, filter: 'brightness(1.12)', offset: 0.5 },
    { transform: `translate(${x(2)}px,${x(1)}px) rotate(${x(0.4)}deg)`, filter: 'brightness(1.04)', offset: 0.75 },
    { transform: 'translate(0,0) rotate(0deg)', filter: 'brightness(1)' },
  ], { duration: 340, easing: 'cubic-bezier(.3,.7,.3,1)' });
}

function joltAmplitude(potency) {
  const level = Math.max(1, Math.min(5, Math.round(Number(potency) || 3)));
  return 1 + ((level - 3) / 2) * 0.35; // ~0.65 .. 1.35
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

  // The apparition is chosen by the played card's own node (falling back to the
  // resolved node), so every card shows its characteristic summon; V6 still uses
  // the resolved node + tier for the Event's outcome reaction.
  const apparitionNode = options?.resolution?.cardNode ?? options?.resolution?.resolvedNode;
  const play = apparitionFor(apparitionNode);
  if (!play) return playAdventureInteractionFxV6(options);

  const card = findPlacedCard(target, options.slotIndex);
  const anchor = rectOf(card);
  if (!anchor) return playAdventureInteractionFxV6(options);

  const potency = options.resolution.potency;
  const reduced = target.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false;
  const amp = joltAmplitude(potency);
  target.document.body.classList.add('adv-apparition-active');
  const apparition = Promise.resolve(play(target, anchor, {
    reduced,
    potency,
    onImpact: () => joltCard(card, amp),
  })).catch(() => false);
  try {
    const result = await playAdventureInteractionFxV6(options);
    await apparition;
    return result;
  } finally {
    target.document.body.classList.remove('adv-apparition-active');
  }
}

if (typeof window !== 'undefined') installAdventureInteractionFxV8(window);
