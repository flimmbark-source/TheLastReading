// Compact Adventure interaction feedback.
// A small item representing the resolved Event node rises from the newly played
// card, enters a snapshot of the Event card, and the Event reacts as Failure,
// Success, or Great Success. Hidden requirements and spiderweb paths remain
// undisclosed.

import { ADVENTURE_EVENTS } from '../data/adventure/events.mjs';
import { ACTION_NODES } from '../data/adventure/nodes.mjs';
import { getEventApproaches } from '../data/adventure/eventApproaches.mjs';
import { cardAdventureProfile } from '../data/adventure/cardNodes.mjs';
import { routeNode } from '../systems/adventure/nodeGraph.mjs';

const STYLE_ID = 'adventure-interaction-fx-style';
const ROOT_ID = 'advInteractionFx';

export const NODE_VISUALS = Object.freeze({
  [ACTION_NODES.PHYSICAL]: Object.freeze({ icon: '✊', label: 'Physical' }),
  [ACTION_NODES.AGGRESSION]: Object.freeze({ icon: '🗡', label: 'Aggression' }),
  [ACTION_NODES.PROTECTION]: Object.freeze({ icon: '🛡', label: 'Protection' }),
  [ACTION_NODES.ENDURANCE]: Object.freeze({ icon: '◆', label: 'Endurance' }),
  [ACTION_NODES.COMPASSION]: Object.freeze({ icon: '♥', label: 'Compassion' }),
  [ACTION_NODES.AUTHORITY]: Object.freeze({ icon: '♛', label: 'Authority' }),
  [ACTION_NODES.MYSTERY]: Object.freeze({ icon: '☾', label: 'Mystery' }),
  [ACTION_NODES.DECEPTION]: Object.freeze({ icon: '◐', label: 'Deception' }),
  [ACTION_NODES.INVESTIGATION]: Object.freeze({ icon: '⌕', label: 'Investigation' }),
  [ACTION_NODES.TRANSFORMATION]: Object.freeze({ icon: '✦', label: 'Transformation' }),
  [ACTION_NODES.CREATION]: Object.freeze({ icon: '❧', label: 'Creation' }),
  [ACTION_NODES.FORTUNE]: Object.freeze({ icon: '⊛', label: 'Fortune' }),
});

function ensureStyle(doc) {
  if (!doc || doc.getElementById(STYLE_ID)) return;
  const style = doc.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    body.mode-adventure.adv-node-resolving #summary{
      opacity:0!important;visibility:hidden!important;pointer-events:none!important
    }
    body.mode-adventure.adv-node-resolving #advEventDeck{opacity:0!important}
    #${ROOT_ID}{position:fixed;inset:0;z-index:2147482500;pointer-events:none;overflow:hidden}
    .adv-node-item{position:fixed;width:52px;height:52px;border-radius:50%;display:flex;flex-direction:column;
      align-items:center;justify-content:center;background:radial-gradient(circle at 35% 28%,#f4dfb0,#8f6938 54%,#24150c 76%);
      border:1px solid #f0d397;box-shadow:0 0 0 2px rgba(38,21,10,.85),0 7px 20px rgba(0,0,0,.55),0 0 16px rgba(240,211,151,.35);
      color:#1b1009;text-align:center;will-change:transform,opacity}
    .adv-node-item__icon{font:800 23px/22px Georgia,serif;text-shadow:0 1px 0 rgba(255,255,255,.35)}
    .adv-node-item__label{margin-top:3px;font:900 6px/1 system-ui,sans-serif;letter-spacing:.07em;text-transform:uppercase}
    .adv-event-fx-card{position:fixed!important;margin:0!important;transform:none!important;z-index:2!important;
      box-sizing:border-box!important;will-change:transform,filter,box-shadow,opacity}
    .adv-outcome-badge{position:fixed;z-index:4;min-width:88px;padding:5px 10px;border-radius:999px;text-align:center;
      background:rgba(17,10,7,.94);border:1px solid currentColor;box-shadow:0 4px 14px rgba(0,0,0,.55);
      font:900 9px/1 system-ui,sans-serif;letter-spacing:.12em;text-transform:uppercase;will-change:transform,opacity}
    .adv-outcome-badge--failure{color:#c77a72}.adv-outcome-badge--success{color:#e2b765}.adv-outcome-badge--great-success{color:#ffe3a0}
    @media(max-width:640px){.adv-node-item{width:46px;height:46px}.adv-node-item__icon{font-size:20px}.adv-node-item__label{font-size:5px}}
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
    title,
    eventId: eventFromTitle(title)?.id || null,
  };
}

function slotState(doc) {
  return [...doc.querySelectorAll('#spread > .slot')].map(slot => ({
    slot,
    uid: slot.querySelector(':scope > .card[data-uid]')?.dataset.uid || null,
  }));
}

function tierFromSummary(doc) {
  const text = doc.querySelector('#summary .result-panel .rhead h3')?.textContent?.trim().toLowerCase() || '';
  if (text.includes('great success')) return 'great_success';
  if (text === 'success') return 'success';
  if (text === 'failure') return 'failure';
  return null;
}

function visualFor(node) {
  return NODE_VISUALS[node] || { icon: '✦', label: String(node || 'Action') };
}

function animationFinished(animation, fallbackMs) {
  if (!animation?.finished) return new Promise(resolve => setTimeout(resolve, fallbackMs));
  return animation.finished.catch(() => undefined);
}

function animate(el, keyframes, options) {
  if (!el?.animate) return animationFinished(null, Number(options?.duration || 0));
  return animationFinished(el.animate(keyframes, options), Number(options?.duration || 0));
}

function resolvedNodeFor(card, snapshot) {
  const event = ADVENTURE_EVENTS.find(candidate => candidate.id === snapshot?.eventId);
  const profile = cardAdventureProfile(card);
  if (!event || !profile) return profile?.node || null;
  const accepted = getEventApproaches(event).map(approach => approach.node);
  return routeNode(profile.node, accepted)?.resolvedNode || profile.node;
}

function createEventClone(doc, snapshot) {
  if (!snapshot) return null;
  const clone = doc.createElement('div');
  clone.className = 'adv-deck__top adv-event-fx-card';
  clone.innerHTML = snapshot.html;
  Object.assign(clone.style, {
    left: `${snapshot.rect.left}px`,
    top: `${snapshot.rect.top}px`,
    width: `${snapshot.rect.width}px`,
    height: `${snapshot.rect.height}px`,
  });
  return clone;
}

function createNodeItem(doc, node, startRect) {
  const visual = visualFor(node);
  const item = doc.createElement('div');
  item.className = 'adv-node-item';
  item.innerHTML = `<span class="adv-node-item__icon">${visual.icon}</span><span class="adv-node-item__label">${visual.label}</span>`;
  item.style.left = `${startRect.left + startRect.width / 2}px`;
  item.style.top = `${startRect.top + Math.min(20, startRect.height * .22)}px`;
  item.style.transform = 'translate(-50%,-50%) scale(.65)';
  item.style.opacity = '0';
  return item;
}

function createBadge(doc, tier, eventRect) {
  const badge = doc.createElement('div');
  const label = tier === 'great_success' ? 'Great Success' : tier === 'success' ? 'Success' : 'Failure';
  badge.className = `adv-outcome-badge adv-outcome-badge--${tier.replace('_', '-')}`;
  badge.textContent = label;
  badge.style.left = `${eventRect.left + eventRect.width / 2}px`;
  badge.style.top = `${eventRect.top + eventRect.height - 5}px`;
  badge.style.transform = 'translate(-50%,-50%) scale(.7)';
  badge.style.opacity = '0';
  return badge;
}

async function playInteraction({ target, slot, card, snapshot, tier }) {
  const doc = target.document;
  const eventRect = snapshot?.rect;
  const played = slot?.querySelector(':scope > .card') || slot;
  if (!doc || !eventRect || !played || !card || !tier) return;

  const playedRect = played.getBoundingClientRect();
  if (!playedRect.width || !playedRect.height) return;

  doc.getElementById(ROOT_ID)?.remove();
  const root = doc.createElement('div');
  root.id = ROOT_ID;
  const eventClone = createEventClone(doc, snapshot);
  const node = resolvedNodeFor(card, snapshot);
  const item = createNodeItem(doc, node, playedRect);
  const badge = createBadge(doc, tier, eventRect);
  if (eventClone) root.appendChild(eventClone);
  root.append(item, badge);
  doc.body.appendChild(root);
  doc.body.classList.add('adv-node-resolving');

  const reduced = target.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const riseMs = reduced ? 80 : 180;
  const travelMs = reduced ? 100 : 340;
  const reactMs = reduced ? 120 : 300;
  const holdMs = reduced ? 80 : 180;

  const startX = playedRect.left + playedRect.width / 2;
  const startY = playedRect.top + Math.min(20, playedRect.height * .22);
  const endX = eventRect.left + eventRect.width / 2;
  const endY = eventRect.top + eventRect.height / 2;
  const dx = endX - startX;
  const dy = endY - startY;

  try {
    await Promise.all([
      animate(item, [
        { opacity: 0, transform: 'translate(-50%,-50%) translateY(12px) scale(.55)' },
        { opacity: 1, transform: 'translate(-50%,-50%) translateY(-7px) scale(1.06)' },
        { opacity: 1, transform: 'translate(-50%,-50%) translateY(-4px) scale(1)' },
      ], { duration: riseMs, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'forwards' }),
      animate(played, [
        { transform: 'translateY(0) scale(1)', filter: 'brightness(1)' },
        { transform: 'translateY(-5px) scale(1.025)', filter: 'brightness(1.18)' },
        { transform: 'translateY(0) scale(1)', filter: 'brightness(1)' },
      ], { duration: riseMs + 90, easing: 'ease-out' }),
    ]);

    await animate(item, [
      { opacity: 1, transform: 'translate(-50%,-50%) translate(0, -4px) scale(1)' },
      { opacity: 1, transform: `translate(-50%,-50%) translate(${dx * .55}px, ${dy * .55}px) scale(.95)` },
      { opacity: 1, transform: `translate(-50%,-50%) translate(${dx}px, ${dy}px) scale(.78)` },
    ], { duration: travelMs, easing: 'cubic-bezier(.25,.7,.2,1)', fill: 'forwards' });

    const badgeAnimation = animate(badge, [
      { opacity: 0, transform: 'translate(-50%,-50%) translateY(7px) scale(.7)' },
      { opacity: 1, transform: 'translate(-50%,-50%) translateY(0) scale(1)' },
    ], { duration: reactMs, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'forwards' });

    let eventFrames;
    let itemFrames;
    if (tier === 'failure') {
      eventFrames = [
        { transform: 'translateX(0)', filter: 'brightness(1)', boxShadow: '0 8px 20px rgba(0,0,0,.6)' },
        { transform: 'translateX(-7px)', filter: 'brightness(.75) sepia(.3)', boxShadow: '0 0 22px rgba(129,43,43,.55)' },
        { transform: 'translateX(6px)' },
        { transform: 'translateX(-4px)' },
        { transform: 'translateX(0)', filter: 'brightness(.88)', boxShadow: '0 0 12px rgba(129,43,43,.35)' },
      ];
      itemFrames = [
        { opacity: 1, transform: `translate(-50%,-50%) translate(${dx}px, ${dy}px) scale(.78) rotate(0deg)` },
        { opacity: 0, transform: `translate(-50%,-50%) translate(${dx + 8}px, ${dy + 20}px) scale(.45) rotate(24deg)` },
      ];
    } else if (tier === 'great_success') {
      eventFrames = [
        { transform: 'translateY(0) scale(1)', filter: 'brightness(1)', boxShadow: '0 8px 20px rgba(0,0,0,.6)' },
        { transform: 'translateY(-9px) scale(1.08)', filter: 'brightness(1.35)', boxShadow: '0 0 0 3px rgba(255,226,155,.65),0 0 34px rgba(255,211,112,.75)' },
        { transform: 'translateY(-3px) scale(1.03)', filter: 'brightness(1.15)', boxShadow: '0 0 0 1px rgba(255,226,155,.45),0 0 24px rgba(255,211,112,.5)' },
      ];
      itemFrames = [
        { opacity: 1, transform: `translate(-50%,-50%) translate(${dx}px, ${dy}px) scale(.78)` },
        { opacity: .9, transform: `translate(-50%,-50%) translate(${dx}px, ${dy}px) scale(1.25)` },
        { opacity: 0, transform: `translate(-50%,-50%) translate(${dx}px, ${dy}px) scale(.25)` },
      ];
    } else {
      eventFrames = [
        { transform: 'scale(1)', filter: 'brightness(1)', boxShadow: '0 8px 20px rgba(0,0,0,.6)' },
        { transform: 'scale(1.055)', filter: 'brightness(1.18)', boxShadow: '0 0 24px rgba(226,183,101,.58)' },
        { transform: 'scale(1)', filter: 'brightness(1.07)', boxShadow: '0 0 15px rgba(226,183,101,.34)' },
      ];
      itemFrames = [
        { opacity: 1, transform: `translate(-50%,-50%) translate(${dx}px, ${dy}px) scale(.78)` },
        { opacity: 0, transform: `translate(-50%,-50%) translate(${dx}px, ${dy}px) scale(.2)` },
      ];
    }

    await Promise.all([
      animate(eventClone, eventFrames, { duration: reactMs, easing: 'ease-out', fill: 'forwards' }),
      animate(item, itemFrames, { duration: reactMs, easing: 'ease-in', fill: 'forwards' }),
      badgeAnimation,
    ]);

    await new Promise(resolve => target.setTimeout(resolve, holdMs));
    await Promise.all([
      animate(eventClone, [{ opacity: 1 }, { opacity: 0 }], { duration: 100, fill: 'forwards' }),
      animate(badge, [{ opacity: 1 }, { opacity: 0 }], { duration: 100, fill: 'forwards' }),
    ]);
  } finally {
    root.remove();
    doc.body.classList.remove('adv-node-resolving');
  }
}

export function installAdventureInteractionFx(target = window) {
  if (!target?.document || target.__tlrAdventureInteractionFxInstalled) return;
  target.__tlrAdventureInteractionFxInstalled = true;
  const doc = target.document;
  ensureStyle(doc);

  let knownSlots = slotState(doc).map(entry => entry.uid);
  let eventSnapshot = captureEventSnapshot(doc);
  let animating = false;
  let queued = false;

  const scan = () => {
    queued = false;
    if (!target.__tlrAdventureActive || !doc.body.classList.contains('mode-adventure')) {
      knownSlots = slotState(doc).map(entry => entry.uid);
      eventSnapshot = captureEventSnapshot(doc);
      return;
    }

    const slots = slotState(doc);
    const newIndex = slots.findIndex((entry, index) => entry.uid && entry.uid !== knownSlots[index]);
    const tier = tierFromSummary(doc);

    if (!animating && newIndex >= 0 && tier && eventSnapshot) {
      const card = target.state?.spread?.[newIndex] || null;
      const snapshotForPlay = eventSnapshot;
      knownSlots = slots.map(entry => entry.uid);
      animating = true;
      playInteraction({ target, slot: slots[newIndex].slot, card, snapshot: snapshotForPlay, tier })
        .finally(() => {
          animating = false;
          eventSnapshot = captureEventSnapshot(doc);
          knownSlots = slotState(doc).map(entry => entry.uid);
        });
      return;
    }

    knownSlots = slots.map(entry => entry.uid);
    if (!animating) eventSnapshot = captureEventSnapshot(doc) || eventSnapshot;
  };

  const queueScan = () => {
    if (queued) return;
    queued = true;
    queueMicrotask(scan);
  };

  const observer = new MutationObserver(queueScan);
  observer.observe(doc.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
  target.addEventListener('resize', () => { if (!animating) eventSnapshot = captureEventSnapshot(doc); }, { passive: true });
  queueScan();
}

if (typeof window !== 'undefined') installAdventureInteractionFx(window);
