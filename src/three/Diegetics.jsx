// Diegetic UI: game state rendered as things in the room instead of HUD chrome.
// The candle shelf is the obal counter — one lit candle per obal, read live
// from the architecture store through useTlrStore. Dust motes drift through
// the moonlight using the existing fx/dust_mote_particle.png sprite.

import { Component, Suspense, useContext, useMemo, useRef } from 'react';
import { useFrame, useLoader } from '@react-three/fiber';
import * as THREE from 'three';
import { AtticContext } from './AtticExperience.jsx';
import { CANDLE_SHELF, TABLE } from './atticLayout.mjs';
import { radialGlowTexture } from './canvasTextures.mjs';
import { useTlrStore } from './useTlrStore.mjs';

const MAX_CANDLES = 7; // the obal score ladder tops out at 7

class QuietBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error) {
    console.warn('The Last Reading: 3D attic effect failed to load.', error);
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

function Flame({ position, seed, scale = 1 }) {
  const texture = useMemo(() => radialGlowTexture('rgba(255,224,150,0.95)', 'rgba(255,150,50,0.35)'), []);
  const ref = useRef();
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.elapsedTime * 7 + seed * 13.7;
    const flicker = 0.86 + 0.14 * Math.sin(t) * Math.sin(t * 0.37 + seed);
    ref.current.scale.set(0.11 * scale * flicker, 0.17 * scale * flicker, 1);
    ref.current.material.opacity = 0.75 + 0.25 * Math.sin(t * 1.7 + seed * 3);
  });
  return (
    <sprite ref={ref} position={position} scale={[0.11 * scale, 0.17 * scale, 1]}>
      <spriteMaterial map={texture} transparent depthWrite={false} blending={THREE.AdditiveBlending} />
    </sprite>
  );
}

function CandleShelf() {
  const { adapter } = useContext(AtticContext);
  // Live store read: ENTER_ATTIC writes the visit's obals into persist.obals,
  // so the shelf lights itself from the same state the reducer owns. The
  // adapter count is only a fallback for a missing store.
  const storeObals = useTlrStore(state => state?.persist?.obals ?? null);
  const lit = Math.max(0, Math.min(MAX_CANDLES, storeObals ?? adapter.obalCount()));

  const candles = useMemo(() => {
    const list = [];
    for (let i = 0; i < MAX_CANDLES; i++) {
      const x = (i - (MAX_CANDLES - 1) / 2) * CANDLE_SHELF.spacing;
      const height = 0.1 + 0.07 * ((i * 2.7) % 1);
      list.push({ x, height });
    }
    return list;
  }, []);

  const [sx, sy, sz] = CANDLE_SHELF.position;
  const lightRef = useRef();
  useFrame(({ clock }) => {
    if (!lightRef.current) return;
    lightRef.current.intensity =
      lit > 0 ? 1.7 + 0.35 * Math.sin(clock.elapsedTime * 9.3) * Math.sin(clock.elapsedTime * 3.1) : 0;
  });

  return (
    <group position={[sx, 0, sz]}>
      <mesh position={[0, sy - 0.03, 0]}>
        <boxGeometry args={[MAX_CANDLES * CANDLE_SHELF.spacing + 0.3, 0.06, 0.3]} />
        <meshLambertMaterial color="#5a3f26" />
      </mesh>
      {[-1, 1].map(side => (
        <mesh key={side} position={[side * (MAX_CANDLES * CANDLE_SHELF.spacing) * 0.5, (sy - 0.06) / 2, 0.05]}>
          <boxGeometry args={[0.07, sy - 0.06, 0.07]} />
          <meshLambertMaterial color="#4a3320" />
        </mesh>
      ))}
      {candles.map((candle, i) => (
        <group key={i} position={[candle.x, sy, 0]}>
          <mesh position={[0, candle.height / 2, 0]}>
            <cylinderGeometry args={[0.028, 0.034, candle.height, 8]} />
            <meshLambertMaterial color={i < lit ? '#e8d9b0' : '#7a705c'} />
          </mesh>
          {i < lit && <Flame position={[0, candle.height + 0.06, 0]} seed={i} />}
        </group>
      ))}
      <pointLight
        ref={lightRef}
        position={[0, sy + 0.35, 0.3]}
        color="#ffb45e"
        intensity={1.7}
        distance={6}
        decay={1.7}
      />
    </group>
  );
}

// A fixed candle by the spread keeps the table warm even at zero obals.
function TableCandle() {
  const lightRef = useRef();
  useFrame(({ clock }) => {
    if (!lightRef.current) return;
    lightRef.current.intensity = 1.25 + 0.22 * Math.sin(clock.elapsedTime * 8.1 + 2);
  });
  const [tx, , tz] = TABLE.position;
  return (
    <group position={[tx - 0.52, TABLE.topY, tz - 0.35]}>
      <mesh position={[0, 0.07, 0]}>
        <cylinderGeometry args={[0.035, 0.045, 0.14, 8]} />
        <meshLambertMaterial color="#e8d9b0" />
      </mesh>
      <Flame position={[0, 0.2, 0]} seed={11} scale={1.15} />
      <pointLight ref={lightRef} position={[0, 0.42, 0]} color="#ffb45e" intensity={1.25} distance={4.5} decay={1.8} />
    </group>
  );
}

function DustField() {
  const texture = useLoader(THREE.TextureLoader, '/fx/dust_mote_particle.png');
  const count = 130;
  const { positions, speeds } = useMemo(() => {
    const positionArray = new Float32Array(count * 3);
    const speedArray = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      positionArray[i * 3] = 0.55 + (Math.random() - 0.5) * 2.4;
      positionArray[i * 3 + 1] = Math.random() * 2.4;
      positionArray[i * 3 + 2] = -1.7 + (Math.random() - 0.5) * 2.4;
      speedArray[i] = 0.02 + Math.random() * 0.05;
    }
    return { positions: positionArray, speeds: speedArray };
  }, []);
  const ref = useRef();
  useFrame((_, delta) => {
    const geometry = ref.current?.geometry;
    if (!geometry) return;
    const array = geometry.attributes.position.array;
    for (let i = 0; i < count; i++) {
      array[i * 3 + 1] += speeds[i] * delta * 4;
      array[i * 3] += Math.sin(array[i * 3 + 1] * 2.1 + i) * delta * 0.02;
      if (array[i * 3 + 1] > 2.5) array[i * 3 + 1] = 0.05;
    }
    geometry.attributes.position.needsUpdate = true;
  });
  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        map={texture}
        size={0.045}
        transparent
        opacity={0.5}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        sizeAttenuation
      />
    </points>
  );
}

export function Diegetics() {
  return (
    <group>
      <CandleShelf />
      <TableCandle />
      <QuietBoundary>
        <Suspense fallback={null}>
          <DustField />
        </Suspense>
      </QuietBoundary>
    </group>
  );
}
