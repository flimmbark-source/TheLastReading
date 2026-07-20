// Root of the react-three-fiber scene. Owns the Canvas, the shared runtime
// context (adapter snapshot, interactable registry, focus + tap-walk state),
// and the composition of the room, props, diegetic UI, and the player rig.
//
// Four modes share the one scene:
//   'attic'    — the interactive walkable attic
//   'rising'   — the seated table canvas standing up before attic control
//   'approach' — the run-start walk-in and sit-down cinematic
//   'table'    — the stationary hybrid reading backdrop

import { createContext, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { AtticRoom } from './AtticRoom.jsx';
import { Interactables } from './Interactables.jsx';
import { Diegetics } from './Diegetics.jsx';
import { StandingScoreCabinet } from './StandingScoreCabinet.jsx';
import { PlayerRig } from './PlayerRig.jsx';
import { applyTableAnchors, clearTableAnchors } from './tableAnchors.mjs';
import { NOTE_SPOT, DECK_SPOT, CHAIR, TABLE, PROP_STATIONS, TRUNK_SPOT } from './atticLayout.mjs';

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
  const autoWalkRef = useRef({ active: false, x: 0, z: 0 });
  const cueRef = useRef({ cue: null, at: 0, intensity: 0 });

  const reducedMotion = useMemo(() => Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches), []);

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
      action: () => sitRef.current?.(),
    });
    list.push({
      id: 'chair',
      kind: 'chair',
      name: 'Chair',
      focusPoint: [CHAIR.position[0], 0.9, CHAIR.position[2]],
      reach: 2.0,
      label: 'Sit at the table',
      action: () => sitRef.current?.(),
    });
    return list;
  }, [adapter, mode, snapshot]);

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
      registerApi,
    }),
    [adapter, mode, snapshot, interactables, focusId, hoverId, reducedMotion, onFirstMove, onSequenceComplete, registerApi],
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
        <PlayerRig key={rigKey} />
        {(mode === 'table' || mode === 'rising') && (
          <TableAnchorProjector onReady={onTableReady} continuous={mode === 'rising'} />
        )}
      </AtticContext.Provider>
    </Canvas>
  );
}
