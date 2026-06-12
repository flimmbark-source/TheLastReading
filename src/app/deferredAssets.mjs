const CARD_SHEETS = Object.freeze([
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
  CARD_SHEETS.forEach((src, index) => {
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
