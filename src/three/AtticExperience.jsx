// Root of the react-three-fiber scene. Owns the Canvas, the shared runtime
// context (adapter snapshot, interactable registry, focus + tap-walk state),
// and the composition of the room, props, diegetic UI, and the player rig.
//
// Two modes share the one scene:
//   'attic'    — the interactive walkable attic (mounted by atticFlow)
//   'approach' — the run-start cinematic: walk in from the door, sit at the
//                table, hand off to the 2D table UI (mounted by
//                tableApproachFlow). No interactables, timeline camera.

import { createContext, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { AtticRoom } from './AtticRoom.jsx';
import { Interactables } from './Interactables.jsx';
import { Diegetics } from './Diegetics.jsx';
import { PlayerRig } from './PlayerRig.jsx';
import { applyTableAnchors, clearTableAnchors } from './tableAnchors.mjs';
import { NOTE_SPOT, DECK_SPOT, CHAIR, PROP_STATIONS, TRUNK_SPOT } from './atticLayout.mjs';

export const AtticContext = createContext(null);

// ── presentation-cue bridge ──────────────────────────────────────────────
// The presentation director broadcasts tlr:presentation-cue window events
// (card placements, pattern resolves, threshold clears). While a 3D scene is
// mounted, the latest cue lands in a shared ref and light/effect components
// convert it into short mood surges — the same event contract
// tableCameraDirector.mjs consumes for the 2D table. During the run-start
// approach these fire from the table booting underneath, so the room
// flickers in answer to the shuffle.
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

// 0..1 decaying energy for the most recent cue if it matches `names`.
export function cueEnergy(cueRef, names, span = 900) {
  const current = cueRef?.current;
  if (!current?.cue || !names.includes(current.cue)) return 0;
  const age = performance.now() - current.at;
  if (age < 0 || age >= span) return 0;
  return (1 - age / span) * (0.5 + 0.5 * Math.min(1, current.intensity * 1.4));
}

// The 2D attic flow owns all real state (searched props, pickups, archive
// unlocks). Poll the few bits the 3D view mirrors instead of patching hooks
// into the legacy module: three flags every ~1/3 second is cheaper than the
// coupling would be.
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
    // A prop counts as searched if it was rummaged this visit OR its item was
    // taken on an earlier visit — matching the 2D attic's "done" rendering.
    searched: PROP_STATIONS.map(station => {
      const prop = adapter.objects[station.id];
      return adapter.isSearched(station.id) || Boolean(prop && found.includes(prop.itemId));
    }),
    noteFound: found.includes(adapter.note.itemId),
  };
}

// Interaction must pause while a DOM surface (pickup card, deck browser,
// tutorial) sits over the canvas; checked live at interact time.
export function domSurfaceOpen() {
  return Boolean(
    document.getElementById('atticPickup') ||
    document.getElementById('modal')?.classList.contains('show') ||
    document.getElementById('atticTutorial')?.classList.contains('show'),
  );
}

// Hybrid seated-table mode: after the camera settles each frame, project the
// named table anchors into CSS variables exactly once per mount/resize (the
// seated camera is stationary, so per-frame writes would be pure waste). A
// couple of delayed re-applies catch the SPv2 layout settling (first deal,
// font load) since the scales divide by DOM layout measurements.
function TableAnchorProjector() {
  const { camera, size } = useThree();
  const appliedRef = useRef(false);
  useEffect(() => {
    appliedRef.current = false;
  }, [camera, size.width, size.height]);
  useFrame(() => {
    if (appliedRef.current) return;
    appliedRef.current = true; // PlayerRig has already posed the camera this frame
    applyTableAnchors(camera, size);
  });
  useEffect(() => {
    const timers = [
      setTimeout(() => applyTableAnchors(camera, size), 450),
      setTimeout(() => applyTableAnchors(camera, size), 1400),
    ];
    // Debug/tuning hook: re-run the projection on demand (e.g. after
    // flipping the portrait hand-anchoring flag) without a resize.
    window.__tlrT3dReproject = () => applyTableAnchors(camera, size);
    return () => {
      timers.forEach(clearTimeout);
      delete window.__tlrT3dReproject;
    };
  }, [camera, size]);
  useEffect(() => () => clearTableAnchors(), []);
  return null;
}

// Portrait screens get a wider vertical FOV so the horizontal slice of the
// room (and the focus prompts in it) stays usable on phones.
function FovTuner() {
  const { camera, size } = useThree();
  useEffect(() => {
    const fov = size.width < size.height ? 74 : 62;
    if (camera.fov !== fov) {
      camera.fov = fov;
      camera.updateProjectionMatrix();
    }
  }, [camera, size.width, size.height]);
  return null;
}

export function AtticExperience({ adapter, mode = 'attic', onFirstMove, onSequenceComplete, registerApi }) {
  const snapshot = useAdapterSnapshot(adapter);
  const [focusId, setFocusId] = useState(null);
  const sitRef = useRef(null); // PlayerRig registers its beginSit here
  const autoWalkRef = useRef({ active: false, x: 0, z: 0 }); // PlayerRig writes, WalkMarker reads
  const cueRef = useRef({ cue: null, at: 0, intensity: 0 }); // CueListener writes, mood consumers read

  const reducedMotion = useMemo(() => Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches), []);

  const interactables = useMemo(() => {
    if (mode !== 'attic') return []; // the approach is a cinematic, not a place yet
    const list = [];
    PROP_STATIONS.forEach((station, index) => {
      if (snapshot.searched[index]) return; // searched props go quiet
      const prop = adapter.objects[station.id];
      if (!prop) return;
      list.push({
        id: station.id,
        kind: 'prop',
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
        focusPoint: NOTE_SPOT.focusPoint,
        reach: 1.7, // only prompts when actually leaning over the table
        label: 'Read the note',
        action: () => adapter.collectNote(),
      });
    }
    list.push({
      id: 'deck_box',
      kind: 'deck',
      focusPoint: DECK_SPOT.focusPoint,
      reach: 2.4,
      label: 'Browse the deck',
      action: () => adapter.browseDeck(),
    });
    list.push({
      id: 'archives_trunk',
      kind: 'archives',
      focusPoint: TRUNK_SPOT.focusPoint,
      reach: 2.2,
      label: 'Open the archives',
      action: () => adapter.openArchives?.(),
    });
    list.push({
      id: 'chair',
      kind: 'chair',
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
      sitRef,
      autoWalkRef,
      cueRef,
      reducedMotion,
      onFirstMove,
      onSequenceComplete,
      registerApi,
    }),
    [adapter, mode, snapshot, interactables, focusId, reducedMotion, onFirstMove, onSequenceComplete, registerApi],
  );

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
        <FovTuner />
        <CueListener cueRef={cueRef} />
        <fog attach="fog" args={['#140b06', 6.5, 14.5]} />
        <hemisphereLight args={['#2b3b58', '#3a2413', 0.8]} />
        <ambientLight color="#8a6a4a" intensity={0.34} />
        {/* soft warm fill from the rafters so the room silhouettes read */}
        <pointLight position={[0, 2.5, 0.5]} color="#c08a4e" intensity={0.85} distance={10} decay={1.9} />
        <AtticRoom />
        <Interactables />
        <Diegetics />
        <PlayerRig />
        {mode === 'table' && <TableAnchorProjector />}
      </AtticContext.Provider>
    </Canvas>
  );
}
