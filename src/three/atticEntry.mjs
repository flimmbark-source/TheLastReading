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
const PENDING_CLASS = 'attic3d-pending';
const SEAT_CLASS = 'table3d-live';
const RETURN_CLASS = 'table3d-continuous-return';
const TRANSITION_STYLE_ID = 'table3d-continuous-transition-style';
const STAND_TRANSFER_CEILING_MS = 4500;
const RETURN_SETTLE_CEILING_MS = 1800;

function clearPromotionSceneStyles(scene) {
  if (!scene) return;
  scene.style.removeProperty('opacity');
  scene.style.removeProperty('pointer-events');
  scene.style.removeProperty('transition');
}

function ensureContinuousTransitionStyles() {
  if (document.getElementById(TRANSITION_STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = TRANSITION_STYLE_ID;
  style.textContent = `
    /* The action rail is old screen-space UI. Hide the complete surface —
       both medallions, the discard badge, and its ::before pips — before the
       first rising frame while the cards themselves continue their table fade. */
    body.table3d-live.attic3d-pending .spread-actions,
    body.table3d-live.attic3d-pending #spv2DiscardBadge {
      opacity: 0 !important;
      visibility: hidden !important;
      pointer-events: none !important;
      transition: none !important;
    }
    body.table3d-live.attic3d-pending .score-stack {
      opacity: 0 !important;
      visibility: hidden !important;
      pointer-events: none !important;
    }

    /* A normal chair sit keeps the live room visible. atticFlow still creates
       its defensive veil and mode-to-table shell for the fallback path, but
       they become transparent while this same root is being converted. */
    body.${RETURN_CLASS} .table3d-reveal-veil {
      opacity: 0 !important;
      background: transparent !important;
      transition: none !important;
    }
    body.${RETURN_CLASS}.mode-to-table #atticScene,
    body.${RETURN_CLASS}.mode-table-return #atticScene,
    body.${RETURN_CLASS}.mode-return-hard-hide #atticScene {
      opacity: 1 !important;
      filter: none !important;
      transform: none !important;
    }

    /* Do not trade the blackout for a flash of the old viewport layout. The
       seated room remains visible by itself while the same root converts and
       TableAnchorProjector settles. Only then is this class removed. */
    body.${RETURN_CLASS} .spread-wrap,
    body.${RETURN_CLASS} .handDock,
    body.${RETURN_CLASS} #relicRack,
    body.${RETURN_CLASS} .refs-layer,
    body.${RETURN_CLASS} #titleWrap,
    body.${RETURN_CLASS} .score-stack,
    body.${RETURN_CLASS} .spread-actions {
      opacity: 0 !important;
      visibility: hidden !important;
      pointer-events: none !important;
      transition: none !important;
    }
  `;
  document.head.appendChild(style);
}

// Seated-backdrop plumbing shared by mountSeatedTable (attic-return path)
// and the approach overlay's in-place conversion: one unmount contract and
// one "leave when the reading leaves" observer.
function createSeatedHandle(container, root) {
  ensureContinuousTransitionStyles();

  let unmounted = false;
  let promoted = false;
  let observer = null;
  let returnObserver = null;
  let hint = null;
  let transferTimer = 0;
  let returnSafetyTimer = 0;
  let promotionScene = null;
  let activeAdapter = null;
  let returnFinished = false;

  const renderAtticMode = (adapter, mode, extra = {}) => {
    activeAdapter = adapter;
    root.render(
      createElement(AtticExperience, {
        adapter,
        mode,
        onFirstMove: () => hint?.dismiss(),
        registerApi: api => {
          handle.api = api;
        },
        ...extra,
      }),
    );
  };

  const clearReturnPresentation = () => {
    clearTimeout(returnSafetyTimer);
    returnFinished = true;
    document.body.classList.remove(RETURN_CLASS);
  };

  const inspectReturnState = () => {
    if (unmounted || !promoted) return;
    const classes = document.body.classList;
    const phase = handle.api?.getState?.().phase;

    if (phase === 'sitting') classes.add(RETURN_CLASS);
    if (
      classes.contains('mode-return-hard-hide') &&
      (phase === 'sitting' || phase === 'done')
    ) {
      classes.add(RETURN_CLASS);
    }
  };

  const armReturnWatch = () => {
    returnObserver?.disconnect();
    returnObserver = new MutationObserver(inspectReturnState);
    returnObserver.observe(document.body, { attributes: true, attributeFilter: ['class'] });

    const tick = () => {
      if (unmounted || !promoted) return;
      inspectReturnState();
      transferTimer = setTimeout(tick, 50);
    };
    transferTimer = setTimeout(tick, 0);
  };

  const destroy = () => {
    if (unmounted) return;
    unmounted = true;
    handle.mounted = false;
    clearTimeout(transferTimer);
    clearTimeout(returnSafetyTimer);
    observer?.disconnect();
    returnObserver?.disconnect();
    hint?.el?.remove();
    clearPromotionSceneStyles(promotionScene);
    clearReturnPresentation();
    document.body.classList.remove(SEAT_CLASS, LIVE_CLASS, PENDING_CLASS);
    clearTableAnchors();
    try {
      root.unmount();
    } catch (error) {
      console.warn('The Last Reading: 3D room unmount failed.', error);
    }
    container.remove();
    if (window.__tlrTableSeat === handle) delete window.__tlrTableSeat;
    if (window.__tlrAttic3d === handle) delete window.__tlrAttic3d;
  };

  const convertPromotedRoomToSeat = () => {
    if (unmounted || !promoted || !activeAdapter) return false;
    if (!document.body.classList.contains('single-player-v2')) return false;

    promoted = false;
    returnFinished = false;
    clearTimeout(transferTimer);
    observer?.disconnect();
    returnObserver?.disconnect();
    hint?.el?.remove();
    hint = null;

    container.id = SEAT_ID;
    container.classList.remove('fade');
    document.body.appendChild(container);

    const finishReturn = () => {
      if (unmounted || returnFinished) return;
      clearReturnPresentation();
    };

    try {
      renderAtticMode(activeAdapter, 'table', { onTableReady: finishReturn });
    } catch (error) {
      console.warn('The Last Reading: continuous attic return failed; using the fallback table mount.', error);
      container.id = CONTAINER_ID;
      promotionScene?.insertBefore(container, promotionScene.querySelector('#obalsHud'));
      return false;
    }

    document.body.classList.add(SEAT_CLASS);
    document.body.classList.remove(LIVE_CLASS, PENDING_CLASS);
    clearPromotionSceneStyles(promotionScene);

    if (window.__tlrAttic3d === handle) delete window.__tlrAttic3d;
    window.__tlrTableSeat = handle;
    handle.observe();

    // TableAnchorProjector reports when the DOM cards have settled onto their
    // world anchors. This ceiling prevents a failed ready event from leaving
    // the table hidden forever.
    returnSafetyTimer = setTimeout(finishReturn, RETURN_SETTLE_CEILING_MS);
    return true;
  };

  const handle = {
    mounted: true,
    api: null,
    unmount() {
      const classes = document.body.classList;
      const continuousReturn =
        promoted &&
        classes.contains(RETURN_CLASS) &&
        (classes.contains('mode-return-hard-hide') ||
          classes.contains('mode-to-table') ||
          classes.contains('mode-table-return'));

      if (continuousReturn && convertPromotedRoomToSeat()) return;
      destroy();
    },
    // Turn the live seated reading backdrop into the walkable attic without
    // destroying its Canvas/WebGL context. The room remains visible beneath
    // the fading DOM table while the PlayerRig stands up; once the rig reaches
    // free movement, the same container is moved into #atticScene and becomes
    // the interactive attic canvas.
    promoteToAttic(adapter) {
      if (unmounted || promoted || !adapter) return null;
      const scene = document.getElementById('atticScene');
      if (!scene) return null;

      promoted = true;
      returnFinished = false;
      promotionScene = scene;
      observer?.disconnect();
      observer = null;

      // Keep the classic attic shell from painting over the still-live seated
      // canvas. The pending class is applied before the first rising render;
      // it also suppresses the obsolete Discard/Purge rail and its pips.
      document.body.classList.add(PENDING_CLASS);
      scene.style.setProperty('opacity', '0', 'important');
      scene.style.setProperty('pointer-events', 'none', 'important');
      scene.style.setProperty('transition', 'none', 'important');

      try {
        renderAtticMode(adapter, 'rising');
      } catch (error) {
        console.warn('The Last Reading: table-to-attic promotion failed; remounting the attic.', error);
        promoted = false;
        document.body.classList.remove(PENDING_CLASS);
        clearPromotionSceneStyles(scene);
        handle.observe();
        return null;
      }

      if (window.__tlrTableSeat === handle) delete window.__tlrTableSeat;
      window.__tlrAttic3d = handle;
      observer = observeHardExit(() => handle.unmount());

      let finished = false;
      const startedAt = performance.now();
      const finishPromotion = () => {
        if (unmounted || finished) return;
        finished = true;
        clearTimeout(transferTimer);

        // Make the destination shell visible and move the existing canvas into
        // it in the same task, so there is no frame where either room is absent.
        scene.style.setProperty('opacity', '1', 'important');
        scene.style.setProperty('pointer-events', 'auto', 'important');
        scene.style.setProperty('transition', 'none', 'important');
        container.id = CONTAINER_ID;
        scene.insertBefore(container, scene.querySelector('#obalsHud'));
        document.body.classList.add(LIVE_CLASS);
        document.body.classList.remove(SEAT_CLASS, PENDING_CLASS);
        clearTableAnchors();

        try {
          // `rising` and `attic` share the same PlayerRig key, so this enables
          // interactables without restarting the completed stand-up movement.
          renderAtticMode(adapter, 'attic');
        } catch (error) {
          console.warn('The Last Reading: promoted attic failed to become interactive.', error);
          destroy();
          return;
        }

        hint = showControlsHint(scene);
        requestAnimationFrame(() =>
          requestAnimationFrame(() => {
            if (!unmounted) clearPromotionSceneStyles(scene);
          }),
        );
        armReturnWatch();
      };

      const waitForStanding = () => {
        if (unmounted || finished) return;
        const phase = handle.api?.getState?.().phase;
        if (phase === 'free' || performance.now() - startedAt >= STAND_TRANSFER_CEILING_MS) {
          finishPromotion();
          return;
        }
        transferTimer = setTimeout(waitForStanding, 50);
      };
      transferTimer = setTimeout(waitForStanding, 0);
      return handle;
    },
    // The backdrop belongs to the seated reading only: leave for the attic,
    // the menu, or another mode and it gets out of the way. atticFlow calls
    // promoteToAttic before setting mode-to-attic, so the observer is already
    // disconnected on the continuous path.
    observe() {
      observer?.disconnect();
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
    },
  };
  return handle;
}

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
    return '<b>You stand up from the table.</b><span>Tap anywhere to walk there — tap a glowing object to use it. Drag to look around; flick to turn fast. Sit back down at the chair when you are done.</span>';
  }
  return '<b>You stand up from the table.</b><span>Click a spot or a glowing object to walk to it, or use WASD and drag the mouse to look. Press E to search what you face. Sit back down at the chair when you are done.</span>';
}

// Once-per-page-session gate (not localStorage): the hint used to be
// suppressed forever after the first attic visit, which read as "the hint
// never shows". Showing it on the first attic visit of each session — and
// again after a reload — keeps it useful without nagging on every entry.
let controlsHintShownThisSession = false;

function showControlsHint(scene) {
  if (controlsHintShownThisSession) return null;
  controlsHintShownThisSession = true;
  try {
    // Legacy flag: honor it once so players who already learned the controls
    // in the old build aren't re-taught, then clear it so the session gate
    // above owns the behavior from here on.
    if (localStorage.getItem(HINT_KEY)) {
      localStorage.removeItem(HINT_KEY);
      return null;
    }
  } catch {
    /* storage unavailable: still show the hint, once per session */
  }
  const hint = document.createElement('div');
  hint.id = HINT_ID;
  hint.innerHTML = controlsHintHtml();
  scene.appendChild(hint);
  let removed = false;
  const dismiss = () => {
    if (removed) return;
    removed = true;
    clearTimeout(autoFade);
    hint.classList.add('fade');
    setTimeout(() => hint.remove(), 650);
  };
  // Fade on its own after a beat even if the player never moves, so it never
  // lingers over the room.
  const autoFade = setTimeout(dismiss, 9000);
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
      document.body.classList.remove(LIVE_CLASS, PENDING_CLASS);
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
  document.body.classList.remove(PENDING_CLASS);
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
  if (document.getElementById(APPROACH_ID) || document.getElementById(SEAT_ID) || !webglAvailable()) return null;

  const container = document.createElement('div');
  container.id = APPROACH_ID;
  document.body.appendChild(container);
  const root = createRoot(container);
  const adapter = approachAdapterStub();

  let disposed = false;
  let converted = false;
  let sequenceDone = false;
  let gate = null; // optional promise the handoff waits on (the boot beneath)
  let safetyTimer = 0;
  let observer = null;

  const dispose = () => {
    if (disposed || converted) return;
    disposed = true;
    handle.mounted = false;
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

  // The performance-critical handoff: instead of fading this overlay out and
  // mounting a SECOND canvas for the seated backdrop (two live WebGL
  // contexts + duplicate shader compiles right as the reading begins — the
  // sit-down hitch), the same root/context re-renders in table mode and the
  // container morphs from opaque overlay to pointer-transparent backdrop. A
  // brief plain-DOM veil covers the z-order swap, no canvas work involved.
  const convertToSeated = () => {
    if (disposed || converted) return;
    converted = true;
    clearTimeout(safetyTimer);
    observer?.disconnect();

    const veil = document.createElement('div');
    veil.className = 'table3d-reveal-veil';
    document.body.appendChild(veil);
    // Hold the veil opaque while the seated backdrop renders and the anchor
    // projector runs its first settle pass (~450ms) — otherwise the spread
    // and hand are seen snapping into their anchored positions the instant
    // the loading screen clears ("janky shit right after loading"). Then
    // fade to reveal an already-settled table.
    setTimeout(() => veil.classList.add('out'), 650);
    setTimeout(() => veil.remove(), 1300);

    container.id = SEAT_ID;
    container.classList.remove('fade');

    const seatHandle = createSeatedHandle(container, root);
    root.render(
      createElement(AtticExperience, {
        adapter,
        mode: 'table',
        registerApi: api => {
          seatHandle.api = api;
        },
      }),
    );
    document.body.classList.add(SEAT_CLASS);
    document.body.classList.remove(PENDING_CLASS);
    seatHandle.observe();
    window.__tlrTableSeat = seatHandle;

    handle.mounted = false;
    if (window.__tlrTable3d === handle) delete window.__tlrTable3d;
    onDone?.();
  };

  const maybeFinish = () => {
    if (!sequenceDone) return;
    if (gate) {
      gate.finally(convertToSeated);
    } else {
      convertToSeated();
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
        adapter,
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
  safetyTimer = setTimeout(convertToSeated, 14000);

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
  const handle = createSeatedHandle(container, root);

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
  document.body.classList.remove(PENDING_CLASS);

  handle.observe();
  window.__tlrTableSeat = handle;
  return handle;
}
