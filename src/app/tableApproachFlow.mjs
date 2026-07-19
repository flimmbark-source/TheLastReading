// Run-start 3D approach (Phase 2 of the react-three-fiber integration).
//
// Wraps the single-player entries (New Reading / Continue) so that, with the
// 3D flag on, the player walks into the attic room and sits down at the table
// while the real game boots beneath the overlay; the overlay then cross-fades
// into the finished 2D table UI. The wrap is presentation-only: the original
// handler runs unchanged (same return value, same errors), and any failure to
// load or mount the 3D chunk falls back to the plain transition.
//
// Installed from main.mjs AFTER installMainMenu so the wrapped functions are
// the full game handlers; menuBoot re-reads window[name] on every click, so
// the wrapper is always the one invoked.

export function installTableApproachFlow(target = window) {
  if (!target || target.__tlrTableApproachInstalled) return;
  target.__tlrTableApproachInstalled = true;

  // Same flag as the 3D attic (see atticFlow.mjs): one switch, one feature.
  function enabled() {
    try {
      const q = new URLSearchParams(target.location.search || '');
      if (q.get('attic3d') === '1') return true;
      if (q.get('attic3d') === '0') return false;
      return target.localStorage.getItem('tlr_attic_3d') === '1';
    } catch {
      return false;
    }
  }

  function reducedMotion() {
    return Boolean(target.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches);
  }

  function wrap(name) {
    const original = target[name];
    if (typeof original !== 'function' || original.__tlrApproachWrapped) return;
    const wrapped = async function () {
      if (!enabled() || reducedMotion()) return original.apply(this, arguments);

      let entry = null;
      try {
        entry = await import('../three/atticEntry.mjs');
      } catch (error) {
        console.warn('The Last Reading: 3D approach chunk failed to load; starting plainly.', error);
        return original.apply(this, arguments);
      }
      const overlay = entry.mountTableApproach?.({});
      if (!overlay) return original.apply(this, arguments);

      const boot = (async () => original.apply(this, arguments))();
      // The overlay fades only after both the cinematic and the boot are done,
      // so the reveal never lands on a half-built table.
      overlay.completeWith(boot);
      try {
        return await boot;
      } catch (error) {
        overlay.abort();
        throw error;
      }
    };
    wrapped.__tlrApproachWrapped = true;
    target[name] = wrapped;
  }

  wrap('tlrMainMenuNewGame');
  wrap('tlrMainMenuContinue');
}
