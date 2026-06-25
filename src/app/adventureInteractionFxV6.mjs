import { ACTION_NODES } from '../data/adventure/nodes.mjs';

const STYLE_ID = 'adventure-interaction-fx-v6-style';
const ROOT_ID = 'advInteractionFxV6';
const NODE_SHEET_URL = '/public/ui/single-player-v2/Event-Visuals-Node.png';
const OUTCOME_SHEET_URL = '/public/ui/single-player-v2/Event-Outcome-Sheet.png';
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
    .adv-node-sprite-wrap,.adv-outcome-sprite-wrap{position:fixed;display:flex;flex-direction:column;align-items:center;
      opacity:0;will-change:opacity,transform,filter}
    .adv-node-sprite-wrap{z-index:4;transform:translate(-50%,-100%)}
    .adv-outcome-sprite-wrap{z-index:5;transform:translate(-50%,-50%)}
    .adv-sprite-stage{position:relative;isolation:isolate;overflow:hidden;
      -webkit-mask-image:radial-gradient(ellipse 80% 76% at 50% 48%,#000 38%,rgba(0,0,0,.94) 56%,rgba(0,0,0,.62) 72%,rgba(0,0,0,.24) 86%,transparent 100%);
      mask-image:radial-gradient(ellipse 80% 76% at 50% 48%,#000 38%,rgba(0,0,0,.94) 56%,rgba(0,0,0,.62) 72%,rgba(0,0,0,.24) 86%,transparent 100%);
      -webkit-mask-repeat:no-repeat;mask-repeat:no-repeat;-webkit-mask-size:100% 100%;mask-size:100% 100%}
    .adv-sprite-stage::before{content:'';position:absolute;inset:10%;border-radius:50%;z-index:-1;
      background:radial-gradient(circle,rgba(227,193,126,.16),rgba(111,76,38,.07) 46%,transparent 75%);
      filter:blur(9px);opacity:.72}
    .adv-sprite-layer{position:absolute;inset:0;background-repeat:no-repeat;background-color:transparent;
      mix-blend-mode:screen;opacity:0;will-change:background-position,opacity,transform,filter;
      -webkit-backface-visibility:hidden;backface-visibility:hidden}
    .adv-node-sprite-stage{opacity:.86;filter:drop-shadow(0 7px 13px rgba(0,0,0,.58)) drop-shadow(0 0 12px rgba(226,183,101,.23))}
    .adv-outcome-sprite-stage{opacity:.82;filter:drop-shadow(0 0 13px rgba(226,183,101,.28))}
    .adv-node-sprite-label{margin-top:0;padding:4px 9px;border-radius:999px;background:rgba(13,8,6,.76);
      border:1px solid rgba(231,197,125,.42);box-shadow:0 4px 12px rgba(0,0,0,.38);color:rgba(239,215,165,.9);
      font:900 8px/1 system-ui,sans-serif;letter-spacing:.13em;text-transform:uppercase;white-space:nowrap}
    .adv-outcome-sprite-label{margin-top:-4px;padding:5px 10px;border-radius:999px;background:rgba(13,8,6,.8);
      border:1px solid currentColor;box-shadow:0 4px 14px rgba(0,0,0,.4);font:900 9px/1 system-ui,sans-serif;
      letter-spacing:.13em;text-transform:uppercase;white-space:nowrap;opacity:.9}
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
    let settled = false;
    const done = value => {
      if (settled) return;
      settled = true;
      resolve(value);
    };
    image.onload = () => done(true);
    image.onerror = () => done(false);
    image.src = url;
    if (image.complete && image.naturalWidth > 0) done(true);
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

function setStageSize(stage, crop, displayWidth) {
  const scale = displayWidth / crop.w;
  stage.style.width = `${displayWidth}px`;
  stage.style.height = `${crop.h * scale}px`;
}

function applyCrop(layer, sheetUrl, crop, displayWidth) {
  const scale = displayWidth / crop.w;
  layer.style.backgroundImage = `url("${sheetUrl}")`;
  layer.style.backgroundSize = `${SHEET_WIDTH * scale}px ${SHEET_HEIGHT * scale}px`;
  layer.style.backgroundPosition = `${-crop.x * scale}px ${-crop.y * scale}px`;
}

function createSpriteStage(doc, className, sheetUrl, firstCrop, displayWidth) {
  const stage = doc.createElement('div');
  stage.className = `adv-sprite-stage ${className}`;
  setStageSize(stage, firstCrop, displayWidth);

  const first = doc.createElement('div');
  const second = doc.createElement('div');
  first.className = 'adv-sprite-layer';
  second.className = 'adv-sprite-layer';
  applyCrop(first, sheetUrl, firstCrop, displayWidth);
  first.style.opacity = '1';
  second.style.opacity = '0';
  stage.append(first, second);
  return { stage, layers: [first, second], activeIndex: 0 };
}

async function playFramesCrossfade(target, sprite, sheetUrl, frames, {
  displayWidth,
  frameMs,
  crossfadeMs,
  holdLastMs = 0,
}) {
  if (!frames.length) return;
  setStageSize(sprite.stage, frames[0], displayWidth);
  applyCrop(sprite.layers[sprite.activeIndex], sheetUrl, frames[0], displayWidth);

  const firstHold = Math.max(0, frameMs - crossfadeMs);
  if (firstHold) await wait(target, firstHold);

  for (let index = 1; index < frames.length; index += 1) {
    const nextIndex = sprite.activeIndex === 0 ? 1 : 0;
    const current = sprite.layers[sprite.activeIndex];
    const next = sprite.layers[nextIndex];
    setStageSize(sprite.stage, frames[index], displayWidth);
    applyCrop(next, sheetUrl, frames[index], displayWidth);
    next.style.opacity = '0';

    await Promise.all([
      animate(current, [
        { opacity: 1, transform: 'scale(1)', filter: 'blur(0px)' },
        { opacity: .18, transform: 'scale(1.015)', filter: 'blur(1.4px)' },
      ], { duration: crossfadeMs, easing: 'ease-in-out', fill: 'forwards' }),
      animate(next, [
        { opacity: 0, transform: 'scale(.985)', filter: 'blur(1.4px)' },
        { opacity: 1, transform: 'scale(1)', filter: 'blur(0px)' },
      ], { duration: crossfadeMs, easing: 'ease-in-out', fill: 'forwards' }),
    ]);

    current.style.opacity = '0';
    next.style.opacity = '1';
    current.style.transform = '';
    next.style.transform = '';
    current.style.filter = '';
    next.style.filter = '';
    sprite.activeIndex = nextIndex;

    const hold = Math.max(0, frameMs - crossfadeMs);
    if (hold) await wait(target, hold);
  }

  if (holdLastMs) await wait(target, holdLastMs);
}

export function captureEventSnapshot(doc, event) {
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

export function findSlot(target, slotIndex) {
  return target._slotEls?.[slotIndex]
    || target.document?.querySelectorAll?.('#spread > .slot')?.[slotIndex]
    || null;
}

export function createEventClone(doc, snapshot) {
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
  const sprite = createSpriteStage(doc, 'adv-node-sprite-stage', NODE_SHEET_URL, visual.frames[0], displayWidth);
  const label = doc.createElement('div');
  label.className = 'adv-node-sprite-label';
  label.textContent = visual.label;
  wrap.append(sprite.stage, label);
  return { wrap, sprite };
}

function createOutcomeSprite(doc, visual, tier, eventRect, displayWidth) {
  const wrap = doc.createElement('div');
  wrap.className = `adv-outcome-sprite-wrap adv-outcome-sprite-wrap--${tier}`;
  wrap.style.left = `${eventRect.left + eventRect.width / 2}px`;
  wrap.style.top = `${eventRect.top + eventRect.height / 2}px`;
  const sprite = createSpriteStage(doc, 'adv-outcome-sprite-stage', OUTCOME_SHEET_URL, visual.frames[0], displayWidth);
  const label = doc.createElement('div');
  label.className = 'adv-outcome-sprite-label';
  label.textContent = visual.label;
  wrap.append(sprite.stage, label);
  return { wrap, sprite };
}

function eventReactionFrames(tier) {
  if (tier === 'failure') {
    return [
      { transform: 'translateX(0)', filter: 'brightness(1)' },
      { transform: 'translateX(-4px)', filter: 'brightness(.8) sepia(.2)' },
      { transform: 'translateX(3px)' },
      { transform: 'translateX(-2px)' },
      { transform: 'translateX(0)', filter: 'brightness(.9)' },
    ];
  }
  if (tier === 'great_success') {
    return [
      { transform: 'translateY(0) scale(1)', filter: 'brightness(1)' },
      { transform: 'translateY(-6px) scale(1.05)', filter: 'brightness(1.28)' },
      { transform: 'translateY(-2px) scale(1.018)', filter: 'brightness(1.12)' },
    ];
  }
  return [
    { transform: 'scale(1)', filter: 'brightness(1)' },
    { transform: 'scale(1.032)', filter: 'brightness(1.14)' },
    { transform: 'scale(1)', filter: 'brightness(1.06)' },
  ];
}

export function installAdventureInteractionFxV6(target = window) {
  if (!target?.document || target.__tlrAdventureInteractionFxV6Installed) return;
  target.__tlrAdventureInteractionFxV6Installed = true;
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
  installAdventureInteractionFxV6(target);
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
  const nodeWidth = reduced ? 72 : (cardRect.width < 90 ? 84 : 100);
  const outcomeWidth = snapshot.rect.width * (reduced ? 1.02 : 1.2);

  const root = doc.createElement('div');
  root.id = ROOT_ID;
  const eventClone = createEventClone(doc, snapshot);
  const nodeSprite = createNodeSprite(doc, nodeVisual, cardRect, nodeWidth);
  const outcomeSprite = createOutcomeSprite(doc, outcomeVisual, tier, snapshot.rect, outcomeWidth);
  root.append(eventClone, nodeSprite.wrap, outcomeSprite.wrap);
  doc.getElementById(ROOT_ID)?.remove();
  doc.body.appendChild(root);
  doc.body.classList.add('adv-sprite-resolving');

  const nodeEnterMs = reduced ? 90 : 260;
  const nodeFrameMs = reduced ? 105 : 340;
  const nodeCrossfadeMs = reduced ? 55 : 165;
  const nodeHoldMs = reduced ? 70 : 250;
  const nodeExitMs = reduced ? 80 : 220;
  const outcomeEnterMs = reduced ? 100 : 260;
  const outcomeFrameMs = reduced ? 115 : 360;
  const outcomeCrossfadeMs = reduced ? 60 : 180;
  const outcomeHoldMs = reduced ? 110 : 500;
  const outcomeExitMs = reduced ? 90 : 230;

  try {
    await Promise.all([
      animate(nodeSprite.wrap, [
        { opacity: 0, transform: 'translate(-50%,-100%) translateY(8px) scale(.82)', filter: 'blur(2px)' },
        { opacity: .88, transform: 'translate(-50%,-100%) translateY(-2px) scale(1.015)', filter: 'blur(.4px)' },
        { opacity: .84, transform: 'translate(-50%,-100%) translateY(0) scale(1)', filter: 'blur(0px)' },
      ], { duration: nodeEnterMs, easing: 'cubic-bezier(.2,.75,.2,1)', fill: 'forwards' }),
      animate(played, [
        { transform: 'translateY(0) scale(1)', filter: 'brightness(1)' },
        { transform: 'translateY(-3px) scale(1.015)', filter: 'brightness(1.1)' },
        { transform: 'translateY(0) scale(1)', filter: 'brightness(1)' },
      ], { duration: nodeEnterMs + 100, easing: 'ease-out' }),
    ]);

    await playFramesCrossfade(target, nodeSprite.sprite, NODE_SHEET_URL, nodeVisual.frames, {
      displayWidth: nodeWidth,
      frameMs: nodeFrameMs,
      crossfadeMs: nodeCrossfadeMs,
      holdLastMs: nodeHoldMs,
    });

    await animate(nodeSprite.wrap, [
      { opacity: .84, transform: 'translate(-50%,-100%) scale(1)', filter: 'blur(0px)' },
      { opacity: 0, transform: 'translate(-50%,-100%) scale(.9)', filter: 'blur(2.6px)' },
    ], { duration: nodeExitMs, easing: 'ease-in', fill: 'forwards' });

    await Promise.all([
      animate(outcomeSprite.wrap, [
        { opacity: 0, transform: 'translate(-50%,-50%) scale(.84)', filter: 'blur(2.8px)' },
        { opacity: .86, transform: 'translate(-50%,-50%) scale(1.01)', filter: 'blur(.5px)' },
        { opacity: .82, transform: 'translate(-50%,-50%) scale(1)', filter: 'blur(0px)' },
      ], { duration: outcomeEnterMs, easing: 'cubic-bezier(.2,.75,.2,1)', fill: 'forwards' }),
      animate(eventClone, eventReactionFrames(tier), {
        duration: outcomeEnterMs + outcomeFrameMs * outcomeVisual.frames.length,
        easing: 'ease-out',
        fill: 'forwards',
      }),
      playFramesCrossfade(target, outcomeSprite.sprite, OUTCOME_SHEET_URL, outcomeVisual.frames, {
        displayWidth: outcomeWidth,
        frameMs: outcomeFrameMs,
        crossfadeMs: outcomeCrossfadeMs,
        holdLastMs: outcomeHoldMs,
      }),
    ]);

    await Promise.all([
      animate(outcomeSprite.wrap, [
        { opacity: .82, transform: 'translate(-50%,-50%) scale(1)', filter: 'blur(0px)' },
        { opacity: 0, transform: 'translate(-50%,-50%) scale(1.025)', filter: 'blur(3px)' },
      ], { duration: outcomeExitMs, easing: 'ease-in', fill: 'forwards' }),
      animate(eventClone, [{ opacity: 1 }, { opacity: 0 }], { duration: outcomeExitMs, fill: 'forwards' }),
    ]);
    return true;
  } finally {
    root.remove();
    doc.body.classList.remove('adv-sprite-resolving');
  }
}

if (typeof window !== 'undefined') installAdventureInteractionFxV6(window);
