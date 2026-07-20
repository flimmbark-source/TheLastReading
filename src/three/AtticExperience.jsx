// Root of the react-three-fiber scene. Owns the Canvas, the shared runtime
// context (adapter snapshot, interactable registry, focus + tap-walk state),
// and the composition of the room, props, diegetic UI, and the player rig.
//
// Four modes share the one scene:
//   'attic'    — the interactive walkable attic
//   'rising'   — the seated table canvas standing up before attic control
//   'approach' — the run-start walk-in and sit-down cinematic
//   'table'    — the stationary hybrid reading backdrop

import { createContext, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { AtticRoom } from './AtticRoom.jsx';
import { Interactables } from './Interactables.jsx';
import { Diegetics, QuietBoundary } from './Diegetics.jsx';
import { StandingScoreCabinet } from './StandingScoreCabinet.jsx';
import { TableSpread } from './TableSpread.jsx';
import { PlayerRig } from './PlayerRig.jsx';
import { applyTableAnchors, clearTableAnchors } from './tableAnchors.mjs';
import { NOTE_SPOT, DECK_SPOT, CHAIR, TABLE, POSES, PROP_STATIONS, TRUNK_SPOT } from './atticLayout.mjs';

export const AtticContext = createContext(null);

function CueListener({ cueRef }) {
  useEffect(() => {
    const onCue = event => {
      cueRef.current = {
        cue: event.detail?.cue || null,
        at: performance.now(),
        intensity: Number(event.detail?.payload?.intensity) || 0.5,
      };
    };
    window.addEventListener('tlr:presentation-cue', onCue);
    return () => window.removeEventListener('tlr:presentation-cue', onCue);
  }, [cueRef]);
  return null;
}

export function cueEnergy(cueRef, names, span = 900) {
  const current = cueRef?.current;
  if (!current?.cue || !names.includes(current.cue)) return 0;
  const age = performance.now() - current.at;
  if (age < 0 || age >= span) return 0;
  return (1 - age / span) * (0.5 + 0.5 * Math.min(1, current.intensity * 1.4));
}

function useAdapterSnapshot(adapter) {
  const [snapshot, setSnapshot] = useState(() => readSnapshot(adapter));
  const lastRef = useRef(JSON.stringify(snapshot));
  useEffect(() => {
    const tick = () => {
      const next = readSnapshot(adapter);
      const key = JSON.stringify(next);
      if (key !== lastRef.current) {
        lastRef.current = key;
        setSnapshot(next);
      }
    };
    const timer = setInterval(tick, 350);
    return () => clearInterval(timer);
  }, [adapter]);
  return snapshot;
}

function readSnapshot(adapter) {
  let found = [];
  try {
    found = adapter.foundItemIds() || [];
  } catch {
    found = [];
  }
  return {
    searched: PROP_STATIONS.map(station => {
      const prop = adapter.objects[station.id];
      return adapter.isSearched(station.id) || Boolean(prop && found.includes(prop.itemId));
    }),
    noteFound: found.includes(adapter.note.itemId),
  };
}

export function domSurfaceOpen() {
  return Boolean(
    document.getElementById('atticPickup') ||
    document.getElementById('modal')?.classList.contains('show') ||
    document.getElementById('atticTutorial')?.classList.contains('show'),
  );
}

function TableAnchorProjector({ onReady, continuous = false }) {
  const { camera, size } = useThree();
  const firstFrameApplied = useRef(false);
  const readySent = useRef(false);

  useEffect(() => {
    document.body.classList.add('table3d-settling');
    return () => document.body.classList.remove('table3d-settling');
  }, []);

  useEffect(() => {
    firstFrameApplied.current = false;
  }, [camera, size.width, size.height]);

  useFrame(() => {
    if (continuous) {
      applyTableAnchors(camera, size);
      return;
    }
    if (firstFrameApplied.current) return;
    firstFrameApplied.current = true;
    applyTableAnchors(camera, size);
  });

  useEffect(() => {
    let cancelled = false;
    let finalFrame = 0;
    const timers = [];
    const apply = () => {
      if (!cancelled) applyTableAnchors(camera, size);
    };
    const announceReady = () => {
      if (cancelled || readySent.current) return;
      applyTableAnchors(camera, size);
      readySent.current = true;
      document.body.classList.remove('table3d-settling');
      window.dispatchEvent(new CustomEvent('tlr:table3d-ready'));
      onReady?.();
    };

    timers.push(setTimeout(apply, 160));
    timers.push(setTimeout(apply, 440));
    timers.push(setTimeout(() => {
      apply();
      finalFrame = requestAnimationFrame(() => requestAnimationFrame(announceReady));
    }, 820));

    window.__tlrT3dReproject = apply;
    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
      if (finalFrame) cancelAnimationFrame(finalFrame);
      delete window.__tlrT3dReproject;
    };
  }, [camera, size, onReady]);

  useEffect(() => () => clearTableAnchors(), []);
  return null;
}

function FovTuner({ mode }) {
  const { camera, size } = useThree();
  useEffect(() => {
    const portrait = size.width < size.height;
    const tableLike = mode === 'table' || mode === 'rising';
    const fov = portrait ? (tableLike ? 64 : 74) : 62;
    if (camera.fov !== fov) {
      camera.fov = fov;
      camera.updateProjectionMatrix();
    }
  }, [camera, size.width, size.height, mode]);
  return null;
}

function poseFacing(pose) {
  const [eyeX, eyeY, eyeZ] = pose.eye;
  const dx = pose.look[0] - eyeX;
  const dy = pose.look[1] - eyeY;
  const dz = pose.look[2] - eyeZ;
  const length = Math.max(Math.hypot(dx, dy, dz), 1e-4);
  return {
    x: eyeX,
    z: eyeZ,
    yaw: Math.atan2(-dx, -dz),
    pitch: Math.asin(Math.max(-1, Math.min(1, dy / length))),
  };
}

function smoothStep(t) {
  return t * t * (3 - 2 * t);
}

function lerpAngle(a, b, t) {
  let difference = (b - a) % (Math.PI * 2);
  if (difference > Math.PI) difference -= Math.PI * 2;
  if (difference < -Math.PI) difference += Math.PI * 2;
  return a + difference * t;
}

const STANDING_RETURN_POSE = poseFacing(POSES.standing);
const SIT_ALIGN_MS = 280;
const SIT_STAGE_TIMEOUT_MS = 5000;

export function AtticExperience({
  adapter,
  mode = 'attic',
  onFirstMove,
  onSequenceComplete,
  onTableReady,
  registerApi,
}) {
  const snapshot = useAdapterSnapshot(adapter);
  const [focusId, setFocusId] = useState(null);
  const [hoverId, setHoverId] = useState(null);
  const sitRef = useRef(null);
  const playerApiRef = useRef(null);
  const sitReturnRef = useRef({ active: false, frame: 0 });
  const autoWalkRef = useRef({ active: false, x: 0, z: 0 });
  const cueRef = useRef({ cue: null, at: 0, intensity: 0 });

  const reducedMotion = useMemo(() => Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches), []);

  const registerPlayerApi = useCallback(
    api => {
      playerApiRef.current = api;
      registerApi?.(api);
    },
    [registerApi],
  );

  const cancelSitReturn = useCallback(() => {
    const sequence = sitReturnRef.current;
    if (sequence.frame) cancelAnimationFrame(sequence.frame);
    sequence.active = false;
    sequence.frame = 0;
  }, []);

  useEffect(() => cancelSitReturn, [cancelSitReturn]);
  useEffect(() => {
    if (mode !== 'attic') cancelSitReturn();
  }, [cancelSitReturn, mode]);

  const sitAtTable = useCallback(() => {
    const sequence = sitReturnRef.current;
    if (sequence.active) return;

    const api = playerApiRef.current;
    const beginReverseRise = () => {
      api?.teleport?.(
        STANDING_RETURN_POSE.x,
        STANDING_RETURN_POSE.z,
        STANDING_RETURN_POSE.yaw,
        STANDING_RETURN_POSE.pitch,
      );
      sequence.active = false;
      sequence.frame = 0;
      sitRef.current?.();
    };

    if (!api?.getState || !api?.walkTo || !api?.teleport) {
      beginReverseRise();
      return;
    }

    // Chair hit-testing is intentionally generous, but the reverse rise must
    // start from one exact camera pose. Finish the walk to that floor mark,
    // turn toward the table, then hand control to PlayerRig's 1.7s
    // STANDING -> SEATED animation. That keeps the return smooth and makes the
    // seated transition the literal inverse of getting up.
    sequence.active = true;
    let stageStartedAt = 0;

    const alignAndSit = state => {
      const alignStartedAt = performance.now();
      const startYaw = Number(state?.yaw) || 0;
      const startPitch = Number(state?.pitch) || 0;
      const align = now => {
        if (!sequence.active) return;
        const t = smoothStep(Math.min(1, (now - alignStartedAt) / SIT_ALIGN_MS));
        api.teleport(
          STANDING_RETURN_POSE.x,
          STANDING_RETURN_POSE.z,
          lerpAngle(startYaw, STANDING_RETURN_POSE.yaw, t),
          startPitch + (STANDING_RETURN_POSE.pitch - startPitch) * t,
        );
        if (t >= 1) {
          beginReverseRise();
          return;
        }
        sequence.frame = requestAnimationFrame(align);
      };
      sequence.frame = requestAnimationFrame(align);
    };

    const waitForStage = () => {
      if (!sequence.active) return;
      const state = api.getState();
      if (!state || state.phase !== 'free') {
        cancelSitReturn();
        return;
      }
      const distance = Math.hypot(
        state.position[0] - STANDING_RETURN_POSE.x,
        state.position[2] - STANDING_RETURN_POSE.z,
      );
      const elapsed = performance.now() - stageStartedAt;
      if (distance <= 0.18 || (!state.autoWalk && elapsed > 900) || elapsed >= SIT_STAGE_TIMEOUT_MS) {
        alignAndSit(state);
        return;
      }
      sequence.frame = requestAnimationFrame(waitForStage);
    };

    // An interactable action can run inside PlayerRig's movement frame. Starting
    // a replacement walk immediately there lets the old walk's cleanup cancel
    // the new one. Defer one frame so the chair-arrival frame finishes first.
    const beginStage = () => {
      if (!sequence.active) return;
      stageStartedAt = performance.now();
      api.walkTo(STANDING_RETURN_POSE.x, STANDING_RETURN_POSE.z, null);
      sequence.frame = requestAnimationFrame(waitForStage);
    };
    sequence.frame = requestAnimationFrame(beginStage);
  }, [cancelSitReturn]);

  const interactables = useMemo(() => {
    if (mode !== 'attic') return [];
    const list = [];
    PROP_STATIONS.forEach((station, index) => {
      if (snapshot.searched[index]) return;
      const prop = adapter.objects[station.id];
      if (!prop) return;
      list.push({
        id: station.id,
        kind: 'prop',
        name: prop.label,
        focusPoint: station.focusPoint,
        reach: 2.5,
        label: prop.verb,
        action: () => adapter.rummage(station.id),
      });
    });
    if (!snapshot.noteFound) {
      list.push({
        id: 'sticky_note_01',
        kind: 'note',
        name: adapter.note.itemTitle || 'Note on the Table',
        focusPoint: NOTE_SPOT.focusPoint,
        reach: 1.7,
        label: 'Read the note',
        action: () => adapter.collectNote(),
      });
    }
    list.push({
      id: 'deck_box',
      kind: 'deck',
      name: 'Tarot Deck',
      focusPoint: DECK_SPOT.focusPoint,
      reach: 2.4,
      label: 'Browse the deck',
      action: () => adapter.browseDeck(),
    });
    list.push({
      id: 'archives_trunk',
      kind: 'archives',
      name: 'Archives Trunk',
      focusPoint: TRUNK_SPOT.focusPoint,
      reach: 2.2,
      label: 'Open the archives',
      action: () => adapter.openArchives?.(),
    });
    list.push({
      id: 'reading_table',
      kind: 'chair',
      name: 'Reading Table',
      focusPoint: [TABLE.position[0], TABLE.topY, TABLE.position[2] + 0.55],
      reach: 1.9,
      label: 'Sit at the table',
      action: sitAtTable,
    });
    list.push({
      id: 'chair',
      kind: 'chair',
      name: 'Chair',
      focusPoint: [CHAIR.position[0], 0.9, CHAIR.position[2]],
      reach: 2.0,
      label: 'Sit at the table',
      action: sitAtTable,
    });
    return list;
  }, [adapter, mode, sitAtTable, snapshot]);

  const context = useMemo(
    () => ({
      adapter,
      mode,
      snapshot,
      interactables,
      focusId,
      setFocusId,
      hoverId,
      setHoverId,
      sitRef,
      autoWalkRef,
      cueRef,
      reducedMotion,
      onFirstMove,
      onSequenceComplete,
      registerApi: registerPlayerApi,
    }),
    [
      adapter,
      mode,
      snapshot,
      interactables,
      focusId,
      hoverId,
      reducedMotion,
      onFirstMove,
      onSequenceComplete,
      registerPlayerApi,
    ],
  );

  // Table -> rising remounts only the first-person rig, not the Canvas or room.
  // Rising -> attic keeps that rig alive so the camera hands directly to input.
  const rigKey = mode === 'table' ? 'table' : mode === 'approach' ? 'approach' : 'attic';

  return (
    <Canvas
      flat
      shadows={false}
      dpr={[1, 1.5]}
      gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
      camera={{ fov: 62, near: 0.05, far: 60 }}
      onCreated={({ gl }) => gl.setClearColor('#0d0703')}
    >
      <AtticContext.Provider value={context}>
        <FovTuner mode={mode} />
        <CueListener cueRef={cueRef} />
        <fog attach="fog" args={['#140b06', 7.5, 16]} />
        <hemisphereLight args={['#2b3b58', '#3a2413', 1.05]} />
        <ambientLight color="#8a6a4a" intensity={0.52} />
        <pointLight position={[0, 2.5, 0.5]} color="#c08a4e" intensity={1.05} distance={12} decay={1.7} />
        <AtticRoom />
        <Interactables />
        <Diegetics />
        {(mode === 'rising' || mode === 'attic') && <StandingScoreCabinet />}
        {(mode === 'rising' || mode === 'attic') && (
          <QuietBoundary>
            <TableSpread />
          </QuietBoundary>
        )}
        <PlayerRig key={rigKey} />
        {(mode === 'table' || mode === 'rising') && (
          <TableAnchorProjector onReady={onTableReady} continuous={mode === 'rising'} />
        )}
      </AtticContext.Provider>
    </Canvas>
  );
}
