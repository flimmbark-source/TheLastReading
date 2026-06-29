import { ACTIONS } from '../game/actions.mjs';

export const ACTIVE_MARKET_PACK_IDS = Object.freeze([
  'foundation',
  'innate',
  'restless',
  'second_sight',
]);

export const VESSEL_OFFER_CHANCE = 0.30;

const PACK_CALLOUT_COPY = Object.freeze({
  foundation: [
    'Omen — all cards +1 Chip',
    'Resonance — Majors +3 Chips',
    'Offering — +5 Reserve per reading',
  ],
  innate: [
    'Wider Hand — +1 hand size',
    'Blessed Start — +0.25 Mult on entry',
    'First Light — first placed card +3 Chips',
    'Deep Reserve — held cards +2 Chips',
  ],
  restless: [
    'Extra Discard — +1 discard/reading',
    'Mulligan — +1 mulligan charge',
    'Nimble Fingers — draw after each discard',
    'Quick Release — discards add +3 Chips',
    'Ritual Depth — ability draws +1 extra',
  ],
  second_sight: [
    'Lens Mastery — Peek, Kin, Neighbor, and Mirror reveal +1 extra',
    'Sight Discount — sight abilities free once/reading',
    'Chosen — ability-taken cards +5 Chips',
  ],
});

function runtime(target = window) {
  return target.tlrRuntime || {};
}

function persistOf(target = window) {
  return runtime(target).persist || target.persist || {};
}

function wrapMethod(target, name, wrapper) {
  const original = target[name];
  if (typeof original !== 'function' || original.__tlrMarketRebalanceWrapped) return false;
  function wrapped(...args) {
    return wrapper.call(this, original, ...args);
  }
  wrapped.__tlrMarketRebalanceWrapped = true;
  target[name] = wrapped;
  return true;
}

function activePackChoice(target = window) {
  const available = ACTIVE_MARKET_PACK_IDS.filter(id => (target.PACKS || {})[id]);
  if (!available.length) return null;
  return available[Math.floor(Math.random() * available.length)];
}

function sanitizePackOffer(target = window) {
  const offers = target._storeFrontOffers;
  if (!offers || !Array.isArray(offers.pack)) return false;
  const current = offers.pack[0];
  if (!current) return false; // null/undefined = purchased slot, leave it empty
  if (ACTIVE_MARKET_PACK_IDS.includes(current)) return false;
  const replacement = activePackChoice(target);
  offers.pack = replacement ? [replacement] : [];
  return true;
}

function currentRelicSlots(target = window) {
  if (typeof target.relicSlots === 'function') return target.relicSlots();
  const level = (persistOf(target).up || {}).relicSlot || 0;
  return 3 + Math.min(level, 2);
}

function ensureVesselRoll(target = window) {
  const offers = target._storeFrontOffers;
  if (!offers || offers.__vesselRolled) return offers;
  offers.__vesselRolled = true;
  offers.__vesselOffered = !target._storeVesselBought
    && currentRelicSlots(target) < 5
    && Math.random() < VESSEL_OFFER_CHANCE;
  offers.__vesselPurchased = false;
  return offers;
}

function vesselCost(target = window) {
  if (typeof target.shopCost === 'function') return target.shopCost('relicSlot');
  const level = (persistOf(target).up || {}).relicSlot || 0;
  return Math.floor(35 * Math.pow(2, level));
}

function renderPurchasedRelicSlot(card) {
  card.className = 'store-card disabled';
  card.style.pointerEvents = 'none';
  card.innerHTML = '<div class="store-card-tag" style="opacity:.4">Purchased</div><div style="flex:1;display:flex;align-items:center;justify-content:center;color:rgba(200,160,80,.35);font-size:22px">✦</div>';
}

function renderVesselOffer(target = window) {
  const offers = ensureVesselRoll(target);
  if (!offers) return;
  const card = target.document?.querySelector('.store-offer-row .store-card:nth-child(3)');
  if (!card) return;

  if (offers.__vesselPurchased) {
    renderPurchasedRelicSlot(card);
    return;
  }
  if (!offers.__vesselOffered) return;

  const persist = persistOf(target);
  const level = (persist.up || {}).relicSlot || 0;
  const maxed = currentRelicSlots(target) >= 5;
  const cost = vesselCost(target);
  const canAfford = !maxed && (persist.pool || 0) >= cost;
  card.className = `store-card ${canAfford ? '' : 'disabled'}`;
  card.style.pointerEvents = '';
  card.innerHTML = `
    <div class="store-card-tag">Relic Slot</div>
    <div class="store-card-art"><div class="store-vessel-glyph">＋</div></div>
    <div class="store-card-name">Relic Vessel</div>
    <div class="store-card-desc">${maxed ? 'Relic Slots maxed.' : 'Gain +1 Relic Slot'}</div>
    <div class="store-card-lv">${maxed ? 'Max 5' : `Slots ${3 + level} → ${4 + level}`}</div>
    <button class="store-card-buy" ${canAfford ? '' : 'disabled'} onclick="buyStoreVessel()">${maxed ? 'Maxed' : `Buy <span class="coin">✦</span> ${cost}`}</button>`;
}

function installPackCalloutCopy(target = window) {
  wrapMethod(target, 'showStorePackCallout', function (original, packId, ...args) {
    const result = original.call(this, packId, ...args);
    const copy = PACK_CALLOUT_COPY[packId];
    if (!copy) return result;
    const list = target.document?.querySelector('.store-pack-callout .store-pack-callout-list');
    if (list) list.innerHTML = copy.map(line => `<li>${line}</li>`).join('');
    return result;
  });
}

function installStoreOfferRules(target = window) {
  wrapMethod(target, 'openShopMain', function (original, ...args) {
    let result = original.apply(this, args);
    if (sanitizePackOffer(target)) result = original.apply(this, args);
    renderVesselOffer(target);
    return result;
  });

  wrapMethod(target, 'confirmStoreVessel', function (original, ...args) {
    const offers = target._storeFrontOffers;
    const vesselOffer = !!offers?.__vesselOffered;
    if (vesselOffer) {
      offers.__vesselPurchased = true;
      target._storeVesselBought = true;
    }
    const result = original.apply(this, args);
    if (result === false && vesselOffer) {
      offers.__vesselPurchased = false;
      target._storeVesselBought = false;
    }
    return result;
  });

  wrapMethod(target, 'continueReading', function (original, ...args) {
    target._storeVesselBought = false;
    return original.apply(this, args);
  });
}

function installWatcherReset(target = window) {
  wrapMethod(target, 'startReading', function (original, ...args) {
    const persist = persistOf(target);
    if (persist.relicUsed) persist.relicUsed.watcher = false;
    return original.apply(this, args);
  });
}

function installDiscardAndCarryTracking(target = window) {
  const store = target.tlrStore;
  if (!store || typeof store.dispatch !== 'function' || store.dispatch.__tlrMarketRebalanceWrapped) return;
  const originalDispatch = store.dispatch.bind(store);

  function dispatch(action) {
    const before = store.getState?.();
    const beforeRun = before?.run || {};
    const selectedId = action?.type === ACTIONS.DISCARD_SELECTED ? beforeRun.selectedCardId : null;
    const selectedCard = selectedId == null
      ? null
      : (beforeRun.hand || []).find(card => card.uid === selectedId) || null;

    const result = originalDispatch(action);

    if (action?.type === ACTIONS.DISCARD_SELECTED && selectedCard) {
      const afterRun = store.getState?.()?.run || {};
      const wasDiscarded = (afterRun.discard || []).some(card => card.uid === selectedCard.uid);
      const tracked = afterRun.discardedCards || [];
      const alreadyTracked = tracked.some(card => card.uid === selectedCard.uid);
      if (wasDiscarded && !alreadyTracked) {
        originalDispatch({
          type: ACTIONS.SYNC_LEGACY_RUN,
          run: { discardedCards: [...tracked, selectedCard] },
        });
      }
    }

    if (action?.type === ACTIONS.START_NEXT_SET) {
      // Discard relics and upgrades score the current set, not an accumulated
      // total from both sets. World carry is likewise consumed by the first set.
      originalDispatch({
        type: ACTIONS.SYNC_LEGACY_RUN,
        run: { discardedCards: [], worldCarry: 0 },
      });
    }

    return result;
  }

  dispatch.__tlrMarketRebalanceWrapped = true;
  store.dispatch = dispatch;
}

export function installMarketRebalance(target = window) {
  if (!target || target.__tlrMarketRebalanceInstalled) return;
  target.__tlrMarketRebalanceInstalled = true;
  installDiscardAndCarryTracking(target);
  installWatcherReset(target);
  installStoreOfferRules(target);
  installPackCalloutCopy(target);
}
