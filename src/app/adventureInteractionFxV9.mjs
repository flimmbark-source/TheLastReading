import {
  NODE_VISUALS,
  OUTCOME_VISUALS,
  installAdventureInteractionFxV6,
  playAdventureInteractionFx as playAdventureInteractionFxV6,
  captureEventSnapshot,
  createEventClone,
  findSlot,
} from './adventureInteractionFxV6.mjs';
import { apparitionFor } from './apparitions/registry.mjs';
import { playEventOutcome } from './apparitions/outcomes.mjs';

// V9 makes the whole Adventure interaction code-driven: the played card summons
// its apparition above itself (see ./apparitions/), and then the Event reacts
// with a fully code-driven Failure / Success / Great Success animation over a
// fixed clone of the Event card (see ./apparitions/outcomes.mjs). The bridge
// keeps the result panel hidden until both have finished. If the Event card
// cannot be captured (or the tier is unknown), it falls back to V6's sprite
// sequence so nothing ever breaks.

const STYLE_ID = 'adventure-interaction-fx-v9-style';
const ROOT_ID = 'advInteractionFxV9';
const TIERS = new Set(['failure', 'success', 'great_success']);

export { NODE_VISUALS, OUTCOME_VISUALS };

function ensureStyle(doc) {
  if (!doc || doc.getElementById(STYLE_ID)) return;
  const style = doc.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `#${ROOT_ID}{position:fixed;inset:0;z-index:2147482600;pointer-events:none}`;
  doc.head.appendChild(style);
}

function findPlacedCard(target, slotIndex) {
  const slot = findSlot(target, slotIndex);
  return slot?.querySelector?.(':scope > .card') || slot || null;
}

function rectOf(card) {
  const rect = card?.getBoundingClientRect?.();
  if (!rect || !rect.width || !rect.height) return null;
  return { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
}

// A short directional recoil + flash on the played card when the apparition
// lands, scaled subtly by potency (1 at the baseline of 3).
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

export function installAdventureInteractionFxV9(target = window) {
  if (!target?.document || target.__tlrAdventureInteractionFxV9Installed) return;
  target.__tlrAdventureInteractionFxV9Installed = true;
  ensureStyle(target.document);
  installAdventureInteractionFxV6(target);
}

export async function playAdventureInteractionFx(options) {
  const target = options?.target || window;
  installAdventureInteractionFxV9(target);
  const doc = target.document;
  const resolution = options?.resolution || {};
  const tier = resolution.tier;

  const snapshot = captureEventSnapshot(doc, options?.event);
  // Need a capturable Event card and a known tier to run the code sequence.
  if (!doc || !snapshot || !TIERS.has(tier)) return playAdventureInteractionFxV6(options);

  const apparitionNode = resolution.cardNode ?? resolution.resolvedNode;
  const play = apparitionFor(apparitionNode);
  const playedCard = findPlacedCard(target, options.slotIndex);
  const anchor = rectOf(playedCard);

  const potency = resolution.potency;
  const reduced = target.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false;
  const amp = joltAmplitude(potency);

  doc.getElementById(ROOT_ID)?.remove();
  const root = doc.createElement('div');
  root.id = ROOT_ID;
  const clone = createEventClone(doc, snapshot);
  root.appendChild(clone);
  doc.body.appendChild(root);
  doc.body.classList.add('adv-sprite-resolving');

  try {
    // 1. The played card summons its apparition, which acts on the Event.
    if (play && anchor) {
      await Promise.resolve(play(target, anchor, {
        potency, reduced, onImpact: () => joltCard(playedCard, amp),
      })).catch(() => false);
    }
    // 2. The Event reacts with its code-driven outcome animation.
    await playEventOutcome(target, { root, card: clone, rect: snapshot.rect, tier, potency, reduced });
    return true;
  } finally {
    root.remove();
    doc.body.classList.remove('adv-sprite-resolving');
  }
}

if (typeof window !== 'undefined') installAdventureInteractionFxV9(window);
