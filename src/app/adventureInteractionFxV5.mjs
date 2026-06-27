import { ACTION_NODES } from '../data/adventure/nodes.mjs';

const STYLE_ID = 'adventure-interaction-fx-v5-style';
const ROOT_ID = 'advInteractionFxV5';
const NODE_SHEET_URL = '/ui/single-player-v2/Event-Visuals-Node.png';
const OUTCOME_SHEET_URL = '/ui/single-player-v2/Event-Outcome-Sheet.png';
const SHEET_WIDTH = 1491;
const SHEET_HEIGHT = 1055;

const NODE_ROWS = Object.freeze([
  Object.freeze({ y: 29, h: 168 }),
  Object.freeze({ y: 290, h: 168 }),
  Object.freeze({ y: 543, h: 162 }),
  Object.freeze({ y: 783, h: 160 }),
]);
const NODE_COLUMNS = Object.freeze([20, 494, 966]);
const NODE_FRAME_OFFSETS = Object.freeze([3, 157, 311]);
const NODE_FRAME_WIDTH = 145;

function nodeFrames(row, column) {
  const band = NODE_ROWS[row];
  return NODE_FRAME_OFFSETS.map(offset => Object.freeze({
    x: NODE_COLUMNS[column] + offset,
    y: band.y,
    w: NODE_FRAME_WIDTH,
    h: band.h,
  }));
}

export const NODE_VISUALS = Object.freeze({
  [ACTION_NODES.PHYSICAL]: Object.freeze({ icon: 'fist', label: 'Physical', frames: nodeFrames(0, 0) }),
  [ACTION_NODES.AGGRESSION]: Object.freeze({ icon: 'blade', label: 'Aggression', frames: nodeFrames(0, 1) }),
  [ACTION_NODES.PROTECTION]: Object.freeze({ icon: 'shield', label: 'Protection', frames: nodeFrames(0, 2) }),
  [ACTION_NODES.ENDURANCE]: Object.freeze({ icon: 'stone', label: 'Endurance', frames: nodeFrames(1, 0) }),
  [ACTION_NODES.COMPASSION]: Object.freeze({ icon: 'chalice', label: 'Compassion', frames: nodeFrames(1, 1) }),
  [ACTION_NODES.AUTHORITY]: Object.freeze({ icon: 'seal', label: 'Authority', frames: nodeFrames(1, 2) }),
  [ACTION_NODES.MYSTERY]: Object.freeze({ icon: 'moon', label: 'Mystery', frames: nodeFrames(2, 0) }),
  [ACTION_NODES.DECEPTION]: Object.freeze({ icon: 'mask', label: 'Deception', frames: nodeFrames(2, 1) }),
  [ACTION_NODES.INVESTIGATION]: Object.freeze({ icon: 'lantern', label: 'Investigation', frames: nodeFrames(2, 2) }),
  [ACTION_NODES.TRANSFORMATION]: Object.freeze({ icon: 'moth', label: 'Transformation', frames: nodeFrames(3, 0) }),
  [ACTION_NODES.CREATION]: Object.freeze({ icon: 'sprout', label: 'Creation', frames: nodeFrames(3, 1) }),
  [ACTION_NODES.FORTUNE]: Object.freeze({ icon: 'die', label: 'Fortune', frames: nodeFrames(3, 2) }),
});

const OUTCOME_FRAME_X = Object.freeze([225, 527, 830, 1129]);
const OUTCOME_ROW_Y = Object.freeze({ failure: 76, success: 385, great_success: 692 });

function outcomeFrames(tier) {
  return OUTCOME_FRAME_X.map(x => Object.freeze({
    x,
    y: OUTCOME_ROW_Y[tier],
    w: 268,
    h: 275,
  }));
}

export const OUTCOME_VISUALS = Object.freeze({
  failure: Object.freeze({ label: 'Failure', frames: outcomeFrames('failure') }),
  success: Object.freeze({ label: 'Success', frames: outcomeFrames('success') }),
  great_success: Object.freeze({ label: 'Great Success', frames: outcomeFrames('great_success') }),
});

const assetPromises = new WeakMap();

function ensureStyle(doc) {
  if (!doc || doc.getElementById(STYLE_ID)) return;
  const style = doc.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    body.mode-adventure.adv-sprite-resolving #advEventDeck{opacity:0!important}
    #${ROOT_ID}{position:fixed;inset:0;z-index:2147482500;pointer-events:none;overflow:hidden}
    .adv-sprite-event-card{position:fixed!important;margin:0!important;transform:none!important;z-index:2!important;
      box-sizing:border-box!important;will-change:transform,filter,box-shadow,opacity}
    .adv-node-sprite-wrap{position:fixed;z-index:4;display:flex;flex-direction:column;align-items:center;
      transform:translate(-50%,-100%);opacity:0;will-change:opacity,transform,filter}
    .adv-node-sprite-frame,.adv-outcome-sprite-frame{background-repeat:no-repeat;background-color:transparent;
      mix-blend-mode:screen;will-change:background-position,opacity,transform,filter}
    .adv-node-sprite-frame{filter:drop-shadow(0 8px 12px rgba(0,0,0,.68)) drop-shadow(0 0 10px rgba(226,183,101,.28))}
    .adv-node-sprite-label{margin-top:2px;padding:4px 9px;border-radius:999px;background:rgba(13,8,6,.9);
      border:1px solid rgba(231,197,125,.55);box-shadow:0 4px 12px rgba(0,0,0,.5);color:#efd7a5;
      font:900 8px/1 system-ui,sans-serif;letter-spacing:.13em;text-transform:uppercase;white-space:nowrap}
    .adv-outcome-sprite-wrap{position:fixed;z-index:5;transform:translate(-50%,-50%);opacity:0;
      display:flex;flex-direction:column;align-items:center;will-change:opacity,transform}
    .adv-outcome-sprite-frame{filter:drop-shadow(0 0 12px rgba(226,183,101,.4))}
    .adv-outcome-sprite-label{margin-top:-3px;padding:5px 10px;border-radius:999px;background:rgba(13,8,6,.92);
      border:1px solid currentColor;box-shadow:0 4px 14px rgba(0,0,0,.55);font:900 9px/1 system-ui,sans-serif;
      letter-spacing:.13em;text-transform:uppercase;white-space:nowrap}
    .adv-outcome-sprite-wrap--failure{color:#d26c63}
    .adv-outcome-sprite-wrap--success{color:#e4b65c}
    .adv-outcome-sprite-wrap--great_success{color:#ffe2a0}
    @media(max-width:640px){
      .adv-node-sprite-label{font-size:7px;padding:4px 7px}
      .adv-outcome-sprite-label{font-size:8px}
    }
  `;
  doc.head.appendChild(style);
}

function wait(target, ms) {
  return new Promise(resolve => target.setTimeout(resolve, ms));
}

function finished(animation, fallbackMs) {
  if (!animation?.finished) return new Promise(resolve => setTimeout(resolve, fallbackMs));
  return animation.finished.catch(() => undefined);
}

function animate(el, frames, options) {
  if (!el?.animate) return finished(null, Number(options?.duration || 0));
  return finished(el.animate(frames, options), Number(options?.duration || 0));
}

function preloadImage(target, url) {
  return new Promise(resolve => {
    if (!target.Image) { resolve(false); return; }
    const image = new target.Image();
    image.onload = () => resolve(true);
    image.onerror = () => resolve(false);
    image.src = url;
    if (image.complete) resolve(true);
  });
}

function assetsReady(target) {
  if (!assetPromises.has(target)) {
    assetPromises.set(target, Promise.all([
      preloadImage(target, NODE_SHEET_URL),
      preloadImage(target, OUTCOME_SHEET_URL),
    ]));
  }
  return assetPromises.get(target);
}

function applyCrop(element, sheetUrl, crop, displayWidth) {
  const scale = displayWidth / crop.w;
  element.style.width = `${displayWidth}px`;
  element.style.height = `${crop.h * scale}px`;
  element.style.backgroundImage = `url("${sheetUrl}")`;
  element.style.backgroundSize = `${SHEET_WIDTH * scale}px ${SHEET_HEIGHT * scale}px`;
  element.style.backgroundPosition = `${-crop.x * scale}px ${-crop.y * scale}px`;
}

async function playFrames(target, element, sheetUrl, frames, { displayWidth, frameMs, holdLastMs = 0 }) {
  for (const crop of frames) {
    applyCrop(element, sheetUrl, crop, displayWidth);
    await wait(target, frameMs);
  }
  if (holdLastMs) await wait(target, holdLastMs);
}

function captureEventSnapshot(doc, event) {
  const card = doc.querySelector('#advEventDeck .adv-deck__top');
  if (!card) return null;
  const rect = card.getBoundingClientRect();
  if (!rect.width || !rect.height) return null;
  return {
    rect: { left: rect.left, top: rect.top, width: rect.width, height: rect.height },
    html: card.innerHTML,
    eventId: event?.id || null,
  };
}

function findSlot(target, slotIndex) {
  return target._slotEls?.[slotIndex]
    || target.document?.querySelectorAll?.('#spread > .slot')?.[slotIndex]
    || null;
}

function createEventClone(doc, snapshot) {
  const clone = doc.createElement('div');
  clone.className = 'adv-deck__top adv-sprite-event-card';
  clone.innerHTML = snapshot.html;
  Object.assign(clone.style, {
    left: `${snapshot.rect.left}px`,
    top: `${snapshot.rect.top}px`,
    width: `${snapshot.rect.width}px`,
    height: `${snapshot.rect.height}px`,
  });
  return clone;
}

function createNodeSprite(doc, visual, cardRect, displayWidth) {
  const wrap = doc.createElement('div');
  wrap.className = 'adv-node-sprite-wrap';
  wrap.style.left = `${cardRect.left + cardRect.width / 2}px`;
  wrap.style.top = `${cardRect.top - 5}px`;
  const frame = doc.createElement('div');
  frame.className = 'adv-node-sprite-frame';
  applyCrop(frame, NODE_SHEET_URL, visual.frames[0], displayWidth);
  const label = doc.createElement('div');
  label.className = 'adv-node-sprite-label';
  label.textContent = visual.label;
  wrap.append(frame, label);
  return { wrap, frame };
}

function createOutcomeSprite(doc, visual, tier, eventRect, displayWidth) {
  const wrap = doc.createElement('div');
  wrap.className = `adv-outcome-sprite-wrap adv-outcome-sprite-wrap--${tier}`;
  wrap.style.left = `${eventRect.left + eventRect.width / 2}px`;
  wrap.style.top = `${eventRect.top + eventRect.height / 2}px`;
  const frame = doc.createElement('div');
  frame.className = 'adv-outcome-sprite-frame';
  applyCrop(frame, OUTCOME_SHEET_URL, visual.frames[0], displayWidth);
  const label = doc.createElement('div');
  label.className = 'adv-outcome-sprite-label';
  label.textContent = visual.label;
  wrap.append(frame, label);
  return { wrap, frame };
}

function eventReactionFrames(tier) {
  if (tier === 'failure') {
    return [
      { transform: 'translateX(0)', filter: 'brightness(1)' },
      { transform: 'translateX(-7px)', filter: 'brightness(.74) sepia(.32)' },
      { transform: 'translateX(6px)' },
      { transform: 'translateX(-4px)' },
      { transform: 'translateX(0)', filter: 'brightness(.88)' },
    ];
  }
  if (tier === 'great_success') {
    return [
      { transform: 'translateY(0) scale(1)', filter: 'brightness(1)' },
      { transform: 'translateY(-8px) scale(1.07)', filter: 'brightness(1.35)' },
      { transform: 'translateY(-3px) scale(1.025)', filter: 'brightness(1.14)' },
    ];
  }
  return [
    { transform: 'scale(1)', filter: 'brightness(1)' },
    { transform: 'scale(1.045)', filter: 'brightness(1.18)' },
    { transform: 'scale(1)', filter: 'brightness(1.07)' },
  ];
}

export function installAdventureInteractionFxV5(target = window) {
  if (!target?.document || target.__tlrAdventureInteractionFxV5Installed) return;
  target.__tlrAdventureInteractionFxV5Installed = true;
  ensureStyle(target.document);
  assetsReady(target);
}

export async function playAdventureInteractionFx({
  target = window,
  slotIndex,
  card,
  event,
  resolution,
}) {
  installAdventureInteractionFxV5(target);
  const doc = target.document;
  const slot = findSlot(target, slotIndex);
  const played = slot?.querySelector?.(':scope > .card') || slot;
  const snapshot = captureEventSnapshot(doc, event);
  const tier = resolution?.tier;
  if (!doc || !played || !snapshot || !tier) return false;

  const cardRect = played.getBoundingClientRect();
  if (!cardRect.width || !cardRect.height) return false;

  await assetsReady(target);

  const nodeVisual = NODE_VISUALS[resolution.resolvedNode] || NODE_VISUALS[ACTION_NODES.FORTUNE];
  const outcomeVisual = OUTCOME_VISUALS[tier];
  if (!nodeVisual || !outcomeVisual) return false;

  const reduced = target.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const nodeWidth = reduced ? 72 : (cardRect.width < 90 ? 82 : 98);
  const outcomeWidth = snapshot.rect.width * (reduced ? 1.02 : 1.24);

  const root = doc.createElement('div');
  root.id = ROOT_ID;
  const eventClone = createEventClone(doc, snapshot);
  const nodeSprite = createNodeSprite(doc, nodeVisual, cardRect, nodeWidth);
  const outcomeSprite = createOutcomeSprite(doc, outcomeVisual, tier, snapshot.rect, outcomeWidth);
  root.append(eventClone, nodeSprite.wrap, outcomeSprite.wrap);
  doc.getElementById(ROOT_ID)?.remove();
  doc.body.appendChild(root);
  doc.body.classList.add('adv-sprite-resolving');

  const nodeEnterMs = reduced ? 90 : 230;
  const nodeFrameMs = reduced ? 100 : 260;
  const nodeHoldMs = reduced ? 60 : 220;
  const nodeExitMs = reduced ? 80 : 180;
  const outcomeEnterMs = reduced ? 100 : 210;
  const outcomeFrameMs = reduced ? 110 : 245;
  const outcomeHoldMs = reduced ? 100 : 440;
  const outcomeExitMs = reduced ? 90 : 190;

  try {
    await Promise.all([
      animate(nodeSprite.wrap, [
        { opacity: 0, transform: 'translate(-50%,-100%) translateY(10px) scale(.72)' },
        { opacity: 1, transform: 'translate(-50%,-100%) translateY(-4px) scale(1.04)' },
        { opacity: 1, transform: 'translate(-50%,-100%) translateY(0) scale(1)' },
      ], { duration: nodeEnterMs, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'forwards' }),
      animate(played, [
        { transform: 'translateY(0) scale(1)', filter: 'brightness(1)' },
        { transform: 'translateY(-5px) scale(1.025)', filter: 'brightness(1.16)' },
        { transform: 'translateY(0) scale(1)', filter: 'brightness(1)' },
      ], { duration: nodeEnterMs + 120, easing: 'ease-out' }),
    ]);

    await playFrames(target, nodeSprite.frame, NODE_SHEET_URL, nodeVisual.frames, {
      displayWidth: nodeWidth,
      frameMs: nodeFrameMs,
      holdLastMs: nodeHoldMs,
    });

    await animate(nodeSprite.wrap, [
      { opacity: 1, transform: 'translate(-50%,-100%) scale(1)' },
      { opacity: 0, transform: 'translate(-50%,-100%) scale(.78)' },
    ], { duration: nodeExitMs, easing: 'ease-in', fill: 'forwards' });

    await Promise.all([
      animate(outcomeSprite.wrap, [
        { opacity: 0, transform: 'translate(-50%,-50%) scale(.76)' },
        { opacity: 1, transform: 'translate(-50%,-50%) scale(1.03)' },
        { opacity: 1, transform: 'translate(-50%,-50%) scale(1)' },
      ], { duration: outcomeEnterMs, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'forwards' }),
      animate(eventClone, eventReactionFrames(tier), {
        duration: outcomeEnterMs + outcomeFrameMs * outcomeVisual.frames.length,
        easing: 'ease-out',
        fill: 'forwards',
      }),
      playFrames(target, outcomeSprite.frame, OUTCOME_SHEET_URL, outcomeVisual.frames, {
        displayWidth: outcomeWidth,
        frameMs: outcomeFrameMs,
        holdLastMs: outcomeHoldMs,
      }),
    ]);

    await Promise.all([
      animate(outcomeSprite.wrap, [
        { opacity: 1, transform: 'translate(-50%,-50%) scale(1)' },
        { opacity: 0, transform: 'translate(-50%,-50%) scale(1.04)' },
      ], { duration: outcomeExitMs, fill: 'forwards' }),
      animate(eventClone, [{ opacity: 1 }, { opacity: 0 }], { duration: outcomeExitMs, fill: 'forwards' }),
    ]);
    return true;
  } finally {
    root.remove();
    doc.body.classList.remove('adv-sprite-resolving');
  }
}

if (typeof window !== 'undefined') installAdventureInteractionFxV5(window);
