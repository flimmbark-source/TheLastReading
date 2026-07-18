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

const CONTAINER_ID = 'attic3dRoot';
const HINT_ID = 'attic3dHint';
const HINT_KEY = 'tlr_attic3d_hint_seen';
const LIVE_CLASS = 'attic3d-live';

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
    return '<b>You stand up from the table.</b><span>Drag the left side to walk, the right side to look. Tap a glowing object to search it. Sit back down at the chair when you are done.</span>';
  }
  return '<b>You stand up from the table.</b><span>WASD to walk, drag the mouse to look. Press E (or click) on a glowing object to search it. Sit back down at the chair when you are done.</span>';
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
