// First-person player rig and camera choreography.
//
// Attic mode mirrors the fiction of the visit: the rig mounts seated at the
// reading table (matching the 2D table UI the player just left), stands up
// over ~1.7s, hands over free-walk control, and — when the player sits back
// down at the chair — plays the getting-up move in reverse (a single smooth
// glide back down into the seat over the same ~1.7s) and only then calls
// adapter.leave(), which runs the existing attic->table fade and unmounts us.
//
// Approach mode (run start) instead plays the APPROACH_KEYFRAMES timeline —
// in through the attic door, up to the chair, down into the seat — then
// reports completion so the overlay can cross-fade into the 2D table UI.
// Any key or tap skips it.
//
// Movement: WASD/arrows plus tap/click-to-walk — a tap on an interactable
// walks over and uses it, a tap on open floor walks there (gold ring marks
// the destination). Dragging anywhere on the screen looks around; on touch
// the sensitivity scales with the screen (a full-width swipe ≈ 155°) and a
// released swipe carries flick inertia, so turning away from a wall is one
// gesture instead of repeated sawing. E (or click/tap) interacts with the
// focused station. prefers-reduced-motion skips all camera choreography.

import { useContext, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { AtticContext, domSurfaceOpen } from './AtticExperience.jsx';
import { POSES, PORTRAIT_POSES, ROOM, KEEP_OUT, EYE_HEIGHT, APPROACH_KEYFRAMES } from './atticLayout.mjs';

const RISE_SECONDS = 1.7;
// Sitting back down is the getting-up animation played in reverse, so it runs
// over the same duration and easing as the rise rather than its own timing.
const SIT_SECONDS = RISE_SECONDS;
const WALK_SPEED = 2.1;
// Touch fingers are far less precise than a mouse cursor; give taps on
// interactables a much larger forgiving radius there.
const TAP_PICK_RADIUS_MOUSE_PX = 64;
const TAP_PICK_RADIUS_TOUCH_PX = 96;
const MOUSE_YAW_SENS = 0.0044;
const MOUSE_PITCH_SENS = 0.0038;
const MOVE_KEYS = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);

// Touch look sensitivity is proportional to the screen, not fixed per-pixel:
// a full-width swipe turns ~155°, so a small phone can whip a 180° in one
// comfortable flick-and-a-nudge instead of sawing at the glass.
function touchYawSens() {
  return 2.7 / Math.max(320, window.innerWidth);
}
function touchPitchSens() {
  return 2.1 / Math.max(480, window.innerHeight);
}

function poseAngles(pose) {
  const eye = new THREE.Vector3(...pose.eye);
  const dir = new THREE.Vector3(...pose.look).sub(eye).normalize();
  return {
    eye,
    pitch: Math.asin(THREE.MathUtils.clamp(dir.y, -1, 1)),
    yaw: Math.atan2(-dir.x, -dir.z),
  };
}

const SEATED = poseAngles(POSES.seated);
const PORTRAIT_SEATED = poseAngles(PORTRAIT_POSES.seated);
const STANDING = poseAngles(POSES.standing);
const SEATED_EYELINE = poseAngles(POSES.seatedEyeline);

function smooth(t) {
  return t * t * (3 - 2 * t);
}

// Perlin's smootherstep: zero 1st AND 2nd derivative at both ends, so the
// rise/sit accelerate and settle without the velocity kink smoothstep leaves.
// The camera leaves rest and arrives at rest cleanly, which is what makes the
// hand-off to (and from) free-look read as continuous instead of a stutter.
function smootherstep(t) {
  return t * t * t * (t * (t * 6 - 15) + 10);
}

// Quadratic Bézier that is *forced through* a waypoint at its midpoint: given
// endpoints a, c and a point w the curve must pass through at s=0.5, the
// control point is 2w - (a+c)/2. One continuous curve (no segment seam) that
// still visits the low seated eye-line, so getting up / sitting down dips
// through a believable seat without the mid-animation hitch two lerps caused.
function bezierControl(a, w, c) {
  return 2 * w - (a + c) / 2;
}
function bezier(a, cp, c, s) {
  const u = 1 - s;
  return u * u * a + 2 * u * s * cp + s * s * c;
}

// The rise is a single Bézier SEATED -> (through) SEATED_EYELINE -> STANDING;
// its control point is constant, so precompute it per axis. The seated/standing
// yaw are both 0, so only eye position and pitch actually curve.
const RISE_EYE_CP = new THREE.Vector3(
  bezierControl(SEATED.eye.x, SEATED_EYELINE.eye.x, STANDING.eye.x),
  bezierControl(SEATED.eye.y, SEATED_EYELINE.eye.y, STANDING.eye.y),
  bezierControl(SEATED.eye.z, SEATED_EYELINE.eye.z, STANDING.eye.z),
);
const RISE_PITCH_CP = bezierControl(SEATED.pitch, SEATED_EYELINE.pitch, STANDING.pitch);
const RISE_YAW_CP = bezierControl(SEATED.yaw, SEATED_EYELINE.yaw, STANDING.yaw);

function angleDelta(a, b) {
  let difference = (b - a) % (Math.PI * 2);
  if (difference > Math.PI) difference -= Math.PI * 2;
  if (difference < -Math.PI) difference += Math.PI * 2;
  return difference;
}

function lerpAngle(a, b, t) {
  let difference = (b - a) % (Math.PI * 2);
  if (difference > Math.PI) difference -= Math.PI * 2;
  if (difference < -Math.PI) difference += Math.PI * 2;
  return a + difference * t;
}

// Sample the approach timeline at `time`, easing within each segment.
function sampleKeyframes(frames, time) {
  const last = frames[frames.length - 1];
  if (time >= last.t) return poseAngles(last);
  let index = 0;
  while (index < frames.length - 2 && time > frames[index + 1].t) index += 1;
  const a = frames[index];
  const b = frames[index + 1];
  const k = smooth(THREE.MathUtils.clamp((time - a.t) / (b.t - a.t), 0, 1));
  const eye = new THREE.Vector3(...a.eye).lerp(new THREE.Vector3(...b.eye), k);
  const look = new THREE.Vector3(...a.look).lerp(new THREE.Vector3(...b.look), k);
  return anglesFor(eye, look);
}

function anglesFor(eye, look) {
  const dir = look.clone().sub(eye).normalize();
  return {
    eye,
    pitch: Math.asin(THREE.MathUtils.clamp(dir.y, -1, 1)),
    yaw: Math.atan2(-dir.x, -dir.z),
  };
}

// Keep a walk destination inside the room and outside solid clutter.
function legalizeTarget(x, z) {
  const limitX = ROOM.halfX - ROOM.walkInset;
  const limitZ = ROOM.halfZ - ROOM.walkInset;
  let tx = THREE.MathUtils.clamp(x, -limitX, limitX);
  let tz = THREE.MathUtils.clamp(z, -limitZ, limitZ);
  for (const [cx, cz, radius] of KEEP_OUT) {
    const dx = tx - cx;
    const dz = tz - cz;
    const dist = Math.hypot(dx, dz);
    if (dist < radius + 0.05) {
      const push = (radius + 0.08) / Math.max(dist, 1e-4);
      tx = cx + dx * push;
      tz = cz + dz * push;
    }
  }
  return [THREE.MathUtils.clamp(tx, -limitX, limitX), THREE.MathUtils.clamp(tz, -limitZ, limitZ)];
}

export function PlayerRig() {
  const {
    adapter,
    mode,
    interactables,
    setFocusId,
    sitRef,
    reducedMotion,
    onFirstMove,
    registerApi,
    autoWalkRef,
    onSequenceComplete,
  } = useContext(AtticContext);
  const { camera, gl, scene, size } = useThree();
  const approach = mode === 'approach';
  const seatedTable = mode === 'table'; // hybrid reading backdrop: static camera, no input
  const portrait = size.width < size.height;

  // Portrait sacrifices pose parity: the approach ends (and the seated table
  // holds) the dedicated top-down portrait pose, so the reveal into the
  // hybrid stays continuous on both orientations.
  const approachFrames = useMemo(() => {
    const last = APPROACH_KEYFRAMES[APPROACH_KEYFRAMES.length - 1];
    const pose = portrait ? PORTRAIT_POSES.seated : POSES.seated;
    return [...APPROACH_KEYFRAMES.slice(0, -1), { t: last.t, eye: pose.eye, look: pose.look }];
  }, [portrait]);

  const rig = useRef(null);
  if (!rig.current) {
    const start = approach
      ? anglesFor(new THREE.Vector3(...APPROACH_KEYFRAMES[0].eye), new THREE.Vector3(...APPROACH_KEYFRAMES[0].look))
      : null;
    rig.current = {
      phase: seatedTable ? 'table' : approach ? 'approach' : reducedMotion ? 'free' : 'rising',
      phaseT: 0,
      pos: seatedTable
        ? SEATED.eye.clone()
        : approach
          ? start.eye.clone()
          : reducedMotion
            ? STANDING.eye.clone()
            : SEATED.eye.clone(),
      yaw: seatedTable ? SEATED.yaw : approach ? start.yaw : reducedMotion ? STANDING.yaw : SEATED.yaw,
      pitch: seatedTable ? SEATED.pitch : approach ? start.pitch : reducedMotion ? STANDING.pitch : SEATED.pitch,
      vel: new THREE.Vector3(),
      keys: new Set(),
      pointers: new Map(),
      lookPointerId: null, // only the first finger down steers the camera
      lookVel: { yaw: 0, pitch: 0 }, // flick inertia, decays in useFrame
      bobT: 0,
      focusId: null,
      sitFrom: null,
      left: false,
      firstMoveSeen: false,
      autoWalk: null, // { x, z, interactId } while walking to a tapped point
      stallSince: 0, // performance.now() when progress toward the target stalled (0 = moving)
      bestDist: Infinity, // closest we have gotten to the auto-walk target
      completed: false,
    };
  }

  const noteFirstMove = () => {
    if (rig.current.firstMoveSeen) return;
    rig.current.firstMoveSeen = true;
    onFirstMove?.();
  };

  const setAutoWalk = target => {
    rig.current.autoWalk = target;
    rig.current.stallSince = 0;
    rig.current.bestDist = Infinity;
    if (autoWalkRef) {
      autoWalkRef.current = target ? { active: true, x: target.x, z: target.z } : { active: false, x: 0, z: 0 };
    }
  };

  const completeSequence = () => {
    const r = rig.current;
    if (r.completed) return;
    r.completed = true;
    onSequenceComplete?.();
  };

  const skipApproach = () => {
    const r = rig.current;
    if (r.phase !== 'approach') return;
    const end = poseAngles(approachFrames[approachFrames.length - 1]);
    r.pos.copy(end.eye);
    r.yaw = end.yaw;
    r.pitch = end.pitch;
    r.phase = 'done';
    completeSequence();
  };

  const interact = () => {
    const r = rig.current;
    if (r.phase === 'approach') {
      skipApproach();
      return;
    }
    if (r.phase !== 'free' || domSurfaceOpen()) return;
    const item = interactables.find(candidate => candidate.id === r.focusId);
    item?.action();
  };
  const interactRef = useRef(interact);
  interactRef.current = interact;

  // Begin walking toward a world point; optionally use an interactable on
  // arrival. Exposed on the debug api as walkTo().
  const walkTo = (x, z, interactId = null) => {
    const r = rig.current;
    if (r.phase !== 'free') return;
    const [tx, tz] = legalizeTarget(x, z);
    setAutoWalk({ x: tx, z: tz, interactId });
    noteFirstMove();
  };
  const walkToRef = useRef(walkTo);
  walkToRef.current = walkTo;

  // A clean tap: prefer an interactable near the tap point on screen, else
  // walk to the tapped floor position.
  const handleTap = (clientX, clientY, isTouch = false) => {
    const r = rig.current;
    if (r.phase === 'approach') {
      skipApproach();
      return;
    }
    if (r.phase !== 'free') return;

    const rect = gl.domElement.getBoundingClientRect();
    const px = clientX - rect.left;
    const py = clientY - rect.top;
    const pickRadius = isTouch ? TAP_PICK_RADIUS_TOUCH_PX : TAP_PICK_RADIUS_MOUSE_PX;

    // Screen-space pick over interactables (generous touch-target radius).
    // The chair and the big prop stations are large physical objects, so a
    // tap landing near them — not dead on the focus point — should still
    // count; missing the chair this way is what left players unable to sit
    // by tapping it. The note stays tight (radius ×1) because it sits on the
    // table where floor-walk taps land and must not swallow them.
    let picked = null;
    const projected = new THREE.Vector3();
    for (const item of interactables) {
      projected.set(...item.focusPoint).project(camera);
      if (projected.z >= 1) continue; // behind the camera
      const sx = ((projected.x + 1) / 2) * size.width;
      const sy = ((1 - projected.y) / 2) * size.height;
      const distPx = Math.hypot(sx - px, sy - py);
      const itemRadius = pickRadius * (item.kind === 'chair' ? 1.6 : item.kind === 'note' ? 1 : 1.3);
      if (distPx <= itemRadius && (!picked || distPx < picked.distPx)) {
        picked = { item, distPx };
      }
    }
    if (picked) {
      const { item } = picked;
      const dx = item.focusPoint[0] - r.pos.x;
      const dz = item.focusPoint[2] - r.pos.z;
      const dist = Math.hypot(dx, dz);
      if (dist <= item.reach * 0.95) {
        if (!domSurfaceOpen()) {
          r.focusId = item.id;
          setFocusId(item.id);
          item.action();
        }
        return;
      }
      // Approach point: pull back from the item toward the player by most of
      // its reach so arrival lands comfortably inside interaction range.
      const back = Math.max(dist - item.reach * 0.7, 0) / dist;
      walkToRef.current(r.pos.x + dx * back, r.pos.z + dz * back, item.id);
      return;
    }

    // Floor tap: cast through the tap point onto the y=0 plane.
    const ndcX = (px / size.width) * 2 - 1;
    const ndcY = -(py / size.height) * 2 + 1;
    const origin = camera.position.clone();
    const dir = new THREE.Vector3(ndcX, ndcY, 0.5).unproject(camera).sub(origin).normalize();
    if (dir.y > -0.04) return; // looking at walls/ceiling: nothing to walk to
    const t = -origin.y / dir.y;
    if (!Number.isFinite(t) || t <= 0 || t > 40) return;
    walkToRef.current(origin.x + dir.x * t, origin.z + dir.z * t, null);
  };
  const tapRef = useRef(handleTap);
  tapRef.current = handleTap;

  // The approach overlay converts to the seated backdrop in place (same
  // mounted rig, mode prop flips to 'table'): drop into the static seated
  // phase and shed every bit of transient input state.
  useEffect(() => {
    if (!seatedTable) return;
    const r = rig.current;
    if (r.phase !== 'table') {
      r.phase = 'table';
      r.keys.clear();
      r.pointers.clear();
      r.lookPointerId = null;
      r.lookVel.yaw = 0;
      r.lookVel.pitch = 0;
      setAutoWalk(null);
    }
  }, [seatedTable]);

  const beginSit = () => {
    const r = rig.current;
    if (r.phase !== 'free') return;
    setAutoWalk(null);
    if (reducedMotion) {
      r.phase = 'done';
      settleSeated(r);
      leaveOnce(r, adapter);
      return;
    }
    r.phase = 'sitting';
    r.phaseT = 0;
    // Sit is the same single Bézier as the rise, but from wherever the player
    // is standing: curve from here, through the seated eye-line, to the seat.
    // Yaw is unwrapped relative to the start so a player who turned around
    // rotates back the short way instead of spinning.
    const from = r.pos.clone();
    const wYaw = r.yaw + angleDelta(r.yaw, SEATED_EYELINE.yaw);
    const endYaw = wYaw + angleDelta(SEATED_EYELINE.yaw, SEATED.yaw);
    r.sitFrom = {
      pos: from,
      cpEye: new THREE.Vector3(
        bezierControl(from.x, SEATED_EYELINE.eye.x, SEATED.eye.x),
        bezierControl(from.y, SEATED_EYELINE.eye.y, SEATED.eye.y),
        bezierControl(from.z, SEATED_EYELINE.eye.z, SEATED.eye.z),
      ),
      yaw: r.yaw,
      cpYaw: bezierControl(r.yaw, wYaw, endYaw),
      endYaw,
      pitch: r.pitch,
      cpPitch: bezierControl(r.pitch, SEATED_EYELINE.pitch, SEATED.pitch),
    };
  };
  sitRef.current = beginSit;

  // ── input listeners ──
  useEffect(() => {
    if (seatedTable) return undefined; // pure backdrop: the DOM owns all input (re-runs on convert)
    const element = gl.domElement;

    const onKeyDown = event => {
      if (/INPUT|TEXTAREA|SELECT/.test(event.target?.tagName || '')) return;
      if (rig.current.phase === 'approach') {
        skipApproach();
        event.preventDefault();
        return;
      }
      if (MOVE_KEYS.has(event.code)) {
        rig.current.keys.add(event.code);
        noteFirstMove();
        event.preventDefault();
      } else if (event.code === 'KeyE') {
        interactRef.current();
        event.preventDefault();
      }
    };
    const onKeyUp = event => rig.current.keys.delete(event.code);
    const onBlur = () => {
      const r = rig.current;
      r.keys.clear();
      r.pointers.clear();
      r.lookPointerId = null;
      r.lookVel.yaw = 0;
      r.lookVel.pitch = 0;
    };

    // The whole screen looks: any drag steers the camera (tap-to-move covers
    // locomotion on touch, WASD on desktop, so no virtual stick eats screen
    // space or splits the glass into invisible zones).
    const onPointerDown = event => {
      element.setPointerCapture?.(event.pointerId);
      const r = rig.current;
      r.pointers.set(event.pointerId, {
        isTouch: event.pointerType === 'touch',
        startX: event.clientX,
        startY: event.clientY,
        lastX: event.clientX,
        lastY: event.clientY,
        moved: false,
        t0: performance.now(),
        lastMoveT: performance.now(),
        flickVx: 0,
        flickVy: 0,
      });
      if (r.lookPointerId === null) r.lookPointerId = event.pointerId;
      // Grabbing the view again stops any in-flight flick spin dead.
      r.lookVel.yaw = 0;
      r.lookVel.pitch = 0;
    };
    const onPointerMove = event => {
      const r = rig.current;
      const pointer = r.pointers.get(event.pointerId);
      if (!pointer) return;
      const totalX = event.clientX - pointer.startX;
      const totalY = event.clientY - pointer.startY;
      if (Math.hypot(totalX, totalY) > 7) pointer.moved = true;
      if (event.pointerId === r.lookPointerId) {
        const dx = event.clientX - pointer.lastX;
        const dy = event.clientY - pointer.lastY;
        const yawSens = pointer.isTouch ? touchYawSens() : MOUSE_YAW_SENS;
        const pitchSens = pointer.isTouch ? touchPitchSens() : MOUSE_PITCH_SENS;
        if (r.phase === 'free') {
          r.yaw -= dx * yawSens;
          r.pitch = THREE.MathUtils.clamp(r.pitch - dy * pitchSens, -1.25, 1.25);
          // Looking by hand during a tap-walk takes the wheel: stop the walk
          // from re-steering the facing so the player can rotate the view
          // freely while still travelling to the destination.
          if (r.autoWalk && (dx || dy)) r.autoWalk.userAimed = true;
        }
        // Smoothed px/ms velocity feeds the release flick.
        const now = performance.now();
        const dt = Math.max(1, now - pointer.lastMoveT);
        pointer.flickVx = 0.75 * pointer.flickVx + (0.25 * dx) / dt;
        pointer.flickVy = 0.75 * pointer.flickVy + (0.25 * dy) / dt;
        pointer.lastMoveT = now;
        if (pointer.moved) noteFirstMove();
      }
      pointer.lastX = event.clientX;
      pointer.lastY = event.clientY;
    };
    const onPointerEnd = event => {
      const r = rig.current;
      const pointer = r.pointers.get(event.pointerId);
      r.pointers.delete(event.pointerId);
      if (event.pointerId === r.lookPointerId) {
        r.lookPointerId = r.pointers.keys().next().value ?? null;
      }
      if (!pointer) return;
      const now = performance.now();
      // A clean short press is a tap: use/walk to what was pressed (or skip
      // the approach).
      if (!pointer.moved && now - pointer.t0 < 350) {
        tapRef.current(event.clientX, event.clientY, pointer.isTouch);
        return;
      }
      // A released swipe keeps spinning with inertia (touch only): flicking
      // the glass turns you around instead of demanding three careful drags.
      if (pointer.isTouch && pointer.moved && now - pointer.lastMoveT < 90 && r.phase === 'free') {
        r.lookVel.yaw = THREE.MathUtils.clamp(-pointer.flickVx * touchYawSens() * 1000, -6, 6);
        r.lookVel.pitch = THREE.MathUtils.clamp(-pointer.flickVy * touchPitchSens() * 1000, -3, 3) * 0.6;
      }
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    element.addEventListener('pointerdown', onPointerDown);
    element.addEventListener('pointermove', onPointerMove);
    element.addEventListener('pointerup', onPointerEnd);
    element.addEventListener('pointercancel', onPointerEnd);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
      element.removeEventListener('pointerdown', onPointerDown);
      element.removeEventListener('pointermove', onPointerMove);
      element.removeEventListener('pointerup', onPointerEnd);
      element.removeEventListener('pointercancel', onPointerEnd);
    };
  }, [gl, seatedTable]);

  // ── debug/test surface (also used by the smoke script) ──
  useEffect(() => {
    registerApi?.({
      getState: () => {
        const r = rig.current;
        return {
          phase: r.phase,
          position: [r.pos.x, r.pos.y, r.pos.z],
          yaw: r.yaw,
          pitch: r.pitch,
          focusId: r.focusId,
          autoWalk: r.autoWalk ? { x: r.autoWalk.x, z: r.autoWalk.z, interactId: r.autoWalk.interactId } : null,
        };
      },
      teleport: (x, z, yaw = 0, pitch = 0) => {
        const r = rig.current;
        if (r.phase === 'rising') r.phase = 'free';
        setAutoWalk(null);
        r.pos.set(x, EYE_HEIGHT, z);
        r.yaw = yaw;
        r.pitch = pitch;
        r.vel.set(0, 0, 0);
      },
      walkTo: (x, z, interactId = null) => walkToRef.current(x, z, interactId),
      tapAt: (clientX, clientY, isTouch = false) => tapRef.current(clientX, clientY, isTouch),
      // World point -> screen px (for tests: tap exactly where a prop or the
      // chair projects). Returns [sx, sy, ndcZ]; ndcZ >= 1 means off-screen.
      projectPoint: point => {
        const v = new THREE.Vector3(...point).project(camera);
        return [((v.x + 1) / 2) * size.width, ((1 - v.y) / 2) * size.height, v.z];
      },
      interact: () => interactRef.current(),
      sit: () => beginSit(),
      skip: () => skipApproach(),
      // Scene inventory for the smoke script / console debugging.
      dumpScene: () => {
        const out = [];
        scene.traverse(object => {
          if (object.isMesh || object.isSprite || object.isPoints || object.isLight) {
            const p = object.getWorldPosition(new THREE.Vector3());
            const entry = {
              type: object.type,
              position: [+p.x.toFixed(2), +p.y.toFixed(2), +p.z.toFixed(2)],
              visible: object.visible,
            };
            if (object.name) entry.name = object.name;
            out.push(entry);
          }
        });
        return out;
      },
    });
  }, [registerApi]);

  useLayoutEffect(() => {
    applyCamera(camera, rig.current);
  }, [camera]);

  useFrame((_, rawDelta) => {
    const r = rig.current;
    const delta = Math.min(rawDelta, 1 / 20);

    if (r.phase === 'approach') {
      r.phaseT += delta;
      const sample = sampleKeyframes(approachFrames, r.phaseT);
      r.pos.copy(sample.eye);
      r.yaw = sample.yaw;
      r.pitch = sample.pitch;
      // Head-bob only while walking; fade it out approaching the chair.
      const standT = approachFrames[approachFrames.length - 2].t;
      const amp = 0.02 * THREE.MathUtils.clamp((standT - r.phaseT) / 0.45, 0, 1);
      if (!reducedMotion && amp > 0) {
        r.bobT += delta * 5.4;
        r.pos.y += Math.sin(r.bobT) * amp;
      }
      if (r.phaseT >= approachFrames[approachFrames.length - 1].t + 0.05) {
        r.phase = 'done';
        completeSequence();
      }
    } else if (r.phase === 'table') {
      // Stationary seated backdrop; the pose tracks orientation live so a
      // rotation mid-reading re-frames the table (the anchor projector
      // re-runs on the same resize).
      const pose = portrait ? PORTRAIT_SEATED : SEATED;
      r.pos.copy(pose.eye);
      r.yaw = pose.yaw;
      r.pitch = pose.pitch;
    } else if (r.phase === 'rising') {
      // One continuous Bézier from the presentation seat, THROUGH the low
      // seated eye-line, up to standing — a single eased curve so the sink and
      // the push-up read as one motion with no mid-arc hitch, ending exactly on
      // STANDING (smootherstep is monotonic, no overshoot) for a clean hand-off
      // to free-look.
      r.phaseT += delta / RISE_SECONDS;
      const s = smootherstep(Math.min(1, r.phaseT));
      r.pos.set(
        bezier(SEATED.eye.x, RISE_EYE_CP.x, STANDING.eye.x, s),
        bezier(SEATED.eye.y, RISE_EYE_CP.y, STANDING.eye.y, s),
        bezier(SEATED.eye.z, RISE_EYE_CP.z, STANDING.eye.z, s),
      );
      r.yaw = bezier(SEATED.yaw, RISE_YAW_CP, STANDING.yaw, s);
      r.pitch = bezier(SEATED.pitch, RISE_PITCH_CP, STANDING.pitch, s);
      if (r.phaseT >= 1) r.phase = 'free';
    } else if (r.phase === 'free') {
      stepMovement(r, delta, reducedMotion, interactables, setFocusId, setAutoWalk);
      updateFocus(r, camera, interactables, setFocusId);
    } else if (r.phase === 'sitting') {
      // The reverse of the rise: one continuous Bézier from where the player is
      // standing, through the seated eye-line, into the seat. Same single-curve
      // easing as the rise, so sitting down glides without the seam stutter two
      // stitched lerps produced.
      const f = r.sitFrom;
      r.phaseT += delta / SIT_SECONDS;
      const s = smootherstep(Math.min(1, r.phaseT));
      r.pos.set(
        bezier(f.pos.x, f.cpEye.x, SEATED.eye.x, s),
        bezier(f.pos.y, f.cpEye.y, SEATED.eye.y, s),
        bezier(f.pos.z, f.cpEye.z, SEATED.eye.z, s),
      );
      r.yaw = bezier(f.yaw, f.cpYaw, f.endYaw, s);
      r.pitch = bezier(f.pitch, f.cpPitch, SEATED.pitch, s);
      if (r.phaseT >= 1) {
        r.phase = 'done';
        settleSeated(r);
        leaveOnce(r, adapter);
      }
    }

    applyCamera(camera, r);
  });

  return null;
}

function settleSeated(r) {
  r.pos.copy(SEATED.eye);
  r.yaw = SEATED.yaw;
  r.pitch = SEATED.pitch;
  if (r.focusId) r.focusId = null;
}

function leaveOnce(r, adapter) {
  if (r.left) return;
  r.left = true;
  try {
    adapter.leave();
  } catch (error) {
    console.warn('The Last Reading: leaving the 3D attic failed.', error);
  }
}

function stepMovement(r, delta, reducedMotion, interactables, setFocusId, setAutoWalk) {
  // Flick inertia: a released swipe keeps turning the view, decaying out.
  if (r.lookVel.yaw !== 0 || r.lookVel.pitch !== 0) {
    r.yaw += r.lookVel.yaw * delta;
    r.pitch = THREE.MathUtils.clamp(r.pitch + r.lookVel.pitch * delta, -1.25, 1.25);
    const decay = Math.exp(-delta * 3.2);
    r.lookVel.yaw *= decay;
    r.lookVel.pitch *= decay;
    if (Math.abs(r.lookVel.yaw) < 0.02 && Math.abs(r.lookVel.pitch) < 0.02) {
      r.lookVel.yaw = 0;
      r.lookVel.pitch = 0;
    }
  }

  let forward = 0;
  let strafe = 0;
  if (r.keys.has('KeyW') || r.keys.has('ArrowUp')) forward += 1;
  if (r.keys.has('KeyS') || r.keys.has('ArrowDown')) forward -= 1;
  if (r.keys.has('KeyD') || r.keys.has('ArrowRight')) strafe += 1;
  if (r.keys.has('KeyA') || r.keys.has('ArrowLeft')) strafe -= 1;
  let magnitude = Math.hypot(forward, strafe);
  if (magnitude > 1) {
    forward /= magnitude;
    strafe /= magnitude;
    magnitude = 1;
  }

  // Manual input always wins over an in-flight tap-walk.
  if (magnitude > 0.05 && r.autoWalk) setAutoWalk(null);

  let targetX;
  let targetZ;
  if (r.autoWalk) {
    const walk = r.autoWalk;
    const dx = walk.x - r.pos.x;
    const dz = walk.z - r.pos.z;
    const dist = Math.hypot(dx, dz);

    const item = walk.interactId ? interactables.find(candidate => candidate.id === walk.interactId) : null;
    if (walk.interactId && !item) {
      setAutoWalk(null); // e.g. the prop got searched out from under us
      targetX = 0;
      targetZ = 0;
    } else if (item) {
      const idx = item.focusPoint[0] - r.pos.x;
      const idz = item.focusPoint[2] - r.pos.z;
      const itemDist = Math.hypot(idx, idz);
      if (itemDist <= item.reach * 0.9) {
        // Arrived: face it, use it.
        setAutoWalk(null);
        targetX = 0;
        targetZ = 0;
        r.yaw = Math.atan2(-idx, -idz);
        const dy = item.focusPoint[1] - r.pos.y;
        r.pitch = THREE.MathUtils.clamp(
          Math.asin(THREE.MathUtils.clamp(dy / Math.max(Math.hypot(itemDist, dy), 1e-4), -1, 1)),
          -1.1,
          1.1,
        );
        if (!domSurfaceOpen()) {
          r.focusId = item.id;
          setFocusId(item.id);
          item.action();
        }
      }
    }
    if (r.autoWalk) {
      if (dist < 0.14) {
        setAutoWalk(null);
        targetX = 0;
        targetZ = 0;
      } else {
        const ease = THREE.MathUtils.clamp(dist / 0.6, 0.4, 1);
        targetX = (dx / dist) * WALK_SPEED * ease;
        targetZ = (dz / dist) * WALK_SPEED * ease;
        // Turn to face the direction of travel unless the player is actively
        // drag-looking, or aimed the view by hand earlier in this walk.
        let looking = false;
        for (const pointer of r.pointers.values()) if (pointer.moved) looking = true;
        if (!looking && !walk.userAimed) {
          const walkYaw = Math.atan2(-dx / dist, -dz / dist);
          r.yaw = lerpAngle(r.yaw, walkYaw, 1 - Math.exp(-delta * 5));
        }
        // Time out if we stop making progress toward the destination —
        // whether we walked into an obstacle and dead-stopped, or are
        // sliding along one without ever arriving. Progress (distance
        // shrinking), not raw speed, is the test: grazing clutter still
        // closes on the goal and is allowed to complete, but a genuine
        // block gives up after ~1.2s. Timed in real wall-clock (not
        // accumulated frame delta, which is capped per frame): a low-FPS
        // device should bail after the same ~1.2s, not drag it out.
        if (dist < r.bestDist - 0.05) {
          r.bestDist = dist;
          r.stallSince = 0;
        } else {
          const nowMs = performance.now();
          if (!r.stallSince) r.stallSince = nowMs;
          else if (nowMs - r.stallSince > 1200) setAutoWalk(null);
        }
      }
    }
    if (targetX === undefined) {
      targetX = 0;
      targetZ = 0;
    }
  } else {
    const sinYaw = Math.sin(r.yaw);
    const cosYaw = Math.cos(r.yaw);
    targetX = (-sinYaw * forward + cosYaw * strafe) * WALK_SPEED;
    targetZ = (-cosYaw * forward - sinYaw * strafe) * WALK_SPEED;
  }

  const damp = 1 - Math.exp(-delta * 9);
  r.vel.x += (targetX - r.vel.x) * damp;
  r.vel.z += (targetZ - r.vel.z) * damp;

  r.pos.x += r.vel.x * delta;
  r.pos.z += r.vel.z * delta;

  for (const [cx, cz, radius] of KEEP_OUT) {
    const dx = r.pos.x - cx;
    const dz = r.pos.z - cz;
    const dist = Math.hypot(dx, dz);
    if (dist < radius && dist > 1e-4) {
      const push = radius / dist;
      r.pos.x = cx + dx * push;
      r.pos.z = cz + dz * push;
    }
  }
  const limitX = ROOM.halfX - ROOM.walkInset;
  const limitZ = ROOM.halfZ - ROOM.walkInset;
  r.pos.x = THREE.MathUtils.clamp(r.pos.x, -limitX, limitX);
  r.pos.z = THREE.MathUtils.clamp(r.pos.z, -limitZ, limitZ);

  const speed = Math.hypot(r.vel.x, r.vel.z);
  if (!reducedMotion && speed > 0.25) {
    r.bobT += delta * (3.4 + speed * 2.4);
  }
  r.pos.y = EYE_HEIGHT + (reducedMotion ? 0 : Math.sin(r.bobT) * 0.024 * Math.min(1, speed));
}

const FORWARD = new THREE.Vector3();
const TO_TARGET = new THREE.Vector3();

function updateFocus(r, camera, interactables, setFocusId) {
  camera.getWorldDirection(FORWARD);
  let bestId = null;
  let bestScore = -Infinity;
  for (const item of interactables) {
    TO_TARGET.set(...item.focusPoint).sub(r.pos);
    const dist = TO_TARGET.length();
    if (dist > item.reach || dist < 1e-3) continue;
    const dot = TO_TARGET.normalize().dot(FORWARD);
    if (dot < 0.82) continue;
    const score = dot * 2 - dist * 0.2;
    if (score > bestScore) {
      bestScore = score;
      bestId = item.id;
    }
  }
  if (bestId !== r.focusId) {
    r.focusId = bestId;
    setFocusId(bestId);
  }
}

function applyCamera(camera, r) {
  camera.position.copy(r.pos);
  camera.rotation.set(r.pitch, r.yaw, 0, 'YXZ');
}
