import { ACTION_NODES } from '../data/adventure/nodes.mjs';
import {
  NODE_VISUALS,
  OUTCOME_VISUALS,
  installAdventureInteractionFxV6,
  playAdventureInteractionFx as playAdventureInteractionFxV6,
} from './adventureInteractionFxV6.mjs';
import {
  AGGRESSION_WEBP_DATA_URL,
  AGGRESSION_WEBP_DURATION_MS,
} from './apparitions/aggressionWebp.mjs';

const STYLE_ID = 'adventure-interaction-fx-v7-style';
const APPARITION_ID = 'advAggressionWebpApparition';

export { NODE_VISUALS, OUTCOME_VISUALS };

function ensureStyle(doc) {
  if (!doc || doc.getElementById(STYLE_ID)) return;
  const style = doc.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    body.adv-aggression-webp-active #advInteractionFxV6 .adv-node-sprite-stage,
    body.adv-aggression-webp-active #advInteractionFxV6 .adv-node-sprite-label{
      visibility:hidden!important;
    }
    #${APPARITION_ID}{
      position:fixed;
      z-index:2147482800;
      width:220px;
      height:220px;
      object-fit:contain;
      pointer-events:none;
      transform:translate(-50%,-100%);
      transform-origin:50% 82%;
      opacity:0;
      mix-blend-mode:screen;
      filter:drop-shadow(0 8px 18px rgba(0,0,0,.62)) drop-shadow(0 0 20px rgba(255,74,55,.38));
      will-change:opacity,transform,filter;
      image-rendering:auto;
    }
    @media(max-width:640px){
      #${APPARITION_ID}{width:176px;height:176px}
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

function animateElement(element, keyframes, options, target) {
  if (!element?.animate) {
    return new Promise(resolve => target.setTimeout(resolve, Number(options?.duration || 0)));
  }
  return element.animate(keyframes, options).finished.catch(() => undefined);
}

async function playAggressionWebp(target, slotIndex) {
  const doc = target.document;
  const played = findPlacedCard(target, slotIndex);
  if (!doc || !played) return false;
  const rect = played.getBoundingClientRect();
  if (!rect.width || !rect.height) return false;

  doc.getElementById(APPARITION_ID)?.remove();
  const image = doc.createElement('img');
  image.id = APPARITION_ID;
  image.alt = '';
  image.decoding = 'async';
  image.src = AGGRESSION_WEBP_DATA_URL;
  image.style.left = `${rect.left + rect.width / 2}px`;
  image.style.top = `${rect.top + Math.min(8, rect.height * 0.08)}px`;
  doc.body.appendChild(image);

  const reduced = target.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const enterMs = reduced ? 80 : 180;
  const exitMs = reduced ? 80 : 180;
  const bodyMs = Math.max(200, (reduced ? 680 : AGGRESSION_WEBP_DURATION_MS) - enterMs - exitMs);

  try {
    await animateElement(image, [
      { opacity: 0, transform: 'translate(-50%,-100%) translateY(12px) scale(.82)', filter: 'blur(3px) drop-shadow(0 0 8px rgba(255,74,55,.12))' },
      { opacity: .94, transform: 'translate(-50%,-100%) translateY(-3px) scale(1.035)', filter: 'blur(.4px) drop-shadow(0 8px 18px rgba(0,0,0,.62)) drop-shadow(0 0 22px rgba(255,74,55,.42))' },
      { opacity: .9, transform: 'translate(-50%,-100%) translateY(0) scale(1)', filter: 'blur(0px) drop-shadow(0 8px 18px rgba(0,0,0,.62)) drop-shadow(0 0 20px rgba(255,74,55,.38))' },
    ], { duration: enterMs, easing: 'cubic-bezier(.2,.75,.2,1)', fill: 'forwards' }, target);

    await new Promise(resolve => target.setTimeout(resolve, bodyMs));

    await animateElement(image, [
      { opacity: .9, transform: 'translate(-50%,-100%) scale(1)', filter: 'blur(0px) drop-shadow(0 8px 18px rgba(0,0,0,.62)) drop-shadow(0 0 20px rgba(255,74,55,.38))' },
      { opacity: 0, transform: 'translate(-50%,-100%) translateY(-8px) scale(1.04)', filter: 'blur(3px) drop-shadow(0 0 24px rgba(255,74,55,.18))' },
    ], { duration: exitMs, easing: 'ease-in', fill: 'forwards' }, target);
    return true;
  } finally {
    image.remove();
  }
}

export function installAdventureInteractionFxV7(target = window) {
  if (!target?.document || target.__tlrAdventureInteractionFxV7Installed) return;
  target.__tlrAdventureInteractionFxV7Installed = true;
  ensureStyle(target.document);
  installAdventureInteractionFxV6(target);

  const preload = new target.Image();
  preload.src = AGGRESSION_WEBP_DATA_URL;
}

export async function playAdventureInteractionFx(options) {
  const target = options?.target || window;
  installAdventureInteractionFxV7(target);

  if (options?.resolution?.resolvedNode !== ACTION_NODES.AGGRESSION) {
    return playAdventureInteractionFxV6(options);
  }

  target.document.body.classList.add('adv-aggression-webp-active');
  const apparitionPromise = playAggressionWebp(target, options.slotIndex).catch(() => false);
  try {
    const result = await playAdventureInteractionFxV6(options);
    await apparitionPromise;
    return result;
  } finally {
    target.document.body.classList.remove('adv-aggression-webp-active');
    target.document.getElementById(APPARITION_ID)?.remove();
  }
}

if (typeof window !== 'undefined') installAdventureInteractionFxV7(window);
