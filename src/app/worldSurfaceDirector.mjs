// Detects existing Market, Archives, result, and session-ending DOM and applies
// presentation-only state. The owning feature modules retain all behavior.

const STYLE_ID = 'world-surfaces-presentation-style';
const STYLE_HREF = '/src/styles/presentation/worldSurfaces.css?v=1';
const SURFACE_CLASSES = Object.freeze([
  'presentation-surface-market',
  'presentation-surface-archives',
  'presentation-surface-archive-detail',
  'presentation-surface-score-result',
  'presentation-surface-run-end',
]);

function ensureStyles(doc) {
  if (doc.getElementById(STYLE_ID)) return;
  const link = doc.createElement('link');
  link.id = STYLE_ID;
  link.rel = 'stylesheet';
  link.href = STYLE_HREF;
  doc.head.appendChild(link);
}

function headingText(doc) {
  return doc.querySelector('#summary.show > .result-panel .rhead h3')?.textContent?.trim().toLowerCase() || '';
}

function decorateDialog(container, heading, fallbackLabel) {
  if (!container) return;
  container.setAttribute('role', 'dialog');
  container.setAttribute('aria-modal', 'true');
  if (heading) {
    if (!heading.id) heading.id = `presentationHeading${Math.random().toString(36).slice(2, 8)}`;
    container.setAttribute('aria-labelledby', heading.id);
  } else if (fallbackLabel) {
    container.setAttribute('aria-label', fallbackLabel);
  }
}

export function installWorldSurfaceDirector(target = window) {
  if (!target?.document || target.__tlrWorldSurfaceDirectorInstalled) return;
  target.__tlrWorldSurfaceDirectorInstalled = true;
  const doc = target.document;
  ensureStyles(doc);

  const state = {
    market: false,
    archives: false,
    archiveDetail: false,
    scoreResult: false,
    runEnd: false,
  };
  const cueTimers = new Map();
  let observer = null;
  let raf = 0;

  const fireCue = (name, duration = 700) => {
    const className = `presentation-cue-${name}`;
    const prior = cueTimers.get(className);
    if (prior) target.clearTimeout(prior);
    doc.body.classList.remove(className);
    // Force a fresh animation when a surface is reopened in the same session.
    void doc.body.offsetWidth;
    doc.body.classList.add(className);
    const reduced = target.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
    cueTimers.set(className, target.setTimeout(() => {
      doc.body.classList.remove(className);
      cueTimers.delete(className);
    }, reduced ? Math.min(duration, 120) : duration));
  };

  const setSurface = (key, active, className, cueName, duration) => {
    const next = Boolean(active);
    if (state[key] === next) return;
    state[key] = next;
    doc.body.classList.toggle(className, next);
    if (next && cueName) fireCue(cueName, duration);
  };

  const sync = () => {
    raf = 0;
    const market = Boolean(doc.querySelector('.store-front-shell')) || doc.body.classList.contains('tlr-shop-active');
    const archives = Boolean(doc.querySelector('#invWrap.open'));
    const archiveDetail = Boolean(doc.querySelector('.inv-detail-bg, .res-vault-bg'));
    const title = headingText(doc);
    const runEnd = title === 'the reading ends';
    const scoreResult = !runEnd && (title === 'threshold cleared' || title === 'reading failed');

    setSurface('market', market, 'presentation-surface-market', 'market-open', 720);
    setSurface('archives', archives, 'presentation-surface-archives', 'archives-open', 650);
    setSurface('archiveDetail', archiveDetail, 'presentation-surface-archive-detail', 'archive-detail', 620);
    setSurface('scoreResult', scoreResult, 'presentation-surface-score-result', 'score-result', 760);
    setSurface('runEnd', runEnd, 'presentation-surface-run-end', 'run-end', 1150);

    const store = doc.querySelector('.store-front-shell .store-front');
    if (store) {
      store.setAttribute('role', 'region');
      store.setAttribute('aria-label', 'The Market');
    }

    const detail = doc.querySelector('.inv-detail-bg');
    if (detail) {
      const box = detail.querySelector('.inv-detail-box, .inv-detail-fullart-wrap');
      const heading = detail.querySelector('.inv-detail-title');
      decorateDialog(box, heading, 'Archive item');
    }

    const vault = doc.querySelector('.res-vault-screen');
    if (vault) decorateDialog(vault, vault.querySelector('h3'), 'Archive memories');

    if (runEnd || scoreResult) {
      const panel = doc.querySelector('#summary.show > .result-panel');
      decorateDialog(panel, panel?.querySelector('.rhead h3'), runEnd ? 'The reading ends' : 'Reading result');
    }
  };

  const schedule = () => {
    if (raf) return;
    raf = target.requestAnimationFrame(sync);
  };

  const onClick = event => {
    const element = event.target?.closest?.('.store-card-buy, .store-proceed');
    if (!element || element.disabled) return;
    const card = element.closest('.store-card');
    if (card) {
      card.classList.add('presentation-market-buying');
      target.setTimeout(() => card.classList.remove('presentation-market-buying'), 560);
    }
    fireCue('market-purchase', 520);
    target.haptic?.([0, 8, 24, 10]);
  };

  const onKeyDown = event => {
    if (event.key !== 'Escape') return;
    const detail = doc.querySelector('.inv-detail-bg');
    if (detail) {
      event.preventDefault();
      detail.remove();
      schedule();
      return;
    }
    const vault = doc.querySelector('.res-vault-bg');
    if (vault) {
      event.preventDefault();
      vault.remove();
      schedule();
    }
  };

  doc.addEventListener('click', onClick, true);
  doc.addEventListener('keydown', onKeyDown, true);
  observer = new MutationObserver(schedule);
  observer.observe(doc.documentElement, {
    subtree: true,
    childList: true,
    characterData: true,
    attributes: true,
    attributeFilter: ['class', 'hidden', 'aria-hidden'],
  });
  schedule();

  target.__tlrWorldSurfaceDirectorDestroy = () => {
    observer?.disconnect();
    observer = null;
    doc.removeEventListener('click', onClick, true);
    doc.removeEventListener('keydown', onKeyDown, true);
    if (raf) target.cancelAnimationFrame(raf);
    for (const timer of cueTimers.values()) target.clearTimeout(timer);
    cueTimers.clear();
    doc.body.classList.remove(...SURFACE_CLASSES);
    target.__tlrWorldSurfaceDirectorInstalled = false;
  };
}
