import { ADVENTURE_EVENTS } from '../data/adventure/events.mjs';
import { ACTION_NODES } from '../data/adventure/nodes.mjs';
import { getEventApproaches } from '../data/adventure/eventApproaches.mjs';
import { cardAdventureProfile } from '../data/adventure/cardNodes.mjs';
import { routeNode } from '../systems/adventure/nodeGraph.mjs';

const STYLE_ID = 'adventure-interaction-fx-v3-style';
const ROOT_ID = 'advInteractionFxV3';

export const NODE_VISUALS = Object.freeze({
  [ACTION_NODES.PHYSICAL]: Object.freeze({ icon: '✊', label: 'Physical', motion: 'strike' }),
  [ACTION_NODES.AGGRESSION]: Object.freeze({ icon: '🗡', label: 'Aggression', motion: 'slash' }),
  [ACTION_NODES.PROTECTION]: Object.freeze({ icon: '🛡', label: 'Protection', motion: 'brace' }),
  [ACTION_NODES.ENDURANCE]: Object.freeze({ icon: '◆', label: 'Endurance', motion: 'weight' }),
  [ACTION_NODES.COMPASSION]: Object.freeze({ icon: '♥', label: 'Compassion', motion: 'pulse' }),
  [ACTION_NODES.AUTHORITY]: Object.freeze({ icon: '♛', label: 'Authority', motion: 'stamp' }),
  [ACTION_NODES.MYSTERY]: Object.freeze({ icon: '☾', label: 'Mystery', motion: 'drift' }),
  [ACTION_NODES.DECEPTION]: Object.freeze({ icon: '◐', label: 'Deception', motion: 'feint' }),
  [ACTION_NODES.INVESTIGATION]: Object.freeze({ icon: '⌕', label: 'Investigation', motion: 'scan' }),
  [ACTION_NODES.TRANSFORMATION]: Object.freeze({ icon: '✦', label: 'Transformation', motion: 'spin' }),
  [ACTION_NODES.CREATION]: Object.freeze({ icon: '❧', label: 'Creation', motion: 'grow' }),
  [ACTION_NODES.FORTUNE]: Object.freeze({ icon: '⊛', label: 'Fortune', motion: 'roll' }),
});

function ensureStyle(doc) {
  if (!doc || doc.getElementById(STYLE_ID)) return;
  const style = doc.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    body.mode-adventure.adv-node-resolving #advEventDeck{opacity:0!important}
    #${ROOT_ID}{position:fixed;inset:0;z-index:2147482500;pointer-events:none;overflow:hidden}
    .adv-node-item{position:fixed;width:54px;height:54px;border-radius:50%;display:flex;flex-direction:column;
      align-items:center;justify-content:center;background:radial-gradient(circle at 35% 28%,#f4dfb0,#8f6938 54%,#24150c 76%);
      border:1px solid #f0d397;box-shadow:0 0 0 2px rgba(38,21,10,.85),0 7px 20px rgba(0,0,0,.55),0 0 16px rgba(240,211,151,.35);
      color:#1b1009;text-align:center;will-change:transform,opacity,filter}
    .adv-node-item__icon{font:800 24px/22px Georgia,serif;text-shadow:0 1px 0 rgba(255,255,255,.35)}
    .adv-node-item__label{margin-top:3px;font:900 6px/1 system-ui,sans-serif;letter-spacing:.07em;text-transform:uppercase}
    .adv-event-fx-card{position:fixed!important;margin:0!important;transform:none!important;z-index:2!important;
      box-sizing:border-box!important;will-change:transform,filter,box-shadow,opacity;overflow:visible!important}
    .adv-event-outcome{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;z-index:5;opacity:0}
    .adv-event-outcome__ring,.adv-event-outcome__ring::before,.adv-event-outcome__ring::after{position:absolute;content:'';border-radius:50%}
    .adv-event-outcome__ring{width:64px;height:64px;border:3px solid currentColor;box-shadow:0 0 20px currentColor}
    .adv-event-outcome__glyph{position:relative;z-index:2;font:900 34px/1 Georgia,serif;text-shadow:0 0 15px currentColor}
    .adv-event-outcome--failure{color:#b95d56}
    .adv-event-outcome--failure .adv-event-outcome__ring{border-style:dashed;transform:rotate(18deg)}
    .adv-event-outcome--failure .adv-event-outcome__ring::before{width:4px;height:22px;background:currentColor;left:29px;top:-11px;transform:rotate(35deg)}
    .adv-event-outcome--failure .adv-event-outcome__ring::after{width:4px;height:18px;background:currentColor;right:6px;bottom:-7px;transform:rotate(-42deg)}
    .adv-event-outcome--success{color:#ddb25e}
    .adv-event-outcome--success .adv-event-outcome__ring::before{inset:8px;border:1px solid currentColor}
    .adv-event-outcome--great_success{color:#ffe1a0}
    .adv-event-outcome--great_success .adv-event-outcome__ring{width:70px;height:70px;border-width:3px;box-shadow:0 0 30px currentColor}
    .adv-event-outcome--great_success .adv-event-outcome__ring::before{inset:-10px;border:1px solid currentColor}
    .adv-event-outcome--great_success .adv-event-outcome__ring::after{inset:12px;border:2px solid currentColor}
    @media(max-width:640px){.adv-node-item{width:48px;height:48px}.adv-node-item__icon{font-size:21px}.adv-node-item__label{font-size:5px}}
  `;
  doc.head.appendChild(style);
}

function eventFromTitle(title) {
  return ADVENTURE_EVENTS.find(event => event.title === title) || null;
}

function captureEventSnapshot(doc) {
  const card = doc.querySelector('#advEventDeck .adv-deck__top');
  if (!card) return null;
  const rect = card.getBoundingClientRect();
  const title = card.querySelector('.adv-deck__title')?.textContent?.trim() || '';
  if (!rect.width || !rect.height || !title) return null;
  return {
    rect: { left: rect.left, top: rect.top, width: rect.width, height: rect.height },
    html: card.innerHTML,
    eventId: eventFromTitle(title)?.id || null,
  };
}

function slotState(doc) {
  return [...doc.querySelectorAll('#spread > .slot')].map(slot => ({
    slot,
    uid: slot.querySelector(':scope > .card[data-uid]')?.dataset.uid || null,
  }));
}

function tierFromHtml(html) {
  const match = String(html || '').match(/<div class="rhead"><h3[^>]*>(Great Success|Success|Failure)<\/h3>/i);
  if (!match) return null;
  const label = match[1].toLowerCase();
  return label === 'great success' ? 'great_success' : label;
}

function resolvedNodeFor(card, snapshot) {
  const event = ADVENTURE_EVENTS.find(candidate => candidate.id === snapshot?.eventId);
  const profile = cardAdventureProfile(card);
  if (!event || !profile) return profile?.node || null;
  const accepted = getEventApproaches(event).map(approach => approach.node);
  return routeNode(profile.node, accepted)?.resolvedNode || profile.node;
}

function finished(animation, fallbackMs) {
  if (!animation?.finished) return new Promise(resolve => setTimeout(resolve, fallbackMs));
  return animation.finished.catch(() => undefined);
}

function animate(el, frames, options) {
  if (!el?.animate) return finished(null, Number(options?.duration || 0));
  return finished(el.animate(frames, options), Number(options?.duration || 0));
}

function wait(target, ms) {
  return new Promise(resolve => target.setTimeout(resolve, ms));
}

function itemFrames(motion) {
  const base = 'translate(-50%,-50%)';
  const motions = {
    strike: [
      { transform: `${base} translateX(-8px) scale(1)`, filter: 'brightness(1)' },
      { transform: `${base} translateX(9px) scale(1.15)`, filter: 'brightness(1.35)' },
      { transform: `${base} translateX(0) scale(1)`, filter: 'brightness(1)' },
    ],
    slash: [
      { transform: `${base} rotate(-28deg) scale(.9)` },
      { transform: `${base} rotate(34deg) scale(1.16)` },
      { transform: `${base} rotate(0deg) scale(1)` },
    ],
    brace: [
      { transform: `${base} scale(.88,1.12)` },
      { transform: `${base} scale(1.16,.9)` },
      { transform: `${base} scale(1)` },
    ],
    weight: [
      { transform: `${base} translateY(-8px) scale(1.05)` },
      { transform: `${base} translateY(5px) scale(.94)` },
      { transform: `${base} translateY(0) scale(1)` },
    ],
    pulse: [
      { transform: `${base} scale(.9)`, filter: 'brightness(1)' },
      { transform: `${base} scale(1.2)`, filter: 'brightness(1.35)' },
      { transform: `${base} scale(.96)`, filter: 'brightness(1.08)' },
      { transform: `${base} scale(1.12)`, filter: 'brightness(1.25)' },
      { transform: `${base} scale(1)`, filter: 'brightness(1)' },
    ],
    stamp: [
      { transform: `${base} translateY(-10px) scale(1.05)` },
      { transform: `${base} translateY(5px) scale(1.18)` },
      { transform: `${base} translateY(0) scale(1)` },
    ],
    drift: [
      { transform: `${base} translate(-6px,-4px) rotate(-8deg)`, opacity: .82 },
      { transform: `${base} translate(7px,2px) rotate(9deg)`, opacity: 1 },
      { transform: `${base} translate(0,0) rotate(0deg)`, opacity: .92 },
    ],
    feint: [
      { transform: `${base} translateX(-9px) scale(.94)`, opacity: .75 },
      { transform: `${base} translateX(8px) scale(1.08)`, opacity: 1 },
      { transform: `${base} translateX(-3px) scale(.98)`, opacity: .88 },
      { transform: `${base} translateX(0) scale(1)`, opacity: 1 },
    ],
    scan: [
      { transform: `${base} rotate(-16deg) translateX(-4px)` },
      { transform: `${base} rotate(16deg) translateX(4px)` },
      { transform: `${base} rotate(0deg) translateX(0)` },
    ],
    spin: [
      { transform: `${base} rotate(0deg) scale(.9)` },
      { transform: `${base} rotate(180deg) scale(1.18)` },
      { transform: `${base} rotate(360deg) scale(1)` },
    ],
    grow: [
      { transform: `${base} translateY(8px) scale(.78)` },
      { transform: `${base} translateY(-7px) scale(1.2)` },
      { transform: `${base} translateY(0) scale(1)` },
    ],
    roll: [
      { transform: `${base} rotate(-18deg) translateX(-5px)` },
      { transform: `${base} rotate(210deg) translateX(5px)` },
      { transform: `${base} rotate(360deg) translateX(0)` },
    ],
  };
  return motions[motion] || motions.pulse;
}

function createEventClone(doc, snapshot, tier) {
  const clone = doc.createElement('div');
  clone.className = 'adv-deck__top adv-event-fx-card';
  clone.innerHTML = snapshot.html;
  Object.assign(clone.style, {
    left: `${snapshot.rect.left}px`, top: `${snapshot.rect.top}px`,
    width: `${snapshot.rect.width}px`, height: `${snapshot.rect.height}px`,
  });

  const outcome = doc.createElement('div');
  outcome.className = `adv-event-outcome adv-event-outcome--${tier}`;
  const glyph = tier === 'failure' ? '×' : tier === 'success' ? '◆' : '✦';
  outcome.innerHTML = `<span class="adv-event-outcome__ring"></span><span class="adv-event-outcome__glyph">${glyph}</span>`;
  clone.appendChild(outcome);
  return { clone, outcome };
}

function createNodeItem(doc, node, cardRect) {
  const visual = NODE_VISUALS[node] || { icon: '✦', label: String(node || 'Action'), motion: 'pulse' };
  const item = doc.createElement('div');
  item.className = 'adv-node-item';
  item.innerHTML = `<span class="adv-node-item__icon">${visual.icon}</span><span class="adv-node-item__label">${visual.label}</span>`;
  item.style.left = `${cardRect.left + cardRect.width / 2}px`;
  item.style.top = `${cardRect.top + Math.min(18, cardRect.height * .2)}px`;
  item.style.opacity = '0';
  return { item, motion: visual.motion };
}

async function playSequence({ target, slot, card, snapshot, tier }) {
  const doc = target.document;
  const played = slot?.querySelector(':scope > .card') || slot;
  if (!doc || !played || !card || !snapshot || !tier) return;
  const cardRect = played.getBoundingClientRect();
  if (!cardRect.width || !cardRect.height) return;

  const root = doc.createElement('div');
  root.id = ROOT_ID;
  const node = resolvedNodeFor(card, snapshot);
  const { item, motion } = createNodeItem(doc, node, cardRect);
  const { clone, outcome } = createEventClone(doc, snapshot, tier);
  root.append(clone, item);
  doc.getElementById(ROOT_ID)?.remove();
  doc.body.appendChild(root);
  doc.body.classList.add('adv-node-resolving');

  const reduced = target.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const appearMs = reduced ? 100 : 300;
  const itemActionMs = reduced ? 160 : 620;
  const itemHoldMs = reduced ? 80 : 240;
  const itemFadeMs = reduced ? 80 : 180;
  const eventMs = reduced ? 180 : (tier === 'great_success' ? 900 : 720);
  const eventHoldMs = reduced ? 120 : 520;
  const eventFadeMs = reduced ? 90 : 220;

  try {
    await Promise.all([
      animate(item, [
        { opacity: 0, transform: 'translate(-50%,-50%) translateY(12px) scale(.55)' },
        { opacity: 1, transform: 'translate(-50%,-50%) translateY(-6px) scale(1.08)' },
        { opacity: 1, transform: 'translate(-50%,-50%) translateY(0) scale(1)' },
      ], { duration: appearMs, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'forwards' }),
      animate(played, [
        { transform: 'translateY(0) scale(1)', filter: 'brightness(1)' },
        { transform: 'translateY(-6px) scale(1.025)', filter: 'brightness(1.18)' },
        { transform: 'translateY(0) scale(1)', filter: 'brightness(1)' },
      ], { duration: appearMs + 140, easing: 'ease-out' }),
    ]);

    await animate(item, itemFrames(motion), {
      duration: itemActionMs,
      easing: 'cubic-bezier(.2,.75,.2,1)',
      fill: 'forwards',
    });
    await wait(target, itemHoldMs);
    await animate(item, [
      { opacity: 1, transform: 'translate(-50%,-50%) scale(1)' },
      { opacity: 0, transform: 'translate(-50%,-50%) scale(.72)' },
    ], { duration: itemFadeMs, easing: 'ease-in', fill: 'forwards' });

    let eventFrames;
    if (tier === 'failure') {
      eventFrames = [
        { transform: 'translateX(0)', filter: 'brightness(1)', boxShadow: '0 8px 20px rgba(0,0,0,.6)' },
        { transform: 'translateX(-8px)', filter: 'brightness(.72) sepia(.4)', boxShadow: '0 0 26px rgba(129,43,43,.7)' },
        { transform: 'translateX(7px)' }, { transform: 'translateX(-5px)' },
        { transform: 'translateX(3px)' }, { transform: 'translateX(0)', filter: 'brightness(.86)' },
      ];
    } else if (tier === 'great_success') {
      eventFrames = [
        { transform: 'translateY(0) scale(1)', filter: 'brightness(1)', boxShadow: '0 8px 20px rgba(0,0,0,.6)' },
        { transform: 'translateY(-10px) scale(1.09)', filter: 'brightness(1.42)', boxShadow: '0 0 0 3px rgba(255,226,155,.72),0 0 40px rgba(255,211,112,.85)' },
        { transform: 'translateY(-4px) scale(1.035)', filter: 'brightness(1.18)', boxShadow: '0 0 0 1px rgba(255,226,155,.5),0 0 28px rgba(255,211,112,.58)' },
      ];
    } else {
      eventFrames = [
        { transform: 'scale(1)', filter: 'brightness(1)', boxShadow: '0 8px 20px rgba(0,0,0,.6)' },
        { transform: 'scale(1.065)', filter: 'brightness(1.24)', boxShadow: '0 0 30px rgba(226,183,101,.68)' },
        { transform: 'scale(1)', filter: 'brightness(1.08)', boxShadow: '0 0 18px rgba(226,183,101,.42)' },
      ];
    }

    await Promise.all([
      animate(clone, eventFrames, { duration: eventMs, easing: 'ease-out', fill: 'forwards' }),
      animate(outcome, [
        { opacity: 0, transform: 'scale(.45) rotate(-18deg)' },
        { opacity: 1, transform: 'scale(1.08) rotate(4deg)' },
        { opacity: 1, transform: 'scale(1) rotate(0deg)' },
      ], { duration: Math.min(eventMs, 620), easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'forwards' }),
    ]);

    await wait(target, eventHoldMs);
    await Promise.all([
      animate(clone, [{ opacity: 1 }, { opacity: 0 }], { duration: eventFadeMs, fill: 'forwards' }),
      animate(outcome, [{ opacity: 1 }, { opacity: 0 }], { duration: eventFadeMs, fill: 'forwards' }),
    ]);
  } finally {
    root.remove();
    doc.body.classList.remove('adv-node-resolving');
  }
}

export function installAdventureInteractionFxV3(target = window) {
  if (!target?.document || target.__tlrAdventureInteractionFxV3Installed) return;
  target.__tlrAdventureInteractionFxV3Installed = true;
  const doc = target.document;
  ensureStyle(doc);

  let knownSlots = slotState(doc).map(entry => entry.uid);
  let eventSnapshot = captureEventSnapshot(doc);
  let animating = false;

  const observer = new MutationObserver(() => {
    if (animating) return;
    knownSlots = slotState(doc).map(entry => entry.uid);
    eventSnapshot = captureEventSnapshot(doc) || eventSnapshot;
  });
  observer.observe(doc.body, { childList: true, subtree: true });
  target.addEventListener('resize', () => {
    if (!animating) eventSnapshot = captureEventSnapshot(doc) || eventSnapshot;
  }, { passive: true });

  const attach = () => {
    if (typeof target.showOverlay !== 'function' || target.__tlrAdventureShowOverlayWrapped) return false;
    target.__tlrAdventureShowOverlayWrapped = true;
    const original = target.showOverlay;
    target.showOverlay = function (html, ...args) {
      const tier = tierFromHtml(html);
      if (!target.__tlrAdventureActive || !tier || animating) return original.call(this, html, ...args);

      const slots = slotState(doc);
      const newIndex = slots.findIndex((entry, index) => entry.uid && entry.uid !== knownSlots[index]);
      const card = newIndex >= 0 ? target.state?.spread?.[newIndex] : null;
      const snapshot = eventSnapshot;
      if (newIndex < 0 || !card || !snapshot) return original.call(this, html, ...args);

      animating = true;
      knownSlots = slots.map(entry => entry.uid);
      playSequence({ target, slot: slots[newIndex].slot, card, snapshot, tier })
        .catch(() => undefined)
        .finally(() => {
          animating = false;
          eventSnapshot = captureEventSnapshot(doc) || eventSnapshot;
          knownSlots = slotState(doc).map(entry => entry.uid);
          original.call(target, html, ...args);
        });
      return undefined;
    };
    return true;
  };

  if (!attach()) {
    const timer = target.setInterval(() => {
      if (attach()) target.clearInterval(timer);
    }, 50);
  }
}

if (typeof window !== 'undefined') installAdventureInteractionFxV3(window);
