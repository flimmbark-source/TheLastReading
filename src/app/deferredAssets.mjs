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

// Full-res sheets are only needed by the card-detail modal. Warm them after the
// table sheets so opening a card later is snappy without delaying first paint.
const DETAIL_SHEETS = Object.freeze([
  'assets/sheets/sheet01.png',
  'assets/sheets/sheet02.png',
  'assets/sheets/sheet03.png',
  'assets/sheets/sheet04.png',
  'assets/sheets/sheet05.png',
  'assets/sheets/sheet06.png',
  'assets/sheets/sheet07.png',
  'assets/sheets/sheet08.png',
  'assets/sheets/sheet09.png',
  'assets/sheets/sheet10.png',
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
