// Run-start 3D approach (Phase 2 of the react-three-fiber integration).
//
// Wraps the single-player entries (New Reading / Continue) so the player
// walks into the attic room and sits down at the table while the real game
// boots beneath the overlay; when both the cinematic and the boot are done,
// the SAME canvas converts in place into the hybrid seated-table backdrop
// (atticEntry.convertToSeated) — no second WebGL context, no duplicate
// shader compile, which was the sit-down hitch. The wrapper preserves the
// original game handler and only owns when hidden presentation effects release.

export function installTableApproachFlow(target = window) {
  if (!target || target.__tlrTableApproachInstalled) return;
  target.__tlrTableApproachInstalled = true;

  function enabled() {
    try {
      const q = new URLSearchParams(target.location.search || '');
      if (q.get('attic3d') === '0') return false;
      if (q.get('attic3d') === '1') return true;
      return target.localStorage.getItem('tlr_attic_3d') !== '0';
    } catch {
      return true;
    }
  }

  function reducedMotion() {
    return Boolean(target.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches);
  }

  function createTableRevealGate() {
    const originalPlaySound = target.playSound;
    const releaseDrawHold = typeof target.tlrHoldDrawAnimations === 'function'
      ? target.tlrHoldDrawAnimations()
      : null;

    let pendingShuffle = false;
    let released = false;
    const gatedPlaySound = typeof originalPlaySound === 'function'
      ? function (soundName, ...args) {
          if (soundName === 'shuffle') {
            pendingShuffle = true;
            return undefined;
          }
          return originalPlaySound.call(this, soundName, ...args);
        }
      : null;

    if (gatedPlaySound) target.playSound = gatedPlaySound;

    return {
      release({ play = false } = {}) {
        if (released) return;
        released = true;
        if (gatedPlaySound && target.playSound === gatedPlaySound) target.playSound = originalPlaySound;
        releaseDrawHold?.({ play });
        if (play && pendingShuffle) originalPlaySound?.call(target, 'shuffle');
        pendingShuffle = false;
      },
    };
  }

  function releaseAfterVeilClears(gate, veil) {
    let settled = false;
    let fallback = 0;
    const finish = () => {
      if (settled) return;
      settled = true;
      target.clearTimeout(fallback);
      veil?.removeEventListener?.('transitionend', onTransitionEnd);
      gate.release({ play: true });
    };
    const onTransitionEnd = event => {
      if (event.target === veil && event.propertyName === 'opacity') finish();
    };

    if (!veil || !veil.isConnected) {
      target.requestAnimationFrame(() => target.requestAnimationFrame(finish));
      return;
    }
    veil.addEventListener('transitionend', onTransitionEnd);
    fallback = target.setTimeout(finish, 760);
  }

  function releaseEffectsAtTableReveal(gate) {
    const body = target.document?.body;
    if (!body?.classList.contains('table3d-live')) {
      gate.release();
      return;
    }

    const veil = target.document.querySelector('.table3d-reveal-veil');
    if (!veil) {
      gate.release({ play: true });
      return;
    }
    if (veil.classList.contains('out')) {
      releaseAfterVeilClears(gate, veil);
      return;
    }

    let fallbackTimer = 0;
    const observer = new MutationObserver(() => {
      if (!veil.classList.contains('out')) return;
      observer.disconnect();
      target.clearTimeout(fallbackTimer);
      releaseAfterVeilClears(gate, veil);
    });
    observer.observe(veil, { attributes: true, attributeFilter: ['class'] });
    fallbackTimer = target.setTimeout(() => {
      observer.disconnect();
      releaseAfterVeilClears(gate, veil);
    }, 2600);
  }

  function releaseAtTableReady(gate, mountSeat) {
    let settled = false;
    let fallback = 0;
    const finish = ({ play = true } = {}) => {
      if (settled) return;
      settled = true;
      target.clearTimeout(fallback);
      target.removeEventListener('tlr:table3d-ready', onReady);
      gate.release({ play });
    };
    const onReady = () => finish({ play: true });

    target.addEventListener('tlr:table3d-ready', onReady, { once: true });
    const seat = mountSeat();
    if (!seat) {
      finish({ play: true });
      return seat;
    }
    fallback = target.setTimeout(() => finish({ play: true }), 1900);
    return seat;
  }

  function wrap(name) {
    const original = target[name];
    if (typeof original !== 'function' || original.__tlrApproachWrapped) return;
    const wrapped = async function () {
      if (!enabled()) return original.apply(this, arguments);

      let entry = null;
      try {
        entry = await import('../three/atticEntry.mjs');
      } catch (error) {
        console.warn('The Last Reading: 3D approach chunk failed to load; starting plainly.', error);
        return original.apply(this, arguments);
      }

      if (reducedMotion()) {
        const revealGate = createTableRevealGate();
        try {
          const result = await original.apply(this, arguments);
          releaseAtTableReady(revealGate, () => entry.mountSeatedTable?.());
          return result;
        } catch (error) {
          revealGate.release();
          throw error;
        }
      }

      let revealGate = { release() {} };
      const overlay = entry.mountTableApproach?.({
        onDone: () => releaseEffectsAtTableReveal(revealGate),
      });
      if (!overlay) return original.apply(this, arguments);

      revealGate = createTableRevealGate();
      const boot = (async () => original.apply(this, arguments))();
      overlay.completeWith(boot);
      try {
        return await boot;
      } catch (error) {
        overlay.abort();
        revealGate.release();
        throw error;
      }
    };
    wrapped.__tlrApproachWrapped = true;
    target[name] = wrapped;
  }

  wrap('tlrMainMenuNewGame');
  wrap('tlrMainMenuContinue');

  if (enabled()) {
    const idle = target.requestIdleCallback?.bind(target) || (fn => target.setTimeout(fn, 2500));
    idle(
      () => {
        import('../three/atticEntry.mjs').catch(() => {});
      },
      { timeout: 6000 },
    );
  }
}
