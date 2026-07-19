// Projects the named table anchors (atticLayout.TABLE_ANCHORS) through the
// seated camera into screen space and publishes them as CSS variables on
// <html>, so the live SPv2 DOM spread and hand track the 3D table:
//
//   --t3d-<anchor>-x / -y   projected screen position (px)
//   --t3d-spread-scale      scale for #spread so its slot row spans
//                           SPREAD_WORLD_WIDTH meters on the cloth
//   --t3d-hand-scale        scale for the hand dock at the near-edge depth
//   --t3d-hand-dy           vertical shift moving the dock's fan onto hand-c
//
// It also owns the fit gate: body.table3d-anchored is present only when the
// scaled rows actually fit the viewport. Narrow portrait screens fail the
// check and keep SPv2's own layout over the 3D backdrop instead of
// overflowing (see src/styles/attic3d.css).
//
// Measurement note: SPv2 fans both rows with element transforms (identical
// offsetLefts), so natural sizes can only be read from getBoundingClientRect.
// To stay idempotent, the anchored class is stripped and styles flushed
// inside one synchronous block — the browser never paints the intermediate
// state — then re-applied with the freshly computed variables. The seated
// camera is stationary, so this runs on mount and resize only.

import * as THREE from 'three';
import { TABLE_ANCHORS, SPREAD_WORLD_WIDTH, HAND_WORLD_WIDTH } from './atticLayout.mjs';

const ANCHORED_CLASS = 'table3d-anchored';
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

export function applyTableAnchors(camera, size) {
  const style = document.documentElement.style;
  const body = document.body;

  for (const [name, point] of Object.entries(TABLE_ANCHORS)) {
    const projected = projectPoint(camera, size, point);
    if (!projected) continue;
    setVar(style, `--t3d-${name}-x`, `${projected.x.toFixed(1)}px`);
    setVar(style, `--t3d-${name}-y`, `${projected.y.toFixed(1)}px`);
  }

  // Strip our transforms and flush styles so all rects below are natural.
  body.classList.remove(ANCHORED_CLASS);
  void body.offsetWidth;

  let fits = false;

  const spread = document.getElementById('spread');
  const slots = spread ? [...spread.querySelectorAll('.slot')] : [];
  const slotRect = unionRect(slots);
  const spreadSpanPx = projectedSpan(camera, size, TABLE_ANCHORS['spread-c'], SPREAD_WORLD_WIDTH);
  if (slotRect && spreadSpanPx > 0) {
    const scale = THREE.MathUtils.clamp(spreadSpanPx / slotRect.width, 0.45, 1.6);
    setVar(style, '--t3d-spread-scale', scale.toFixed(4));
    fits = slotRect.width * scale <= size.width * 0.96;
  }

  const hand = document.getElementById('hand');
  const dock = document.querySelector('.handDock');
  const handAnchor = projectPoint(camera, size, TABLE_ANCHORS['hand-c']);
  if (fits && hand && dock && handAnchor) {
    const cards = [...hand.querySelectorAll('.card')];
    const fanRect = unionRect(cards.length ? cards : [hand]);
    const handSpanPx = projectedSpan(camera, size, TABLE_ANCHORS['hand-c'], HAND_WORLD_WIDTH);
    if (fanRect && handSpanPx > 0) {
      const scale = THREE.MathUtils.clamp(handSpanPx / fanRect.width, 0.45, 1.5);
      setVar(style, '--t3d-hand-scale', scale.toFixed(4));
      fits = fits && fanRect.width * scale <= size.width * 1.08; // the fan may kiss the edges

      // The dock scales about its bottom-center (transform-origin 50% 100%),
      // so a natural point p maps to O + scale * (p - O) + dy, where O is the
      // dock's natural bottom edge. Solve for the dy that puts the fan's
      // visual center on the hand anchor.
      const originY = dock.getBoundingClientRect().bottom;
      const fanCenterNatural = (fanRect.top + fanRect.bottom) / 2;
      const wanted = handAnchor.y - (originY + scale * (fanCenterNatural - originY));
      // Lift freely onto the cloth, but never push the bottom-pinned dock
      // further down than a whisker.
      const dy = THREE.MathUtils.clamp(wanted, -size.height * 0.3, 24);
      setVar(style, '--t3d-hand-dy', `${dy.toFixed(1)}px`);
    } else {
      fits = false;
    }
  }

  body.classList.toggle(ANCHORED_CLASS, Boolean(fits));
}

export function clearTableAnchors() {
  const style = document.documentElement.style;
  for (const name of APPLIED_VARS) style.removeProperty(name);
  APPLIED_VARS.length = 0;
  document.body.classList.remove(ANCHORED_CLASS);
}
