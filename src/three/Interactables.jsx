// Interactive stations: the three rummage props (reusing the 2D attic's PNG
// art on planes), the sticky note on the table, the deck box, and the floating
// diegetic prompt that appears over whatever the player is looking at.

import { Component, Suspense, useContext, useMemo, useRef } from 'react';
import { useFrame, useLoader } from '@react-three/fiber';
import * as THREE from 'three';
import { AtticContext } from './AtticExperience.jsx';
import { PROP_STATIONS, NOTE_SPOT, DECK_SPOT } from './atticLayout.mjs';
import { promptTexture, radialGlowTexture, ringTexture } from './canvasTextures.mjs';

// A texture that fails to load must cost us that one prop, not the whole
// canvas — the classic 2D attic already proved the art paths, but stay safe.
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

function PropArt({ station, searched, prop }) {
  const beforeTexture = useLoader(THREE.TextureLoader, `/${prop.before}`);
  const afterTexture = useLoader(THREE.TextureLoader, `/${prop.after}`);
  beforeTexture.colorSpace = THREE.SRGBColorSpace;
  afterTexture.colorSpace = THREE.SRGBColorSpace;
  const texture = searched ? afterTexture : beforeTexture;
  return (
    <group position={station.position} rotation={[0, station.rotationY, 0]}>
      <mesh>
        <planeGeometry args={station.size} />
        <meshLambertMaterial map={texture} transparent alphaTest={0.3} side={THREE.DoubleSide} />
      </mesh>
      {!searched && <Glow position={[0, -station.size[1] * 0.1, 0.12]} scale={station.size[0] * 1.5} />}
    </group>
  );
}

function NoteOnTable({ found }) {
  if (found) return null;
  return (
    <group position={NOTE_SPOT.position}>
      <mesh rotation={[-Math.PI / 2, 0, 0.4]}>
        <planeGeometry args={[0.16, 0.16]} />
        <meshLambertMaterial color="#e8d998" emissive="#5a4a1c" side={THREE.DoubleSide} />
      </mesh>
      <Glow position={[0, 0.08, 0]} scale={0.5} speed={1.5} />
    </group>
  );
}

function DeckBox() {
  return (
    <group position={[DECK_SPOT.position[0], 0.72, DECK_SPOT.position[2]]} rotation={[0, 0.45, 0]}>
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

// Floating label over the focused interactable. Text is a cached canvas
// texture; position eases toward the target so focus changes feel physical.
function FocusPrompt() {
  const { interactables, focusId } = useContext(AtticContext);
  const ref = useRef();
  const target = interactables.find(item => item.id === focusId) || null;
  const coarse = useMemo(() => Boolean(window.matchMedia?.('(pointer: coarse)')?.matches), []);
  const texture = target ? promptTexture(coarse ? target.label : `${target.label}  ·  E`) : null;
  useFrame(({ clock }) => {
    if (!ref.current || !target) return;
    const [x, y, z] = target.focusPoint;
    const bob = 0.025 * Math.sin(clock.elapsedTime * 2.4);
    ref.current.position.set(x, y + 0.62 + bob, z);
  });
  if (!target || !texture) return null;
  const aspect = texture.image.width / texture.image.height;
  const height = 0.19;
  return (
    <sprite
      ref={ref}
      position={[target.focusPoint[0], target.focusPoint[1] + 0.62, target.focusPoint[2]]}
      scale={[height * aspect, height, 1]}
    >
      <spriteMaterial map={texture} transparent depthWrite={false} depthTest={false} />
    </sprite>
  );
}

// Gold ring on the floor marking an in-flight tap-to-walk destination.
// PlayerRig writes the shared ref every time a walk starts/ends; reading it
// per-frame here keeps the marker out of React state entirely.
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

// Prop art, note, and deck render in both modes (they are the room's set
// dressing); the focus prompt and walk marker self-hide while the approach
// cinematic plays because focus/auto-walk never engage there.
export function Interactables() {
  const { adapter, mode, snapshot } = useContext(AtticContext);
  return (
    <group>
      {PROP_STATIONS.map((station, index) => {
        const prop = adapter.objects[station.id];
        if (!prop) return null;
        return (
          <StationBoundary key={station.id}>
            <Suspense fallback={null}>
              <PropArt station={station} searched={Boolean(snapshot.searched[index])} prop={prop} />
            </Suspense>
          </StationBoundary>
        );
      })}
      {/* the note sits where the DOM spread lives in seated-table mode */}
      {mode !== 'table' && <NoteOnTable found={snapshot.noteFound} />}
      <DeckBox />
      <FocusPrompt />
      <WalkMarker />
    </group>
  );
}
