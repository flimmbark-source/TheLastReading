// Public seam between the legacy attic flow and the react-three-fiber attic.
//
// This module (and everything it imports) lives in its own lazy esbuild chunk:
// src/app/atticFlow.mjs dynamically imports it only when the 3D attic flag is
// on, so React/three never load for players on the classic attic. The exported
// API is deliberately tiny and framework-free: mountAttic3D(adapter) -> handle.
//
// The adapter is assembled by atticFlow and owns all game behavior (rummage,
// pickups, obals, leaving). The 3D layer is presentation only — the same
// boundary the 2D attic honors ("the attic communicates through save state").

import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { AtticExperience } from './AtticExperience.jsx';
import { clearTableAnchors } from './tableAnchors.mjs';
import { ATTIC_OBJECTS } from '../data/atticObjects.mjs';

const CONTAINER_ID = 'attic3dRoot';
const APPROACH_ID = 'table3dApproach';
const SEAT_ID = 'table3dSeat';
const HINT_ID = 'attic3dHint';
const HINT_KEY = 'tlr_attic3d_hint_seen';
const LIVE_CLASS = 'attic3d-live';
const SEAT_CLASS = 'table3d-live';

function webglAvailable() {
  try {
    const canvas = document.createElement('canvas');
    return Boolean(window.WebGLRenderingContext && (canvas.getContext('webgl2') || canvas.getContext('webgl')));
  } catch {
    return false;
  }
}

function controlsHintHtml() {
  const coarse = window.matchMedia?.('(pointer: coarse)')?.matches;
  if (coarse) {
    return '<b>You stand up from the table.</b><span>Tap a spot or a glowing object to walk to it, or drag the left side to walk and the right side to look. Sit back down at the chair when you are done.</span>';
  }
  return '<b>You stand up from the table.</b><span>Click a spot or a glowing object to walk to it, or use WASD and drag the mouse to look. Press E to search what you face. Sit back down at the chair when you are done.</span>';
}

function showControlsHint(scene) {
  try {
    if (localStorage.getItem(HINT_KEY)) return null;
  } catch {
    /* storage unavailable: still show the hint, just once per mount */
  }
  const hint = document.createElement('div');
  hint.id = HINT_ID;
  hint.innerHTML = controlsHintHtml();
  scene.appendChild(hint);
  const dismiss = () => {
    try {
      localStorage.setItem(HINT_KEY, '1');
    } catch {
      /* non-fatal */
    }
    hint.classList.add('fade');
    setTimeout(() => hint.remove(), 650);
  };
  return { el: hint, dismiss };
}

// If the attic is torn down by a path that never calls atticFlow's leave()
// (returning to the main menu, booting Adventure mode — both strip the
// mode-* classes directly), unmount rather than keep a hidden WebGL context
// alive. During a normal leave() the transitional mode-to-table /
// mode-table-return classes are present, so this observer stays quiet and
// atticFlow unmounts us at the end of the fade instead.
function observeHardExit(onExit) {
  const observer = new MutationObserver(() => {
    const cls = document.body.classList;
    const atticish =
      cls.contains('mode-attic') ||
      cls.contains('mode-to-attic') ||
      cls.contains('mode-to-table') ||
      cls.contains('mode-table-return');
    if (!atticish) onExit();
  });
  observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
  return observer;
}

export function mountAttic3D(adapter) {
  const scene = document.getElementById('atticScene');
  if (!scene || document.getElementById(CONTAINER_ID)) return null;
  if (!webglAvailable()) {
    console.warn('The Last Reading: WebGL unavailable, keeping the classic attic.');
    return null;
  }

  const container = document.createElement('div');
  container.id = CONTAINER_ID;
  // The canvas sits above the (hidden) 2D pan layer but below the vignette,
  // fog, pickup card, and tutorial overlays — see src/styles/attic3d.css.
  scene.insertBefore(container, scene.querySelector('#obalsHud'));

  let hint = null;
  let observer = null;
  let unmounted = false;
  const root = createRoot(container);

  const handle = {
    mounted: true,
    api: null, // filled in by the scene once the player rig is live
    unmount() {
      if (unmounted) return;
      unmounted = true;
      handle.mounted = false;
      observer?.disconnect();
      hint?.el?.remove();
      document.body.classList.remove(LIVE_CLASS);
      try {
        root.unmount();
      } catch (error) {
        console.warn('The Last Reading: 3D attic unmount failed.', error);
      }
      container.remove();
      if (window.__tlrAttic3d === handle) delete window.__tlrAttic3d;
    },
  };

  try {
    root.render(
      createElement(AtticExperience, {
        adapter,
        onFirstMove: () => hint?.dismiss(),
        registerApi: api => {
          handle.api = api;
        },
      }),
    );
  } catch (error) {
    console.warn('The Last Reading: 3D attic failed to start, keeping the classic attic.', error);
    handle.unmount();
    return null;
  }

  document.body.classList.add(LIVE_CLASS);
  hint = showControlsHint(scene);
  observer = observeHardExit(() => handle.unmount());
  window.__tlrAttic3d = handle;
  return handle;
}

// ── run-start approach overlay ───────────────────────────────────────────
//
// Mounted by src/app/tableApproachFlow.mjs over the whole viewport while a
// New Reading / Continue boots the table beneath it. Plays the walk-in +
// sit-down cinematic, then (once the caller's boot promise settles too)
// fades itself away to reveal the 2D table UI. Any key or tap skips the
// walk; the overlay also aborts if the player lands back on the main menu.

function approachAdapterStub() {
  const foundItemIds = () => {
    try {
      const raw = JSON.parse(localStorage.getItem('tlr_attic_found_items') || '[]');
      return Array.isArray(raw) ? raw : [];
    } catch {
      return [];
    }
  };
  return {
    objects: ATTIC_OBJECTS,
    note: { itemId: 'note_01' },
    isSearched: () => false,
    foundItemIds,
    obalCount: () => 0,
    rummage() {},
    collectNote() {},
    browseDeck() {},
    leave() {},
  };
}

export function mountTableApproach({ onDone } = {}) {
  if (document.getElementById(APPROACH_ID) || !webglAvailable()) return null;

  const container = document.createElement('div');
  container.id = APPROACH_ID;
  document.body.appendChild(container);
  const root = createRoot(container);

  let disposed = false;
  let sequenceDone = false;
  let gate = null; // optional promise the fade waits on (the boot beneath)
  let fadeTimer = 0;
  let safetyTimer = 0;
  let observer = null;

  const dispose = () => {
    if (disposed) return;
    disposed = true;
    handle.mounted = false;
    clearTimeout(fadeTimer);
    clearTimeout(safetyTimer);
    observer?.disconnect();
    try {
      root.unmount();
    } catch (error) {
      console.warn('The Last Reading: approach overlay unmount failed.', error);
    }
    container.remove();
    if (window.__tlrTable3d === handle) delete window.__tlrTable3d;
    onDone?.();
  };

  const fadeOut = () => {
    if (disposed || container.classList.contains('fade')) return;
    container.classList.add('fade');
    fadeTimer = setTimeout(dispose, 750);
  };

  const maybeFinish = () => {
    if (!sequenceDone) return;
    if (gate) {
      gate.finally(fadeOut);
    } else {
      fadeOut();
    }
  };

  const handle = {
    mounted: true,
    api: null,
    // The flow module hands us the boot promise so the reveal never happens
    // over a half-built table; a settled/failed promise still reveals.
    completeWith(promise) {
      gate = Promise.resolve(promise).catch(() => {});
      maybeFinish();
    },
    abort: dispose,
    skip() {
      handle.api?.skip?.();
    },
  };

  try {
    root.render(
      createElement(AtticExperience, {
        adapter: approachAdapterStub(),
        mode: 'approach',
        onSequenceComplete: () => {
          sequenceDone = true;
          maybeFinish();
        },
        registerApi: api => {
          handle.api = api;
        },
      }),
    );
  } catch (error) {
    console.warn('The Last Reading: approach overlay failed to start.', error);
    dispose();
    return null;
  }

  // If anything yanks the player back to the menu mid-approach, get out of
  // the way immediately rather than playing over the menu.
  observer = new MutationObserver(() => {
    if (document.body.classList.contains('main-menu-active')) dispose();
  });
  observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });

  // Absolute ceiling so a stalled WebGL context can never trap the player
  // behind an opaque overlay.
  safetyTimer = setTimeout(fadeOut, 14000);

  window.__tlrTable3d = handle;
  return handle;
}

// ── hybrid seated-table backdrop ─────────────────────────────────────────
//
// The smallest-useful-prototype of the diegetic table: after sitting down,
// the 3D room STAYS mounted as a fixed, pointer-transparent canvas beneath
// the live SPv2 DOM (body.table3d-live drops the opaque painted background
// and re-seats #spread + the hand onto projected table anchors — see
// src/styles/attic3d.css and src/three/tableAnchors.mjs). All game input
// remains pure DOM; the scene is a stationary seated camera on the exact
// pose the approach/attic sit-down ends on.

export function mountSeatedTable() {
  if (document.getElementById(SEAT_ID) || !webglAvailable()) return null;
  // Only meaningful over a live SPv2 reading.
  if (!document.body.classList.contains('single-player-v2')) return null;

  const container = document.createElement('div');
  container.id = SEAT_ID;
  document.body.appendChild(container);
  const root = createRoot(container);

  let unmounted = false;
  let observer = null;

  const handle = {
    mounted: true,
    api: null,
    unmount() {
      if (unmounted) return;
      unmounted = true;
      handle.mounted = false;
      observer?.disconnect();
      document.body.classList.remove(SEAT_CLASS);
      clearTableAnchors();
      try {
        root.unmount();
      } catch (error) {
        console.warn('The Last Reading: seated table unmount failed.', error);
      }
      container.remove();
      if (window.__tlrTableSeat === handle) delete window.__tlrTableSeat;
    },
  };

  try {
    root.render(
      createElement(AtticExperience, {
        adapter: approachAdapterStub(),
        mode: 'table',
        registerApi: api => {
          handle.api = api;
        },
      }),
    );
  } catch (error) {
    console.warn('The Last Reading: seated table failed to start.', error);
    handle.unmount();
    return null;
  }

  document.body.classList.add(SEAT_CLASS);

  // The backdrop belongs to the seated reading only: leave for the attic,
  // the menu, or another mode and it gets out of the way. (The attic flow
  // remounts it on the way back to the table.)
  observer = new MutationObserver(() => {
    const cls = document.body.classList;
    const elsewhere =
      cls.contains('main-menu-active') ||
      cls.contains('mode-attic') ||
      cls.contains('mode-to-attic') ||
      cls.contains('mode-adventure') ||
      cls.contains('mp-game-active') ||
      !cls.contains('single-player-v2');
    if (elsewhere) handle.unmount();
  });
  observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });

  window.__tlrTableSeat = handle;
  return handle;
}
