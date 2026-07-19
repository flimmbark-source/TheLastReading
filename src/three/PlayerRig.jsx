// First-person player rig and camera choreography.
//
// Attic mode mirrors the fiction of the visit: the rig mounts seated at the
// reading table (matching the 2D table UI the player just left), stands up
// over ~1.7s, hands over free-walk control, and — when the player sits back
// down at the chair — plays the reverse move and only then calls
// adapter.leave(), which runs the existing attic->table fade and unmounts us.
//
// Approach mode (run start) instead plays the APPROACH_KEYFRAMES timeline —
// in through the attic door, up to the chair, down into the seat — then
// reports completion so the overlay can cross-fade into the 2D table UI.
// Any key or tap skips it.
//
// Movement: WASD/arrows plus tap/click-to-walk — a tap on an interactable
// walks over and uses it, a tap on open floor walks there (gold ring marks
// the destination). On touch the left 45% of the screen is also a virtual
// move stick and the rest drag-look. E (or click/tap) interacts with the
// focused station. prefers-reduced-motion skips all camera choreography.

import { useContext, useEffect, useLayoutEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { AtticContext, domSurfaceOpen } from './AtticExperience.jsx';
import { POSES, ROOM, KEEP_OUT, EYE_HEIGHT, APPROACH_KEYFRAMES } from './atticLayout.mjs';

const RISE_SECONDS = 1.7;
const SIT_SECONDS = 1.6;
const WALK_SPEED = 2.1;
const TAP_PICK_RADIUS_PX = 64;
const MOVE_KEYS = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);

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
const STANDING = poseAngles(POSES.standing);

function smooth(t) {
  return t * t * (3 - 2 * t);
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
      stick: { x: 0, y: 0 },
      pointers: new Map(),
      bobT: 0,
      focusId: null,
      sitFrom: null,
      left: false,
      firstMoveSeen: false,
      autoWalk: null, // { x, z, interactId } while walking to a tapped point
      stallT: 0,
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
    rig.current.stallT = 0;
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
    const end = poseAngles(APPROACH_KEYFRAMES[APPROACH_KEYFRAMES.length - 1]);
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
  const handleTap = (clientX, clientY) => {
    const r = rig.current;
    if (r.phase === 'approach') {
      skipApproach();
      return;
    }
    if (r.phase !== 'free') return;

    const rect = gl.domElement.getBoundingClientRect();
    const px = clientX - rect.left;
    const py = clientY - rect.top;

    // Screen-space pick over interactables (generous touch-target radius).
    let picked = null;
    const projected = new THREE.Vector3();
    for (const item of interactables) {
      projected.set(...item.focusPoint).project(camera);
      if (projected.z >= 1) continue; // behind the camera
      const sx = ((projected.x + 1) / 2) * size.width;
      const sy = ((1 - projected.y) / 2) * size.height;
      const distPx = Math.hypot(sx - px, sy - py);
      if (distPx <= TAP_PICK_RADIUS_PX && (!picked || distPx < picked.distPx)) {
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
    r.sitFrom = { pos: r.pos.clone(), yaw: r.yaw, pitch: r.pitch };
  };
  sitRef.current = beginSit;

  // ── input listeners ──
  useEffect(() => {
    if (seatedTable) return undefined; // pure backdrop: the DOM owns all input
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
      rig.current.keys.clear();
      rig.current.stick.x = 0;
      rig.current.stick.y = 0;
      rig.current.pointers.clear();
    };

    const onPointerDown = event => {
      element.setPointerCapture?.(event.pointerId);
      const isTouch = event.pointerType === 'touch';
      const stickZone = isTouch && event.clientX < window.innerWidth * 0.45;
      rig.current.pointers.set(event.pointerId, {
        mode: stickZone ? 'stick' : 'look',
        startX: event.clientX,
        startY: event.clientY,
        lastX: event.clientX,
        lastY: event.clientY,
        moved: false,
        t0: performance.now(),
      });
    };
    const onPointerMove = event => {
      const pointer = rig.current.pointers.get(event.pointerId);
      if (!pointer) return;
      const totalX = event.clientX - pointer.startX;
      const totalY = event.clientY - pointer.startY;
      if (Math.hypot(totalX, totalY) > 7) pointer.moved = true;
      if (pointer.mode === 'stick') {
        const radius = 56;
        rig.current.stick.x = THREE.MathUtils.clamp(totalX / radius, -1, 1);
        rig.current.stick.y = THREE.MathUtils.clamp(totalY / radius, -1, 1);
        if (pointer.moved) noteFirstMove();
      } else {
        const dx = event.clientX - pointer.lastX;
        const dy = event.clientY - pointer.lastY;
        if (rig.current.phase === 'free') {
          rig.current.yaw -= dx * 0.0044;
          rig.current.pitch = THREE.MathUtils.clamp(rig.current.pitch - dy * 0.0038, -1.25, 1.25);
        }
        if (pointer.moved) noteFirstMove();
      }
      pointer.lastX = event.clientX;
      pointer.lastY = event.clientY;
    };
    const onPointerEnd = event => {
      const pointer = rig.current.pointers.get(event.pointerId);
      rig.current.pointers.delete(event.pointerId);
      if (!pointer) return;
      if (pointer.mode === 'stick') {
        rig.current.stick.x = 0;
        rig.current.stick.y = 0;
      }
      // A clean short press in either zone is a tap: use/walk to what was
      // pressed (or skip the approach).
      if (!pointer.moved && performance.now() - pointer.t0 < 350) {
        tapRef.current(event.clientX, event.clientY);
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
  }, [gl]);

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
      tapAt: (clientX, clientY) => tapRef.current(clientX, clientY),
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
      const sample = sampleKeyframes(APPROACH_KEYFRAMES, r.phaseT);
      r.pos.copy(sample.eye);
      r.yaw = sample.yaw;
      r.pitch = sample.pitch;
      // Head-bob only while walking; fade it out approaching the chair.
      const standT = APPROACH_KEYFRAMES[APPROACH_KEYFRAMES.length - 2].t;
      const amp = 0.02 * THREE.MathUtils.clamp((standT - r.phaseT) / 0.45, 0, 1);
      if (!reducedMotion && amp > 0) {
        r.bobT += delta * 5.4;
        r.pos.y += Math.sin(r.bobT) * amp;
      }
      if (r.phaseT >= APPROACH_KEYFRAMES[APPROACH_KEYFRAMES.length - 1].t + 0.05) {
        r.phase = 'done';
        completeSequence();
      }
    } else if (r.phase === 'rising') {
      r.phaseT += delta / RISE_SECONDS;
      const t = smooth(Math.min(1, r.phaseT));
      r.pos.lerpVectors(SEATED.eye, STANDING.eye, t);
      r.yaw = THREE.MathUtils.lerp(SEATED.yaw, STANDING.yaw, t);
      r.pitch = THREE.MathUtils.lerp(SEATED.pitch, STANDING.pitch, t);
      if (r.phaseT >= 1) r.phase = 'free';
    } else if (r.phase === 'free') {
      stepMovement(r, delta, reducedMotion, interactables, setFocusId, setAutoWalk);
      updateFocus(r, camera, interactables, setFocusId);
    } else if (r.phase === 'sitting') {
      r.phaseT += delta / SIT_SECONDS;
      const t = Math.min(1, r.phaseT);
      if (t < 0.55) {
        const k = smooth(t / 0.55);
        r.pos.lerpVectors(r.sitFrom.pos, STANDING.eye, k);
        r.yaw = lerpAngle(r.sitFrom.yaw, STANDING.yaw, k);
        r.pitch = THREE.MathUtils.lerp(r.sitFrom.pitch, STANDING.pitch, k);
      } else {
        const k = smooth((t - 0.55) / 0.45);
        r.pos.lerpVectors(STANDING.eye, SEATED.eye, k);
        r.yaw = lerpAngle(STANDING.yaw, SEATED.yaw, k);
        r.pitch = THREE.MathUtils.lerp(STANDING.pitch, SEATED.pitch, k);
      }
      if (t >= 1) {
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
  let forward = 0;
  let strafe = 0;
  if (r.keys.has('KeyW') || r.keys.has('ArrowUp')) forward += 1;
  if (r.keys.has('KeyS') || r.keys.has('ArrowDown')) forward -= 1;
  if (r.keys.has('KeyD') || r.keys.has('ArrowRight')) strafe += 1;
  if (r.keys.has('KeyA') || r.keys.has('ArrowLeft')) strafe -= 1;
  forward += -r.stick.y;
  strafe += r.stick.x;
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
        // Turn to face the direction of travel unless the player is
        // actively drag-looking.
        let looking = false;
        for (const pointer of r.pointers.values()) if (pointer.mode === 'look' && pointer.moved) looking = true;
        if (!looking) {
          const walkYaw = Math.atan2(-dx / dist, -dz / dist);
          r.yaw = lerpAngle(r.yaw, walkYaw, 1 - Math.exp(-delta * 5));
        }
        // Bail out if clutter has us pinned short of the destination.
        const speedNow = Math.hypot(r.vel.x, r.vel.z);
        r.stallT = speedNow < 0.18 ? r.stallT + delta : 0;
        if (r.stallT > 0.8) setAutoWalk(null);
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
