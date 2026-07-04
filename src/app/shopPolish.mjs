import { installMarketRebalance } from './marketRebalance.mjs';

export function playShopBuySound(kind = 'pack', target = window) {
  // Shop purchase and pack-choice sounds are now routed through playSound() at
  // the purchase/open/selection source so each player action gets exactly one
  // authored audio file. Keep this compatibility hook for older wrappers.
  void kind;
  void target;
}


function setShopActive(target = window, active = true) {
  target.document?.body?.classList?.toggle('tlr-shop-active', !!active);
  if (active) {
    target.document?.getElementById('constellationCallout')?.remove();
    const pill = target.document?.getElementById('constellationPill');
    pill?.classList?.add('hidden');
  }
}

function installShopHideStyle(target = window) {
  const doc = target.document;
  if (!doc || doc.getElementById('shop-polish-style')) return;
  const style = doc.createElement('style');
  style.id = 'shop-polish-style';
  style.textContent = `
    body.tlr-shop-active #constellationPill,
    body.tlr-shop-active #constellationCallout{display:none!important;pointer-events:none!important}
  `;
  doc.head.appendChild(style);
}

function wrapMethod(target, name, wrapper) {
  const original = target[name];
  if (typeof original !== 'function' || original.__tlrShopPolishWrapped) return false;
  function wrapped(...args) {
    return wrapper.call(this, original, ...args);
  }
  wrapped.__tlrShopPolishWrapped = true;
  target[name] = wrapped;
  return true;
}

export function installShopPolish(target = window) {
  if (!target || target.__tlrShopPolishInstalled) return;
  target.__tlrShopPolishInstalled = true;
  installShopHideStyle(target);
  target.playShopBuySound = kind => playShopBuySound(kind, target);

  wrapMethod(target, 'openShop', function (original, ...args) {
    setShopActive(target, true);
    return original.apply(this, args);
  });

  wrapMethod(target, 'openShopMain', function (original, ...args) {
    setShopActive(target, true);
    return original.apply(this, args);
  });

  wrapMethod(target, 'showOverlay', function (original, html, ...rest) {
    const text = String(html || '');
    if (text.includes('store-front-shell') || text.includes('tarot-shop')) setShopActive(target, true);
    return original.call(this, html, ...rest);
  });

  wrapMethod(target, 'continueReading', function (original, ...args) {
    setShopActive(target, false);
    return original.apply(this, args);
  });

  wrapMethod(target, 'buyStorePack', function (original, ...args) {
    const result = original.apply(this, args);
    if (result !== false) playShopBuySound('pack', target);
    return result;
  });

  wrapMethod(target, 'buyStoreScoringUpgrade', function (original, ...args) {
    const result = original.apply(this, args);
    if (result !== false) playShopBuySound('upgrade', target);
    return result;
  });

  wrapMethod(target, 'buyStoreRelic', function (original, ...args) {
    const result = original.apply(this, args);
    if (result !== false) playShopBuySound('relic', target);
    return result;
  });

  wrapMethod(target, 'confirmStoreRelicReplace', function (original, ...args) {
    const result = original.apply(this, args);
    if (result !== false) playShopBuySound('relic', target);
    return result;
  });

  wrapMethod(target, 'confirmStoreVessel', function (original, ...args) {
    const result = original.apply(this, args);
    if (result !== false) playShopBuySound('upgrade', target);
    return result;
  });

  wrapMethod(target, 'pickPackUpgrade', function (original, ...args) {
    const result = original.apply(this, args);
    if (result !== false) playShopBuySound('upgrade', target);
    return result;
  });

  wrapMethod(target, 'acquireRelic', function (original, ...args) {
    const result = original.apply(this, args);
    if (result !== false) playShopBuySound('relic', target);
    return result;
  });

  installMarketRebalance(target);
}
