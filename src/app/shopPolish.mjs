import { installMarketRebalance } from './marketRebalance.mjs';

function audioCtx(target = window) {
  try {
    return target._tlrACtx || (target._tlrACtx = new (target.AudioContext || target.webkitAudioContext)());
  } catch (_) {
    return null;
  }
}

function sfxVol(target = window) {
  return typeof target._sfxVol === 'number' ? target._sfxVol : 1;
}

function tone(ctx, freq, at, dur, vol, type = 'sine') {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, at);
  gain.gain.setValueAtTime(0, at);
  gain.gain.linearRampToValueAtTime(vol, at + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.001, at + dur);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(at);
  osc.stop(at + dur + 0.03);
  osc.onended = () => { try { osc.disconnect(); gain.disconnect(); } catch (_) {} };
}

function noise(ctx, at, dur, vol, filterType = 'bandpass', freq = 1600) {
  const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * dur), ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i += 1) {
    const t = i / data.length;
    data[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, 1.7) * Math.min(1, t * 12);
  }
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const filter = ctx.createBiquadFilter();
  filter.type = filterType;
  filter.frequency.value = freq;
  filter.Q.value = 0.9;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(vol, at);
  gain.gain.exponentialRampToValueAtTime(0.001, at + dur);
  src.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);
  src.start(at);
  src.stop(at + dur + 0.02);
  src.onended = () => { try { src.disconnect(); filter.disconnect(); gain.disconnect(); } catch (_) {} };
}

export function playShopBuySound(kind = 'pack', target = window) {
  const ctx = audioCtx(target);
  if (!ctx) return;
  if (ctx.state === 'suspended') ctx.resume();
  const vol = sfxVol(target);
  const now = ctx.currentTime;

  try {
    if (kind === 'relic') {
      tone(ctx, 220, now, 0.55, 0.16 * vol, 'sine');
      tone(ctx, 440, now + 0.05, 0.75, 0.12 * vol, 'triangle');
      tone(ctx, 880, now + 0.12, 0.9, 0.08 * vol, 'sine');
      noise(ctx, now, 0.18, 0.07 * vol, 'highpass', 2600);
    } else if (kind === 'upgrade') {
      tone(ctx, 392, now, 0.24, 0.13 * vol, 'triangle');
      tone(ctx, 523.25, now + 0.045, 0.26, 0.12 * vol, 'triangle');
      tone(ctx, 659.25, now + 0.09, 0.32, 0.1 * vol, 'triangle');
    } else {
      noise(ctx, now, 0.13, 0.12 * vol, 'bandpass', 1450);
      tone(ctx, 330, now + 0.04, 0.18, 0.09 * vol, 'square');
      tone(ctx, 660, now + 0.09, 0.2, 0.07 * vol, 'triangle');
    }
  } catch (_) {}
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
