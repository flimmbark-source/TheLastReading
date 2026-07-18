// First-person player rig and camera choreography.
//
// Lifecycle mirrors the fiction of the attic visit: the rig mounts seated at
// the reading table (matching the 2D table UI the player just left), stands
// up over ~1.7s, hands over free-walk control, and — when the player sits
// back down at the chair — plays the reverse move and only then calls
// adapter.leave(), which runs the existing attic->table fade and unmounts us.
//
// Input: WASD/arrows + mouse-drag look on desktop; on touch, the left 45% of
// the screen is a virtual move stick and the rest drag-look. Tap / click /
// E interacts with the focused station. prefers-reduced-motion skips both
// camera moves entirely.

import { useContext, useEffect, useLayoutEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { AtticContext, domSurfaceOpen } from './AtticExperience.jsx';
import { POSES, ROOM, KEEP_OUT, EYE_HEIGHT } from './atticLayout.mjs';

const RISE_SECONDS = 1.7;
const SIT_SECONDS = 1.6;
const WALK_SPEED = 2.1;
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

export function PlayerRig() {
  const { adapter, interactables, setFocusId, sitRef, reducedMotion, onFirstMove, registerApi } =
    useContext(AtticContext);
  const { camera, gl, scene } = useThree();

  const rig = useRef(null);
  if (!rig.current) {
    rig.current = {
      phase: reducedMotion ? 'free' : 'rising',
      phaseT: 0,
      pos: reducedMotion ? STANDING.eye.clone() : SEATED.eye.clone(),
      yaw: reducedMotion ? STANDING.yaw : SEATED.yaw,
      pitch: reducedMotion ? STANDING.pitch : SEATED.pitch,
      vel: new THREE.Vector3(),
      keys: new Set(),
      stick: { x: 0, y: 0 },
      pointers: new Map(),
      bobT: 0,
      focusId: null,
      sitFrom: null,
      left: false,
      firstMoveSeen: false,
    };
  }

  const noteFirstMove = () => {
    if (rig.current.firstMoveSeen) return;
    rig.current.firstMoveSeen = true;
    onFirstMove?.();
  };

  const interact = () => {
    const r = rig.current;
    if (r.phase !== 'free' || domSurfaceOpen()) return;
    const item = interactables.find(candidate => candidate.id === r.focusId);
    item?.action();
  };
  const interactRef = useRef(interact);
  interactRef.current = interact;

  const beginSit = () => {
    const r = rig.current;
    if (r.phase !== 'free') return;
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
    const element = gl.domElement;

    const onKeyDown = event => {
      if (/INPUT|TEXTAREA|SELECT/.test(event.target?.tagName || '')) return;
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
      } else if (!pointer.moved && performance.now() - pointer.t0 < 350) {
        interactRef.current(); // clean tap / click = interact
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
        };
      },
      teleport: (x, z, yaw = 0, pitch = 0) => {
        const r = rig.current;
        if (r.phase === 'rising') r.phase = 'free';
        r.pos.set(x, EYE_HEIGHT, z);
        r.yaw = yaw;
        r.pitch = pitch;
        r.vel.set(0, 0, 0);
      },
      interact: () => interactRef.current(),
      sit: () => beginSit(),
      // Scene inventory for the smoke script / console debugging.
      dumpScene: () => {
        const out = [];
        scene.traverse(object => {
          if (object.isMesh || object.isSprite || object.isPoints || object.isLight) {
            const p = object.getWorldPosition(new THREE.Vector3());
            out.push({
              type: object.type,
              position: [+p.x.toFixed(2), +p.y.toFixed(2), +p.z.toFixed(2)],
              visible: object.visible,
            });
          }
        });
        return out;
      },
    });
  }, [registerApi]);

  useLayoutEffect(() => {
    applyCamera(camera, rig.current, 0);
  }, [camera]);

  useFrame((_, rawDelta) => {
    const r = rig.current;
    const delta = Math.min(rawDelta, 1 / 20);

    if (r.phase === 'rising') {
      r.phaseT += delta / RISE_SECONDS;
      const t = smooth(Math.min(1, r.phaseT));
      r.pos.lerpVectors(SEATED.eye, STANDING.eye, t);
      r.yaw = THREE.MathUtils.lerp(SEATED.yaw, STANDING.yaw, t);
      r.pitch = THREE.MathUtils.lerp(SEATED.pitch, STANDING.pitch, t);
      if (r.phaseT >= 1) r.phase = 'free';
    } else if (r.phase === 'free') {
      stepMovement(r, delta, reducedMotion);
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

    applyCamera(camera, r, delta);
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

function stepMovement(r, delta, reducedMotion) {
  let forward = 0;
  let strafe = 0;
  if (r.keys.has('KeyW') || r.keys.has('ArrowUp')) forward += 1;
  if (r.keys.has('KeyS') || r.keys.has('ArrowDown')) forward -= 1;
  if (r.keys.has('KeyD') || r.keys.has('ArrowRight')) strafe += 1;
  if (r.keys.has('KeyA') || r.keys.has('ArrowLeft')) strafe -= 1;
  forward += -r.stick.y;
  strafe += r.stick.x;
  const magnitude = Math.hypot(forward, strafe);
  if (magnitude > 1) {
    forward /= magnitude;
    strafe /= magnitude;
  }

  const sinYaw = Math.sin(r.yaw);
  const cosYaw = Math.cos(r.yaw);
  const targetX = (-sinYaw * forward + cosYaw * strafe) * WALK_SPEED;
  const targetZ = (-cosYaw * forward - sinYaw * strafe) * WALK_SPEED;
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

function lerpAngle(a, b, t) {
  let difference = (b - a) % (Math.PI * 2);
  if (difference > Math.PI) difference -= Math.PI * 2;
  if (difference < -Math.PI) difference += Math.PI * 2;
  return a + difference * t;
}

function applyCamera(camera, r, _delta) {
  camera.position.copy(r.pos);
  camera.rotation.set(r.pitch, r.yaw, 0, 'YXZ');
}
