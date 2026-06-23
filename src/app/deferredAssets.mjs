// Table-res sheets used by every on-table card (hand/spread/market/MP). These
// are tiny (~180KB each) so they warm first for a sharp, fast first paint.
const TABLE_SHEETS = Object.freeze([
  'sheet01.small.webp',
  'sheet02.small.webp',
  'sheet03.small.webp',
  'sheet04.small.webp',
  'sheet05.small.webp',
  'sheet06.small.webp',
  'sheet07.small.webp',
  'sheet08.small.webp',
  'sheet09.small.webp',
  'sheet10.small.webp',
]);

// Full-res sheets are only needed by the card-detail modal. Warm them after the
// table sheets so opening a card later is snappy without delaying first paint.
const DETAIL_SHEETS = Object.freeze([
  'sheet01.png',
  'sheet02.png',
  'sheet03.png',
  'sheet04.png',
  'sheet05.png',
  'sheet06.png',
  'sheet07.png',
  'sheet08.png',
  'sheet09.png',
  'sheet10.png',
]);

const IDLE_DELAY_MS = 1600;
const SHEET_GAP_MS = 260;

function shouldSkipWarmup(target = window) {
  const conn = target.navigator && target.navigator.connection;
  if (!conn) return false;
  if (conn.saveData) return true;
  return /(^|-)2g$/.test(String(conn.effectiveType || ''));
}

function warmImage(src, target = window) {
  try {
    const img = new (target.Image || Image)();
    img.decoding = 'async';
    img.loading = 'lazy';
    img.src = src;
  } catch (e) {}
}

function warmSheets(target = window) {
  if (target.__tlrCardSheetsWarmStarted) return;
  target.__tlrCardSheetsWarmStarted = true;
  const order = [...TABLE_SHEETS, ...DETAIL_SHEETS];
  order.forEach((src, index) => {
    target.setTimeout(() => warmImage(src, target), index * SHEET_GAP_MS);
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
