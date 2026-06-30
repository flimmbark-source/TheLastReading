function persistOf(target = window) {
  return target.tlrRuntime?.persist || target.persist || {};
}

function packBuyCount(target, packId) {
  return Number(target._packBuys?.[packId] || 0);
}

function showPurchasedPack(packId, target = window) {
  const api = target.tlrShopOverlayFlow;
  const html = api?.buildUpgradePicker?.(packId, target);
  if (!html || typeof target.showOverlay !== 'function') return false;
  target.showOverlay(html);
  return true;
}

export function installPackOpeningSafety(target = window) {
  if (!target || target.__tlrPackOpeningSafetyInstalled) return;
  target.__tlrPackOpeningSafetyInstalled = true;

  let original = null;
  const existing = Object.getOwnPropertyDescriptor(target, 'buyPack');
  if (typeof existing?.value === 'function') original = existing.value;

  function safeBuyPack(...args) {
    if (typeof original !== 'function') return false;
    const packId = args[0];
    const reserveBefore = Number(persistOf(target).pool || 0);
    const buysBefore = packBuyCount(target, packId);

    try {
      return original.apply(this, args);
    } catch (error) {
      const reserveAfter = Number(persistOf(target).pool || 0);
      const buysAfter = packBuyCount(target, packId);
      const purchaseCompleted = reserveAfter < reserveBefore || buysAfter > buysBefore;
      if (!purchaseCompleted) throw error;

      target.console?.error?.(
        'Pack opening animation failed after purchase; showing the pack contents directly.',
        error,
      );
      showPurchasedPack(packId, target);
      return true;
    }
  }

  Object.defineProperty(target, 'buyPack', {
    configurable: true,
    enumerable: true,
    get() {
      return typeof original === 'function' ? safeBuyPack : undefined;
    },
    set(next) {
      if (next !== safeBuyPack) original = next;
    },
  });
}
