// Interactive stations: the three rummage props, sticky note, deck box,
// player-facing name/action label, and the tap-walk destination marker.

import { Component, Suspense, useContext, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useFrame, useLoader, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { AtticContext } from './AtticExperience.jsx';
import { PROP_STATIONS, NOTE_SPOT, DECK_SPOT, TABLE, CHAIR, TRUNK_SPOT } from './atticLayout.mjs';
import { radialGlowTexture, ringTexture } from './canvasTextures.mjs';

class StationBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error) {
    console.warn('The Last Reading: 3D attic prop failed to load.', error);
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

function useGlowTexture() {
  return useMemo(() => radialGlowTexture('rgba(255,214,128,0.75)', 'rgba(200,150,70,0.28)'), []);
}

function Glow({ position, scale = 1.4, speed = 1 }) {
  const texture = useGlowTexture();
  const ref = useRef();
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const pulse = 0.5 + 0.24 * Math.sin(clock.elapsedTime * 2.1 * speed);
    ref.current.material.opacity = pulse;
  });
  return (
    <sprite ref={ref} position={position} scale={[scale, scale, 1]}>
      <spriteMaterial map={texture} transparent opacity={0.5} depthWrite={false} blending={THREE.AdditiveBlending} />
    </sprite>
  );
}

function walkToInteractable(id, focusPoint) {
  const api = window.__tlrAttic3d?.api;
  if (!api?.walkTo || !focusPoint) return;
  api.walkTo(focusPoint[0], focusPoint[2], id);
}

function hoverHandlers(id, setHoverId, enabled, focusPoint = null) {
  if (!enabled) return {};
  return {
    onPointerOver: event => {
      event.stopPropagation();
      setHoverId(id);
    },
    onPointerOut: event => {
      event.stopPropagation();
      setHoverId(current => (current === id ? null : current));
    },
    onClick: event => {
      event.stopPropagation();
      walkToInteractable(id, focusPoint);
    },
  };
}

function PropArt({ station, searched, prop, hover }) {
  const beforeTexture = useLoader(THREE.TextureLoader, `/${prop.before}`);
  const afterTexture = useLoader(THREE.TextureLoader, `/${prop.after}`);
  beforeTexture.colorSpace = THREE.SRGBColorSpace;
  afterTexture.colorSpace = THREE.SRGBColorSpace;
  const texture = searched ? afterTexture : beforeTexture;
  return (
    <group position={station.position} rotation={[0, station.rotationY, 0]} {...hover}>
      <mesh>
        <planeGeometry args={station.size} />
        <meshLambertMaterial map={texture} transparent alphaTest={0.3} side={THREE.DoubleSide} />
      </mesh>
      {!searched && <Glow position={[0, -station.size[1] * 0.1, 0.12]} scale={station.size[0] * 1.5} />}
    </group>
  );
}

function NoteOnTable({ found, hover }) {
  if (found) return null;
  return (
    <group position={NOTE_SPOT.position} {...hover}>
      <mesh rotation={[-Math.PI / 2, 0, 0.4]}>
        <planeGeometry args={[0.16, 0.16]} />
        <meshLambertMaterial color="#e8d998" emissive="#5a4a1c" side={THREE.DoubleSide} />
      </mesh>
      <Glow position={[0, 0.08, 0]} scale={0.5} speed={1.5} />
    </group>
  );
}

function DeckBox({ hover }) {
  return (
    <group position={[DECK_SPOT.position[0], 0.72, DECK_SPOT.position[2]]} rotation={[0, 0.45, 0]} {...hover}>
      <mesh>
        <boxGeometry args={[0.24, 0.1, 0.34]} />
        <meshLambertMaterial color="#27354e" />
      </mesh>
      <mesh position={[0, 0.051, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.2, 0.3]} />
        <meshLambertMaterial color="#3d5378" emissive="#141d30" />
      </mesh>
      <Glow position={[0, 0.16, 0]} scale={0.55} speed={0.8} />
    </group>
  );
}

function HitMaterial() {
  return <meshBasicMaterial transparent opacity={0.001} depthWrite={false} colorWrite={false} />;
}

function RoomHitVolumes({ interactive, setHoverId }) {
  if (!interactive) return null;
  const tableFocus = [TABLE.position[0], TABLE.topY, TABLE.position[2] + 0.55];
  const chairFocus = [CHAIR.position[0], 0.9, CHAIR.position[2]];
  return (
    <group>
      <mesh
        position={[TABLE.position[0], TABLE.topY, TABLE.position[2]]}
        {...hoverHandlers('reading_table', setHoverId, true, tableFocus)}
      >
        <cylinderGeometry args={[TABLE.radius, TABLE.radius, 0.16, 18]} />
        <HitMaterial />
      </mesh>
      <mesh
        position={[CHAIR.position[0], 0.68, CHAIR.position[2]]}
        rotation={[0, CHAIR.facing, 0]}
        {...hoverHandlers('chair', setHoverId, true, chairFocus)}
      >
        <boxGeometry args={[0.62, 1.1, 0.62]} />
        <HitMaterial />
      </mesh>
      <mesh
        position={[TRUNK_SPOT.position[0], 0.36, TRUNK_SPOT.position[2]]}
        rotation={[0, TRUNK_SPOT.rotationY, 0]}
        {...hoverHandlers('archives_trunk', setHoverId, true, TRUNK_SPOT.focusPoint)}
      >
        <boxGeometry args={[1.25, 0.78, 0.78]} />
        <HitMaterial />
      </mesh>
    </group>
  );
}

function PlayerPrompt() {
  const { interactables, focusId, hoverId } = useContext(AtticContext);
  const { camera, gl } = useThree();
  const ref = useRef();
  const sceneElement = document.getElementById('atticScene');
  const target = interactables.find(item => item.id === (hoverId || focusId)) || null;
  const actionable = Boolean(target && focusId === target.id);
  const coarse = useMemo(() => Boolean(window.matchMedia?.('(pointer: coarse)')?.matches), []);
  const projected = useMemo(() => new THREE.Vector3(), []);

  useFrame(() => {
    const element = ref.current;
    if (!element || !target || !sceneElement) return;
    projected.set(...target.focusPoint).project(camera);
    if (projected.z >= 1 || projected.z <= -1) {
      element.style.visibility = 'hidden';
      return;
    }

    const canvasRect = gl.domElement.getBoundingClientRect();
    const sceneRect = sceneElement.getBoundingClientRect();
    const x = canvasRect.left - sceneRect.left + ((projected.x + 1) / 2) * canvasRect.width;
    const y = canvasRect.top - sceneRect.top + ((1 - projected.y) / 2) * canvasRect.height;
    const width = element.offsetWidth || 150;
    const height = element.offsetHeight || 48;
    const margin = 10;
    const left = THREE.MathUtils.clamp(x - width / 2, margin, Math.max(margin, sceneRect.width - width - margin));
    let top = y - height - 18;
    if (top < margin) top = y + 18;
    top = THREE.MathUtils.clamp(top, margin, Math.max(margin, sceneRect.height - height - margin));
    element.style.left = `${left.toFixed(1)}px`;
    element.style.top = `${top.toFixed(1)}px`;
    element.style.visibility = 'visible';
  });

  if (!target || !sceneElement) return null;
  return createPortal(
    <div ref={ref} className={`attic3d-item-label${actionable ? ' actionable' : ''}`} aria-hidden="true">
      <b>{target.name || target.label}</b>
      {actionable && <span>{coarse ? target.label : `${target.label} · E`}</span>}
    </div>,
    sceneElement,
  );
}

function WalkMarker() {
  const { autoWalkRef } = useContext(AtticContext);
  const texture = useMemo(() => ringTexture(), []);
  const ref = useRef();
  useFrame(({ clock }) => {
    const mesh = ref.current;
    const walk = autoWalkRef?.current;
    if (!mesh) return;
    if (!walk?.active) {
      mesh.visible = false;
      return;
    }
    mesh.visible = true;
    mesh.position.set(walk.x, 0.03, walk.z);
    const pulse = 1 + 0.12 * Math.sin(clock.elapsedTime * 5.2);
    mesh.scale.set(pulse, pulse, 1);
    mesh.material.opacity = 0.55 + 0.25 * Math.sin(clock.elapsedTime * 5.2);
  });
  return (
    <mesh ref={ref} visible={false} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[0.52, 0.52]} />
      <meshBasicMaterial map={texture} transparent depthWrite={false} blending={THREE.AdditiveBlending} />
    </mesh>
  );
}

export function Interactables() {
  const { adapter, mode, snapshot, setHoverId } = useContext(AtticContext);
  const interactive = mode === 'attic';

  useEffect(() => () => setHoverId(null), [setHoverId]);

  return (
    <group>
      {PROP_STATIONS.map((station, index) => {
        const prop = adapter.objects[station.id];
        if (!prop) return null;
        return (
          <StationBoundary key={station.id}>
            <Suspense fallback={null}>
              <PropArt
                station={station}
                searched={Boolean(snapshot.searched[index])}
                prop={prop}
                hover={hoverHandlers(
                  station.id,
                  setHoverId,
                  interactive && !snapshot.searched[index],
                  station.focusPoint,
                )}
              />
            </Suspense>
          </StationBoundary>
        );
      })}
      {mode !== 'table' && (
        <NoteOnTable
          found={snapshot.noteFound}
          hover={hoverHandlers(
            'sticky_note_01',
            setHoverId,
            interactive && !snapshot.noteFound,
            NOTE_SPOT.focusPoint,
          )}
        />
      )}
      <DeckBox hover={hoverHandlers('deck_box', setHoverId, interactive, DECK_SPOT.focusPoint)} />
      <RoomHitVolumes interactive={interactive} setHoverId={setHoverId} />
      <PlayerPrompt />
      <WalkMarker />
    </group>
  );
}
