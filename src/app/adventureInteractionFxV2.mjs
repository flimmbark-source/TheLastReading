import { ADVENTURE_EVENTS } from '../data/adventure/events.mjs';
import { ACTION_NODES } from '../data/adventure/nodes.mjs';
import { getEventApproaches } from '../data/adventure/eventApproaches.mjs';
import { cardAdventureProfile } from '../data/adventure/cardNodes.mjs';
import { routeNode } from '../systems/adventure/nodeGraph.mjs';

const STYLE_ID = 'adventure-interaction-fx-v2-style';
const ROOT_ID = 'advInteractionFxV2';

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
    .adv-outcome-badge{position:fixed;z-index:4;min-width:92px;padding:6px 11px;border-radius:999px;text-align:center;
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
  if (label === 'great success') return 'great_success';
  return label;
}

function visualFor(node) {
  return NODE_VISUALS[node] || { icon: '✦', label: String(node || 'Action') };
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

function createEventClone(doc, snapshot) {
  const clone = doc.createElement('div');
  clone.className = 'adv-deck__top adv-event-fx-card';
  clone.innerHTML = snapshot.html;
  Object.assign(clone.style, {
    left: `${snapshot.rect.left}px`, top: `${snapshot.rect.top}px`,
    width: `${snapshot.rect.width}px`, height: `${snapshot.rect.height}px`,
  });
  return clone;
}

function createNodeItem(doc, node, cardRect) {
  const visual = visualFor(node);
  const item = doc.createElement('div');
  item.className = 'adv-node-item';
  item.innerHTML = `<span class="adv-node-item__icon">${visual.icon}</span><span class="adv-node-item__label">${visual.label}</span>`;
  item.style.left = `${cardRect.left + cardRect.width / 2}px`;
  item.style.top = `${cardRect.top + Math.min(20, cardRect.height * .22)}px`;
  item.style.transform = 'translate(-50%,-50%) scale(.6)';
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
  const played = slot?.querySelector(':scope > .card') || slot;
  if (!doc || !played || !card || !snapshot || !tier) return;
  const cardRect = played.getBoundingClientRect();
  if (!cardRect.width || !cardRect.height) return;

  const root = doc.createElement('div');
  root.id = ROOT_ID;
  const eventClone = createEventClone(doc, snapshot);
  const item = createNodeItem(doc, resolvedNodeFor(card, snapshot), cardRect);
  const badge = createBadge(doc, tier, snapshot.rect);
  root.append(eventClone, item, badge);
  doc.getElementById(ROOT_ID)?.remove();
  doc.body.appendChild(root);
  doc.body.classList.add('adv-node-resolving');

  const reduced = target.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const riseMs = reduced ? 100 : 340;
  const travelMs = reduced ? 130 : 720;
  const settleMs = reduced ? 40 : 160;
  const reactMs = reduced ? 170 : (tier === 'great_success' ? 820 : 680);
  const holdMs = reduced ? 120 : 560;
  const fadeMs = reduced ? 80 : 220;

  const startX = cardRect.left + cardRect.width / 2;
  const startY = cardRect.top + Math.min(20, cardRect.height * .22);
  const endX = snapshot.rect.left + snapshot.rect.width / 2;
  const endY = snapshot.rect.top + snapshot.rect.height / 2;
  const dx = endX - startX;
  const dy = endY - startY;

  try {
    await Promise.all([
      animate(item, [
        { opacity: 0, transform: 'translate(-50%,-50%) translateY(15px) scale(.5)' },
        { opacity: 1, transform: 'translate(-50%,-50%) translateY(-9px) scale(1.08)' },
        { opacity: 1, transform: 'translate(-50%,-50%) translateY(-4px) scale(1)' },
      ], { duration: riseMs, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'forwards' }),
      animate(played, [
        { transform: 'translateY(0) scale(1)', filter: 'brightness(1)' },
        { transform: 'translateY(-7px) scale(1.03)', filter: 'brightness(1.2)' },
        { transform: 'translateY(0) scale(1)', filter: 'brightness(1)' },
      ], { duration: riseMs + 160, easing: 'ease-out' }),
    ]);

    await animate(item, [
      { opacity: 1, transform: 'translate(-50%,-50%) translate(0,-4px) scale(1)' },
      { opacity: 1, transform: `translate(-50%,-50%) translate(${dx * .5}px,${dy * .5}px) scale(.98)` },
      { opacity: 1, transform: `translate(-50%,-50%) translate(${dx}px,${dy}px) scale(.8)` },
    ], { duration: travelMs, easing: 'cubic-bezier(.25,.7,.2,1)', fill: 'forwards' });

    await wait(target, settleMs);

    let eventFrames;
    let itemFrames;
    if (tier === 'failure') {
      eventFrames = [
        { transform: 'translateX(0)', filter: 'brightness(1)', boxShadow: '0 8px 20px rgba(0,0,0,.6)' },
        { transform: 'translateX(-8px)', filter: 'brightness(.7) sepia(.35)', boxShadow: '0 0 24px rgba(129,43,43,.65)' },
        { transform: 'translateX(7px)' }, { transform: 'translateX(-5px)' },
        { transform: 'translateX(3px)' }, { transform: 'translateX(0)', filter: 'brightness(.86)' },
      ];
      itemFrames = [
        { opacity: 1, transform: `translate(-50%,-50%) translate(${dx}px,${dy}px) scale(.8) rotate(0deg)` },
        { opacity: 0, transform: `translate(-50%,-50%) translate(${dx + 10}px,${dy + 28}px) scale(.4) rotate(30deg)` },
      ];
    } else if (tier === 'great_success') {
      eventFrames = [
        { transform: 'translateY(0) scale(1)', filter: 'brightness(1)', boxShadow: '0 8px 20px rgba(0,0,0,.6)' },
        { transform: 'translateY(-11px) scale(1.09)', filter: 'brightness(1.4)', boxShadow: '0 0 0 3px rgba(255,226,155,.7),0 0 38px rgba(255,211,112,.8)' },
        { transform: 'translateY(-4px) scale(1.035)', filter: 'brightness(1.18)', boxShadow: '0 0 0 1px rgba(255,226,155,.5),0 0 26px rgba(255,211,112,.55)' },
      ];
      itemFrames = [
        { opacity: 1, transform: `translate(-50%,-50%) translate(${dx}px,${dy}px) scale(.8)` },
        { opacity: 1, transform: `translate(-50%,-50%) translate(${dx}px,${dy}px) scale(1.35)` },
        { opacity: 0, transform: `translate(-50%,-50%) translate(${dx}px,${dy}px) scale(.2)` },
      ];
    } else {
      eventFrames = [
        { transform: 'scale(1)', filter: 'brightness(1)', boxShadow: '0 8px 20px rgba(0,0,0,.6)' },
        { transform: 'scale(1.065)', filter: 'brightness(1.22)', boxShadow: '0 0 28px rgba(226,183,101,.65)' },
        { transform: 'scale(1)', filter: 'brightness(1.08)', boxShadow: '0 0 18px rgba(226,183,101,.4)' },
      ];
      itemFrames = [
        { opacity: 1, transform: `translate(-50%,-50%) translate(${dx}px,${dy}px) scale(.8)` },
        { opacity: 0, transform: `translate(-50%,-50%) translate(${dx}px,${dy}px) scale(.18)` },
      ];
    }

    await Promise.all([
      animate(eventClone, eventFrames, { duration: reactMs, easing: 'ease-out', fill: 'forwards' }),
      animate(item, itemFrames, { duration: reactMs, easing: 'ease-in', fill: 'forwards' }),
      animate(badge, [
        { opacity: 0, transform: 'translate(-50%,-50%) translateY(10px) scale(.7)' },
        { opacity: 1, transform: 'translate(-50%,-50%) translateY(0) scale(1)' },
      ], { duration: Math.min(reactMs, 480), easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'forwards' }),
    ]);

    await wait(target, holdMs);
    await Promise.all([
      animate(eventClone, [{ opacity: 1 }, { opacity: 0 }], { duration: fadeMs, fill: 'forwards' }),
      animate(badge, [{ opacity: 1 }, { opacity: 0 }], { duration: fadeMs, fill: 'forwards' }),
    ]);
  } finally {
    root.remove();
    doc.body.classList.remove('adv-node-resolving');
  }
}

export function installAdventureInteractionFxV2(target = window) {
  if (!target?.document || target.__tlrAdventureInteractionFxV2Installed) return;
  target.__tlrAdventureInteractionFxV2Installed = true;
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
      playInteraction({ target, slot: slots[newIndex].slot, card, snapshot, tier })
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

if (typeof window !== 'undefined') installAdventureInteractionFxV2(window);
