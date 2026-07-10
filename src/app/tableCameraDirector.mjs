// Small, additive camera responses driven by presentation events. The maximum
// movement is deliberately tiny so card geometry and touch targets remain stable.

const STYLE_ID = 'table-camera-presentation-style';
const STYLE_HREF = '/src/styles/presentation/tableCamera.css?v=2';

function ensureStyles(doc) {
  if (doc.getElementById(STYLE_ID)) return;
  const link = doc.createElement('link');
  link.id = STYLE_ID;
  link.rel = 'stylesheet';
  link.href = STYLE_HREF;
  doc.head.appendChild(link);
}

function animate(element, keyframes, options) {
  if (!element?.animate) return;
  try { element.animate(keyframes, options); } catch {}
}

export function installTableCameraDirector(target = window) {
  if (!target?.document || target.__tlrTableCameraDirectorInstalled) return;
  target.__tlrTableCameraDirectorInstalled = true;
  const doc = target.document;
  ensureStyles(doc);

  const reduced = () => target.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
  const cue = event => {
    if (reduced()) return;
    const name = event.detail?.cue;
    const spread = doc.querySelector('.spread-wrap');
    const ambient = doc.getElementById('roomAmbient');
    const score = doc.querySelector('.score-stack');

    if (name === 'pattern') {
      animate(ambient, [
        { scale: '1.006' },
        { scale: '1.015', offset: .45 },
        { scale: '1.006' },
      ], { duration: 560, easing: 'cubic-bezier(.16,.8,.24,1)' });
      animate(spread, [
        { scale: '1' },
        { scale: '1.01', offset: .42 },
        { scale: '1' },
      ], { duration: 520, easing: 'cubic-bezier(.16,.8,.24,1)' });
    }

    if (name === 'threshold-clear') {
      animate(ambient, [
        { scale: '1.004' },
        { scale: '1.022', offset: .28 },
        { scale: '1.012', offset: .62 },
        { scale: '1' },
      ], { duration: 920, easing: 'cubic-bezier(.14,.78,.2,1)' });
      animate(score, [
        { scale: '1' },
        { scale: '1.035', offset: .28 },
        { scale: '.994', offset: .62 },
        { scale: '1' },
      ], { duration: 820, easing: 'cubic-bezier(.14,.78,.2,1)' });
    }

    if (name === 'ability-reveal') {
      animate(ambient, [{ scale: '1' }, { scale: '1.01' }], { duration: 360, easing: 'ease-out', fill: 'forwards' });
    }

    if (name === 'run-end') {
      animate(ambient, [{ scale: '1' }, { scale: '1.028' }], { duration: 900, easing: 'cubic-bezier(.14,.78,.2,1)', fill: 'forwards' });
    }
  };

  target.addEventListener('tlr:presentation-cue', cue);
  target.__tlrTableCameraDirectorDestroy = () => {
    target.removeEventListener('tlr:presentation-cue', cue);
    target.__tlrTableCameraDirectorInstalled = false;
  };
}