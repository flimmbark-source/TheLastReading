import { ADVENTURE_EVENTS } from '../data/adventure/events.mjs';
import { getEventApproaches } from '../data/adventure/eventApproaches.mjs';
import { cardAdventureProfile } from '../data/adventure/cardNodes.mjs';
import { routeNode } from '../systems/adventure/nodeGraph.mjs';
import {
  NODE_VISUALS,
  OUTCOME_VISUALS,
  installAdventureInteractionFxV6,
  playAdventureInteractionFx,
} from './adventureInteractionFxV6.mjs';

export { NODE_VISUALS, OUTCOME_VISUALS, playAdventureInteractionFx };

function tierFromHtml(html) {
  const match = String(html || '').match(/<div class="rhead"><h3[^>]*>(Great Success|Success|Failure)<\/h3>/i);
  if (!match) return null;
  const label = match[1].toLowerCase();
  return label === 'great success' ? 'great_success' : label;
}

function eventFromDeck(doc) {
  const title = doc.querySelector('#advEventDeck .adv-deck__title')?.textContent?.trim() || '';
  return ADVENTURE_EVENTS.find(event => event.title === title) || null;
}

function resolvedNode(card, event) {
  const profile = cardAdventureProfile(card);
  if (!profile || !event) return profile?.node || null;
  const accepted = getEventApproaches(event).map(approach => approach.node);
  return routeNode(profile.node, accepted)?.resolvedNode || profile.node;
}

export function installAdventureInteractionFx(target = window) {
  if (!target?.document || target.__tlrAdventureInteractionBridgeInstalled) return;
  target.__tlrAdventureInteractionBridgeInstalled = true;
  installAdventureInteractionFxV6(target);

  const attach = () => {
    const originalPlacement = target.tlrAdventureOnCardPlaced;
    if (typeof originalPlacement !== 'function' || target.__tlrAdventurePlacementFxWrapped) return false;
    target.__tlrAdventurePlacementFxWrapped = true;

    target.tlrAdventureOnCardPlaced = function (card, slotIndex) {
      if (!target.__tlrAdventureActive || !card) {
        return originalPlacement.call(this, card, slotIndex);
      }

      const doc = target.document;
      const deck = doc.getElementById('advEventDeck');
      const event = eventFromDeck(doc);
      const eventHtmlBefore = deck?.innerHTML || '';
      const originalShowOverlay = target.showOverlay;
      let pendingOverlay = null;

      if (typeof originalShowOverlay === 'function') {
        target.showOverlay = function (html, ...args) {
          pendingOverlay = { html, args };
          return undefined;
        };
      }

      let handled;
      try {
        handled = originalPlacement.call(this, card, slotIndex);
      } finally {
        if (typeof originalShowOverlay === 'function') target.showOverlay = originalShowOverlay;
      }

      if (!handled || !pendingOverlay || !event || typeof originalShowOverlay !== 'function') {
        if (pendingOverlay && typeof originalShowOverlay === 'function') {
          originalShowOverlay.call(target, pendingOverlay.html, ...pendingOverlay.args);
        }
        return handled;
      }

      const tier = tierFromHtml(pendingOverlay.html);
      const node = resolvedNode(card, event);
      if (!tier || !node) {
        originalShowOverlay.call(target, pendingOverlay.html, ...pendingOverlay.args);
        return handled;
      }

      const eventHtmlAfter = deck?.innerHTML || '';
      if (deck && eventHtmlBefore) deck.innerHTML = eventHtmlBefore;
      const animation = playAdventureInteractionFx({
        target,
        slotIndex,
        card,
        event,
        resolution: { tier, resolvedNode: node },
      });
      if (deck) deck.innerHTML = eventHtmlAfter;

      Promise.resolve(animation)
        .catch(() => false)
        .finally(() => {
          originalShowOverlay.call(target, pendingOverlay.html, ...pendingOverlay.args);
        });

      return handled;
    };
    return true;
  };

  if (!attach()) {
    const timer = target.setInterval(() => {
      if (attach()) target.clearInterval(timer);
    }, 50);
  }
}

if (typeof window !== 'undefined') installAdventureInteractionFx(window);
