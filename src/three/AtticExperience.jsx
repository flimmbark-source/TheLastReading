// Root of the react-three-fiber attic. Owns the Canvas, the shared runtime
// context (adapter snapshot, interactable registry, focus state), and the
// composition of the room, props, diegetic UI, and the first-person rig.

import { createContext, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { AtticRoom } from './AtticRoom.jsx';
import { Interactables } from './Interactables.jsx';
import { Diegetics } from './Diegetics.jsx';
import { PlayerRig } from './PlayerRig.jsx';
import { NOTE_SPOT, DECK_SPOT, CHAIR, PROP_STATIONS } from './atticLayout.mjs';

export const AtticContext = createContext(null);

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
  let noteFound = false;
  try {
    noteFound = adapter.foundItemIds().includes(adapter.note.itemId);
  } catch {
    noteFound = false;
  }
  return {
    searched: PROP_STATIONS.map(station => adapter.isSearched(station.id)),
    noteFound,
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

export function AtticExperience({ adapter, onFirstMove, registerApi }) {
  const snapshot = useAdapterSnapshot(adapter);
  const [focusId, setFocusId] = useState(null);
  const sitRef = useRef(null); // PlayerRig registers its beginSit here

  const reducedMotion = useMemo(() => Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches), []);

  const interactables = useMemo(() => {
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
      id: 'chair',
      kind: 'chair',
      focusPoint: [CHAIR.position[0], 0.9, CHAIR.position[2]],
      reach: 2.0,
      label: 'Sit at the table',
      action: () => sitRef.current?.(),
    });
    return list;
  }, [adapter, snapshot]);

  const context = useMemo(
    () => ({
      adapter,
      snapshot,
      interactables,
      focusId,
      setFocusId,
      sitRef,
      reducedMotion,
      onFirstMove,
      registerApi,
    }),
    [adapter, snapshot, interactables, focusId, reducedMotion, onFirstMove, registerApi],
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
        <fog attach="fog" args={['#140b06', 6.5, 14.5]} />
        <hemisphereLight args={['#2b3b58', '#3a2413', 0.8]} />
        <ambientLight color="#8a6a4a" intensity={0.34} />
        {/* soft warm fill from the rafters so the room silhouettes read */}
        <pointLight position={[0, 2.5, 0.5]} color="#c08a4e" intensity={0.85} distance={10} decay={1.9} />
        <AtticRoom />
        <Interactables />
        <Diegetics />
        <PlayerRig />
      </AtticContext.Provider>
    </Canvas>
  );
}
