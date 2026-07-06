// Table-res sheets used by every on-table card (hand/spread/market/MP). These
// are tiny (~180KB each) so they warm first for a sharp, fast first paint.
const TABLE_SHEETS = Object.freeze([
  'assets/sheets/sheet01.small.webp',
  'assets/sheets/sheet02.small.webp',
  'assets/sheets/sheet03.small.webp',
  'assets/sheets/sheet04.small.webp',
  'assets/sheets/sheet05.small.webp',
  'assets/sheets/sheet06.small.webp',
  'assets/sheets/sheet07.small.webp',
  'assets/sheets/sheet08.small.webp',
  'assets/sheets/sheet09.small.webp',
  'assets/sheets/sheet10.small.webp',
]);

// Market chrome fetched fresh each time the store opens. The candle images
// are tiny downscaled webps (the original PNGs were ~1.7MB combined and made
// the candle visibly late on first market entry), but warming them here means
// even the first market open lights instantly.
const MARKET_CHROME = Object.freeze([
  'ui/candle_flame_off.small.webp',
  'ui/candle_flame_on.small.webp',
]);

// Full-res sheets are only needed by the card-detail modal. Warm them after the
// table sheets so opening a card later is snappy without delaying first paint.
const DETAIL_SHEETS = Object.freeze([
  'assets/sheets/sheet01.webp',
  'assets/sheets/sheet02.webp',
  'assets/sheets/sheet03.webp',
  'assets/sheets/sheet04.webp',
  'assets/sheets/sheet05.webp',
  'assets/sheets/sheet06.webp',
  'assets/sheets/sheet07.webp',
  'assets/sheets/sheet08.webp',
  'assets/sheets/sheet09.webp',
  'assets/sheets/sheet10.webp',
]);

// This module itself is only imported after the core game bundle has
// already loaded (see menuBoot.mjs's scheduleDeferredAssets, which waits for
// an idle callback before even fetching this file), so first paint is long
// past by the time any of the code below runs -- no need for the large
// up-front delay that used to duplicate that wait. Table sheets fire with
// only a minimal stagger so every sheet a hand/spread/market could need is
// warm well before the player finishes their *next* reading; detail sheets
// stay slow/low-priority since they're only needed if a card is expanded.
const IDLE_DELAY_MS = 200;
const TABLE_GAP_MS = 40;
const DETAIL_START_DELAY_MS = 500;
const DETAIL_GAP_MS = 260;

function shouldSkipWarmup(target = window) {
  const conn = target.navigator && target.navigator.connection;
  if (!conn) return false;
  if (conn.saveData) return true;
  return /(^|-)2g$/.test(String(conn.effectiveType || ''));
}

// Detached images marked loading='lazy' are never fetched, and detached
// unreferenced images can be garbage-collected mid-request — either way the
// warm-up silently does nothing. Fetch normally and hold a reference until
// the request settles; shouldSkipWarmup already guards data-saver/2g users.
const warmRefs = new Set();
function warmImage(src, target = window) {
  try {
    const img = new (target.Image || Image)();
    img.decoding = 'async';
    warmRefs.add(img);
    img.onload = img.onerror = () => warmRefs.delete(img);
    img.src = src;
  } catch (e) {}
}

function warmSheets(target = window) {
  if (target.__tlrCardSheetsWarmStarted) return;
  target.__tlrCardSheetsWarmStarted = true;
  TABLE_SHEETS.forEach((src, index) => {
    target.setTimeout(() => warmImage(src, target), index * TABLE_GAP_MS);
  });
  MARKET_CHROME.forEach((src, index) => {
    target.setTimeout(() => warmImage(src, target), (TABLE_SHEETS.length + index) * TABLE_GAP_MS);
  });
  const detailStart = TABLE_SHEETS.length * TABLE_GAP_MS + DETAIL_START_DELAY_MS;
  DETAIL_SHEETS.forEach((src, index) => {
    target.setTimeout(() => warmImage(src, target), detailStart + index * DETAIL_GAP_MS);
  });
}

function scheduleWarmup(target = window) {
  if (!target || shouldSkipWarmup(target)) return;
  const start = () => {
    target.setTimeout(() => {
      if (typeof target.requestIdleCallback === 'function') {
        target.requestIdleCallback(() => warmSheets(target), { timeout: 3000 });
      } else {
        warmSheets(target);
      }
    }, IDLE_DELAY_MS);
  };
  if (target.document?.readyState === 'complete') start();
  else target.addEventListener('load', start, { once: true });
}

scheduleWarmup(window);
