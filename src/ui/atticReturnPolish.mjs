// Coordinates the legacy attic leave flow with the hybrid seated table.
// atticFlow still owns the choreography and game state; this module keeps the
// blackout authoritative until the 3D table reports that its final camera/
// anchor settle pass is complete, and holds a newly dealt hand's sound/motion
// until the reveal veil is actually gone.

const STYLE_ID = 'attic-return-polish-style';
const STYLE_HREF = '/src/styles/components/atticReturnPolish.css?v=1';

function ensureStyles(document) {
  if (document.getElementById(STYLE_ID)) return;
  const link = document.createElement('link');
  link.id = STYLE_ID;
  link.rel = 'stylesheet';
  link.href = STYLE_HREF;
  document.head.appendChild(link);
}

export function installAtticReturnPolish(target = window) {
  if (!target?.document || target.__tlrAtticReturnPolishInstalled) return;
  target.__tlrAtticReturnPolishInstalled = true;

  const document = target.document;
  ensureStyles(document);

  let returning = false;
  let fallbackTimer = 0;
  let releaseDrawHold = null;
  let originalPlaySound = null;
  let gatedPlaySound = null;
  let pendingShuffle = false;

  const gateEffects = () => {
    if (releaseDrawHold || gatedPlaySound) return;
    releaseDrawHold = typeof target.tlrHoldDrawAnimations === 'function'
      ? target.tlrHoldDrawAnimations()
      : null;
    originalPlaySound = target.playSound;
    if (typeof originalPlaySound === 'function') {
      gatedPlaySound = function (soundName, ...args) {
        if (soundName === 'shuffle') {
          pendingShuffle = true;
          return undefined;
        }
        return originalPlaySound.call(this, soundName, ...args);
      };
      target.playSound = gatedPlaySound;
    }
  };

  const releaseEffects = (play = true) => {
    if (gatedPlaySound && target.playSound === gatedPlaySound) target.playSound = originalPlaySound;
    if (play && pendingShuffle) originalPlaySound?.call(target, 'shuffle');
    releaseDrawHold?.({ play });
    releaseDrawHold = null;
    originalPlaySound = null;
    gatedPlaySound = null;
    pendingShuffle = false;
  };

  const afterVeil = (veil, callback) => {
    let done = false;
    let timer = 0;
    let removalObserver = null;
    const finish = () => {
      if (done) return;
      done = true;
      target.clearTimeout(timer);
      removalObserver?.disconnect();
      veil?.removeEventListener?.('transitionend', onEnd);
      callback();
    };
    const onEnd = event => {
      if (event.target === veil && event.propertyName === 'opacity') finish();
    };

    if (!veil?.isConnected) {
      target.requestAnimationFrame(() => target.requestAnimationFrame(finish));
      return;
    }
    veil.addEventListener('transitionend', onEnd);
    removalObserver = new MutationObserver(() => {
      if (!veil.isConnected) finish();
    });
    removalObserver.observe(veil.parentNode || document.body, { childList: true });
    timer = target.setTimeout(finish, 760);
  };

  const finishReturn = ({ play = true } = {}) => {
    if (!returning) return;
    returning = false;
    target.clearTimeout(fallbackTimer);
    document.body.classList.remove('mode-return-hard-hide');

    const veil = document.querySelector('.table3d-reveal-veil');
    target.requestAnimationFrame(() => {
      veil?.classList.add('out');
      afterVeil(veil, () => releaseEffects(play));
    });
  };

  const beginReturn = () => {
    if (returning) return;
    returning = true;
    document.body.classList.add('mode-return-hard-hide');
    target.clearTimeout(fallbackTimer);
    fallbackTimer = target.setTimeout(() => finishReturn({ play: true }), 2800);
  };

  const originalResetSession = target.resetSession;
  if (typeof originalResetSession === 'function' && !originalResetSession.__tlrAtticReturnPolishWrapped) {
    const wrappedResetSession = function (...args) {
      const cls = document.body.classList;
      if (cls.contains('mode-attic') || cls.contains('mode-to-table') || cls.contains('mode-return-hard-hide')) {
        beginReturn();
        gateEffects();
      }
      return originalResetSession.apply(this, args);
    };
    wrappedResetSession.__tlrAtticReturnPolishWrapped = true;
    target.resetSession = wrappedResetSession;
  }

  const bodyObserver = new MutationObserver(() => {
    const cls = document.body.classList;
    if (cls.contains('mode-return-hard-hide')) beginReturn();
    if (returning && !cls.contains('mode-return-hard-hide')) cls.add('mode-return-hard-hide');
  });
  bodyObserver.observe(document.body, { attributes: true, attributeFilter: ['class'] });

  target.addEventListener('tlr:table3d-ready', () => finishReturn({ play: true }));
}
