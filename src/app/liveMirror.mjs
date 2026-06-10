import { installArchitectureBridge } from './bootstrap.mjs';
import { publicRunSnapshot } from '../game/selectors.mjs';

function normalizeLiveSnapshot(raw = {}) {
  return {
    phase: raw.phase || 'table',
    reading: raw.reading ?? null,
    threshold: raw.threshold ?? null,
    reserve: raw.reserve ?? null,
    totalScore: raw.totalScore ?? null,
    handCount: raw.handCount ?? null,
    deckCount: raw.deckCount ?? null,
    discardCount: raw.discardCount ?? null,
    spreadCount: raw.spreadCount ?? null,
    discards: raw.discards ?? null,
    selectedCardId: raw.selectedCardId ?? null,
  };
}

function diffSnapshots(live, architecture) {
  const keys = [...new Set([...Object.keys(live), ...Object.keys(architecture)])];
  return keys
    .filter(key => live[key] !== architecture[key])
    .map(key => ({ key, live: live[key], architecture: architecture[key] }));
}

export function installLiveMirror(target = globalThis, options = {}) {
  const runtime = target.tlrArchitecture || installArchitectureBridge(target, {
    autosave: false,
    saveKey: 'tlr_architecture_live_bridge_save',
    ...options,
  });

  target.tlrReadArchitectureSnapshot = function tlrReadArchitectureSnapshot() {
    return publicRunSnapshot(runtime.store.getState());
  };

  target.tlrReadLiveSnapshot = target.tlrReadLiveSnapshot || function missingLiveSnapshotReader() {
    return { error: 'No legacy live snapshot reader has been installed yet.' };
  };

  target.tlrMirrorLiveState = function tlrMirrorLiveState() {
    const live = normalizeLiveSnapshot(target.tlrReadLiveSnapshot());
    const architecture = normalizeLiveSnapshot(target.tlrReadArchitectureSnapshot());
    const mismatches = diffSnapshots(live, architecture);
    const report = {
      ok: mismatches.length === 0,
      live,
      architecture,
      mismatches,
    };

    target.tlrLastMirrorReport = report;

    if (target.console) {
      if (report.ok) target.console.info('[TLR architecture] Live state mirror: OK', report);
      else target.console.info('[TLR architecture] Live state mirror mismatches', report);
    }

    return report;
  };

  return runtime;
}

if (typeof window !== 'undefined' && window.__TLR_INSTALL_LIVE_MIRROR__) {
  installLiveMirror(window);
}
