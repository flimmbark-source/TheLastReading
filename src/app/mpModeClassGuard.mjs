// The multiplayer UI deliberately reuses the single-player #spread, #hand,
// .handDock, and action surfaces. The single-player-v2 body class activates a
// large set of mobile layout overrides for those shared nodes, so it must not be
// present while a multiplayer match is active.
export function installMpModeClassGuard(target) {
  const doc = target?.document;
  const body = doc?.body;
  if (!body || target.__tlrMpModeClassGuardInstalled) return;
  target.__tlrMpModeClassGuardInstalled = true;

  let restoreSinglePlayerClass = body.classList.contains('single-player-v2');
  let syncing = false;

  const sync = () => {
    if (syncing) return;
    syncing = true;
    try {
      const multiplayerActive = body.classList.contains('mp-game-active');
      const singlePlayerActive = body.classList.contains('single-player-v2');

      if (multiplayerActive) {
        if (singlePlayerActive) {
          restoreSinglePlayerClass = true;
          body.classList.remove('single-player-v2');
        }
      } else if (restoreSinglePlayerClass && !singlePlayerActive) {
        body.classList.add('single-player-v2');
      }
    } finally {
      syncing = false;
    }
  };

  const Observer = target.MutationObserver;
  if (typeof Observer !== 'function') return;
  const observer = new Observer(sync);
  observer.observe(body, { attributes: true, attributeFilter: ['class'] });
  sync();
}

if (typeof window !== 'undefined') installMpModeClassGuard(window);
