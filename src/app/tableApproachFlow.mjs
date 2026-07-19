// Run-start 3D approach (Phase 2 of the react-three-fiber integration).
//
// Wraps the single-player entries (New Reading / Continue) so the player
// walks into the attic room and sits down at the table while the real game
// boots beneath the overlay; when both the cinematic and the boot are done,
// the SAME canvas converts in place into the hybrid seated-table backdrop
// (atticEntry.convertToSeated) — no second WebGL context, no duplicate
// shader compile, which was the sit-down hitch. The wrap is
// presentation-only: the original handler runs unchanged (same return value,
// same errors), and any failure to load or mount the 3D chunk falls back to
// the plain transition.
//
// Installed from main.mjs AFTER installMainMenu so the wrapped functions are
// the full game handlers; menuBoot re-reads window[name] on every click, so
// the wrapper is always the one invoked.

export function installTableApproachFlow(target = window) {
  if (!target || target.__tlrTableApproachInstalled) return;
  target.__tlrTableApproachInstalled = true;

  // Same flag as the 3D attic (see atticFlow.mjs): one switch, one feature.
  // On by default; ?attic3d=0 (or tlrSetAttic3d(false)) is the kill-switch.
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

      // Reduced motion: no cinematic, but the hybrid seated table (a static
      // camera) still applies.
      if (reducedMotion()) {
        const result = await original.apply(this, arguments);
        entry.mountSeatedTable?.();
        return result;
      }

      const overlay = entry.mountTableApproach?.({});
      if (!overlay) return original.apply(this, arguments);

      const boot = (async () => original.apply(this, arguments))();
      // Once both the cinematic and the boot settle, the overlay converts
      // itself into the seated backdrop in place — never over a half-built
      // table, and never with two live canvases.
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

  // With 3D on by default, the chunk is part of the normal start path — warm
  // it while the player is still reading the menu so clicking New Reading
  // doesn't stack the download onto the boot.
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
