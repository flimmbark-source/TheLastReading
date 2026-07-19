// Projects the named table anchors through the seated camera into screen
// space and publishes them as CSS variables on <html>, so the live SPv2 DOM
// spread and hand track the 3D table:
//
//   --t3d-<anchor>-x / -y   projected screen position (px)
//   --t3d-spread-scale      scale for #spread so its slot row spans the
//                           orientation's spread world width
//   --t3d-hand-scale        scale for the hand dock at the near-edge depth
//   --t3d-hand-dy           vertical shift moving the dock's fan onto hand-c
//
// Orientation picks the composition, not just the projection: portrait uses
// its own camera pose (PlayerRig), its own anchor set, and its own world
// widths (PORTRAIT_* in atticLayout).
//
// Fit gates (controlled escalation, mobile-first):
//   body.table3d-anchored       the spread is re-seated onto the cloth
//   body.table3d-anchored-hand  the hand dock is re-seated as well
// The spread anchors whenever its scaled row fits the viewport. The hand
// anchors on landscape/desktop by default; on portrait it stays native
// (Test A) unless localStorage tlr_t3d_hand_anchor_portrait === '1'
// (Test B) — flip it at runtime and call window.__tlrT3dReproject() to
// compare compositions live.
//
// Measurement note: SPv2 fans both rows with element transforms (identical
// offsetLefts), so natural sizes can only be read from getBoundingClientRect.
// To stay idempotent, the anchored classes are stripped and styles flushed
// inside one synchronous block — the browser never paints the intermediate
// state — then re-applied with the freshly computed variables. The seated
// camera is stationary, so this runs on mount and resize only.

import * as THREE from 'three';
import {
  TABLE_ANCHORS,
  PORTRAIT_TABLE_ANCHORS,
  HAND_WORLD_WIDTH,
  PORTRAIT_HAND_WORLD_WIDTH,
  CLOTH_FAR_RIM,
} from './atticLayout.mjs';

const ANCHORED_CLASS = 'table3d-anchored';
const HAND_CLASS = 'table3d-anchored-hand';
const PORTRAIT_HAND_KEY = 'tlr_t3d_hand_anchor_portrait';
const APPLIED_VARS = [];

function setVar(style, name, value) {
  style.setProperty(name, value);
  if (!APPLIED_VARS.includes(name)) APPLIED_VARS.push(name);
}

function projectPoint(camera, size, point) {
  const v = new THREE.Vector3(...point).project(camera);
  if (v.z >= 1) return null;
  return {
    x: ((v.x + 1) / 2) * size.width,
    y: ((1 - v.y) / 2) * size.height,
  };
}

// Projected px width of a `worldWidth`-wide segment centred on `anchor`.
function projectedSpan(camera, size, anchor, worldWidth) {
  const [x, y, z] = anchor;
  const left = projectPoint(camera, size, [x - worldWidth / 2, y, z]);
  const right = projectPoint(camera, size, [x + worldWidth / 2, y, z]);
  if (!left || !right) return 0;
  return Math.hypot(right.x - left.x, right.y - left.y);
}

// Union rect of a list of elements (visual space — includes their fans).
function unionRect(elements) {
  let left = Infinity;
  let right = -Infinity;
  let top = Infinity;
  let bottom = -Infinity;
  for (const el of elements) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) continue;
    left = Math.min(left, r.left);
    right = Math.max(right, r.right);
    top = Math.min(top, r.top);
    bottom = Math.max(bottom, r.bottom);
  }
  if (right <= left) return null;
  return { left, right, top, bottom, width: right - left, height: bottom - top };
}

function portraitHandEnabled() {
  try {
    return localStorage.getItem(PORTRAIT_HAND_KEY) === '1';
  } catch {
    return false;
  }
}

export function applyTableAnchors(camera, size) {
  const style = document.documentElement.style;
  const body = document.body;
  const portrait = size.width < size.height;
  const anchors = portrait ? PORTRAIT_TABLE_ANCHORS : TABLE_ANCHORS;
  const handWorldWidth = portrait ? PORTRAIT_HAND_WORLD_WIDTH : HAND_WORLD_WIDTH;

  // The projector can run before the first render tick; make sure the
  // camera matrices reflect the pose PlayerRig just applied.
  camera.updateMatrixWorld();
  camera.matrixWorldInverse.copy(camera.matrixWorld).invert();

  for (const [name, point] of Object.entries(anchors)) {
    const projected = projectPoint(camera, size, point);
    if (!projected) continue;
    setVar(style, `--t3d-${name}-x`, `${projected.x.toFixed(1)}px`);
    setVar(style, `--t3d-${name}-y`, `${projected.y.toFixed(1)}px`);
  }

  // Real geometric reference for the rim-overlap acceptance check: the
  // screen Y of the cloth's far rim. Card tops belong below this line.
  const rim = projectPoint(camera, size, CLOTH_FAR_RIM);
  if (rim) setVar(style, '--t3d-cloth-rim-y', `${rim.y.toFixed(1)}px`);

  // Strip our transforms and flush styles so all rects below are natural.
  body.classList.remove(ANCHORED_CLASS, HAND_CLASS);
  void body.offsetWidth;

  let spreadFits = false;
  let handFits = false;

  // The spread is repositioned onto the table, never resized: these are the
  // real SPv2 DOM cards, and their native size (already tuned by SPv2's own
  // responsive CSS) is what "looks like SPv2" means. --t3d-spread-scale is
  // fixed at 1 rather than derived from projecting SPREAD_WORLD_WIDTH, so
  // the fit-gate below checks only whether the native-size row clears the
  // viewport at its new, centered screen position.
  const spread = document.getElementById('spread');
  const slots = spread ? [...spread.querySelectorAll('.slot')] : [];
  const slotRect = unionRect(slots);
  const spreadCenter = projectPoint(camera, size, anchors['spread-c']);
  if (slotRect && spreadCenter) {
    setVar(style, '--t3d-spread-scale', '1');
    const halfWidth = slotRect.width / 2;
    spreadFits = spreadCenter.x - halfWidth >= 0 && spreadCenter.x + halfWidth <= size.width;
  }

  // Controlled escalation: the hand only anchors where it has room —
  // always attempted on landscape/desktop, opt-in on portrait (Test B).
  const attemptHand = spreadFits && (!portrait || portraitHandEnabled());
  const hand = document.getElementById('hand');
  const dock = document.querySelector('.handDock');
  const handAnchor = projectPoint(camera, size, anchors['hand-c']);
  if (attemptHand && hand && dock && handAnchor) {
    const cards = [...hand.querySelectorAll('.card')];
    const fanRect = unionRect(cards.length ? cards : [hand]);
    const handSpanPx = projectedSpan(camera, size, anchors['hand-c'], handWorldWidth);
    if (fanRect && handSpanPx > 0) {
      const scale = THREE.MathUtils.clamp(handSpanPx / fanRect.width, 0.45, 1.5);
      setVar(style, '--t3d-hand-scale', scale.toFixed(4));
      handFits = fanRect.width * scale <= size.width * 1.08; // the fan may kiss the edges

      if (handFits) {
        // The dock scales about its bottom-center (transform-origin 50% 100%),
        // so a natural point p maps to O + scale * (p - O) + dy, where O is
        // the dock's natural bottom edge. Solve for the dy that puts the
        // fan's visual center on the hand anchor.
        const originY = dock.getBoundingClientRect().bottom;
        const fanCenterNatural = (fanRect.top + fanRect.bottom) / 2;
        const wanted = handAnchor.y - (originY + scale * (fanCenterNatural - originY));
        // Lift freely onto the cloth, but never push the bottom-pinned dock
        // further down than a whisker.
        const dy = THREE.MathUtils.clamp(wanted, -size.height * 0.3, 24);
        setVar(style, '--t3d-hand-dy', `${dy.toFixed(1)}px`);
      }
    }
  }

  body.classList.toggle(ANCHORED_CLASS, Boolean(spreadFits));
  body.classList.toggle(HAND_CLASS, Boolean(handFits));
}

export function clearTableAnchors() {
  const style = document.documentElement.style;
  for (const name of APPLIED_VARS) style.removeProperty(name);
  APPLIED_VARS.length = 0;
  document.body.classList.remove(ANCHORED_CLASS, HAND_CLASS);
}
