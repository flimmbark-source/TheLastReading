// Diegetic UI: game state rendered as things in the room instead of HUD chrome.
//
// - The candle shelf is the obal counter — one lit candle per obal, read live
//   from the architecture store through useTlrStore. Entering the attic plays
//   an ignition ceremony: the candles you earned catch light one by one while
//   you stand up from the table.
// - Score and Threshold live in a small antique cabinet resting on the cloth.
// - Discovered archive items accumulate as keepsakes on the trunk lid.
// - All flames and their lights answer tlr:presentation-cue events through
//   cueEnergy (see AtticExperience.jsx) — during the run-start approach the
//   table dealing cards underneath makes the room flicker in response.
// - Dust motes drift through the moonlight using fx/dust_mote_particle.png.

import { Component, Suspense, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useFrame, useLoader } from '@react-three/fiber';
import * as THREE from 'three';
import { scorePlacedCards, thresholdValue } from '../game/selectors.mjs';
import { AtticContext, cueEnergy } from './AtticExperience.jsx';
import { CANDLE_SHELF, TABLE, TRUNK_SPOT, READING_CENTER } from './atticLayout.mjs';
import { radialGlowTexture } from './canvasTextures.mjs';
import { useTlrStore } from './useTlrStore.mjs';

const MAX_CANDLES = 7; // the obal score ladder tops out at 7
const FLAME_CUES = ['card-place', 'pattern', 'ability-reveal', 'threshold-clear'];

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
  const { cueRef } = useContext(AtticContext);
  const texture = useMemo(() => radialGlowTexture('rgba(255,224,150,0.95)', 'rgba(255,150,50,0.35)'), []);
  const ref = useRef();
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.elapsedTime * 7 + seed * 13.7;
    const surge = 1 + cueEnergy(cueRef, FLAME_CUES, 800) * 0.65;
    const flicker = (0.86 + 0.14 * Math.sin(t) * Math.sin(t * 0.37 + seed)) * surge;
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
  const { adapter, mode, cueRef, reducedMotion } = useContext(AtticContext);
  // Live store read: ENTER_ATTIC writes the visit's obals into persist.obals,
  // so the shelf lights itself from the same state the reducer owns. The
  // adapter count is only a fallback for a missing store.
  const storeObals = useTlrStore(state => state?.persist?.obals ?? null);
  const lit = Math.max(0, Math.min(MAX_CANDLES, storeObals ?? adapter.obalCount()));

  // Ignition ceremony (attic visits only): candles catch one by one while
  // the stand-up choreography plays, so the reward is read off the room.
  const instant = mode !== 'attic' || reducedMotion;
  const [ignited, setIgnited] = useState(instant ? lit : 0);
  const mountTimeRef = useRef(null);
  useFrame(({ clock }) => {
    if (mountTimeRef.current === null) mountTimeRef.current = clock.elapsedTime;
    const target = instant
      ? lit
      : Math.min(lit, Math.floor((clock.elapsedTime - mountTimeRef.current - 1.1) / 0.36) + 1);
    const next = Math.max(0, Math.min(lit, target));
    if (next !== ignited) setIgnited(next);
  });

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
    const surge = 1 + cueEnergy(cueRef, FLAME_CUES, 800) * 0.8;
    lightRef.current.intensity =
      ignited > 0
        ? (1.35 +
            0.35 * (ignited / MAX_CANDLES) +
            0.35 * Math.sin(clock.elapsedTime * 9.3) * Math.sin(clock.elapsedTime * 3.1)) *
          surge
        : 0;
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
            <meshLambertMaterial color={i < ignited ? '#e8d9b0' : '#7a705c'} />
          </mesh>
          {i < ignited && <Flame position={[0, candle.height + 0.06, 0]} seed={i} />}
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

// Seated-table mode only: a soft warm pool over the cloth so the play
// surface reads as the stage under the DOM cards — especially on the
// top-down portrait framing, where the shelf and rafter lights barely
// graze it.
function TableReadingGlow() {
  const { cueRef } = useContext(AtticContext);
  const lightRef = useRef();
  useFrame(({ clock }) => {
    if (!lightRef.current) return;
    const surge = 1 + cueEnergy(cueRef, FLAME_CUES, 800) * 0.5;
    lightRef.current.intensity = (1.15 + 0.08 * Math.sin(clock.elapsedTime * 2.3)) * surge;
  });
  // Follow the reading centre (not the table centre) so the pool stays under
  // the cards after the seated framing moved the reading toward the player.
  const [rx, , rz] = READING_CENTER;
  return (
    <pointLight
      ref={lightRef}
      position={[rx, TABLE.topY + 0.9, rz - 0.05]}
      color="#d9a25e"
      intensity={1.15}
      distance={3.4}
      decay={1.8}
    />
  );
}

// A fixed candle by the spread keeps the table warm even at zero obals.
function TableCandle() {
  const { cueRef } = useContext(AtticContext);
  const lightRef = useRef();
  useFrame(({ clock }) => {
    if (!lightRef.current) return;
    const surge = 1 + cueEnergy(cueRef, FLAME_CUES, 800) * 0.8;
    lightRef.current.intensity = (1.25 + 0.22 * Math.sin(clock.elapsedTime * 8.1 + 2)) * surge;
  });
  const [tx, , tz] = TABLE.position;
  // Beside the discard rail: on the cloth, but clear of the seated-table
  // spread row and the hand fan.
  return (
    <group position={[tx - 0.55, TABLE.topY, tz + 0.07]}>
      <mesh position={[0, 0.07, 0]}>
        <cylinderGeometry args={[0.035, 0.045, 0.14, 8]} />
        <meshLambertMaterial color="#e8d9b0" />
      </mesh>
      <Flame position={[0, 0.2, 0]} seed={11} scale={1.15} />
      <pointLight ref={lightRef} position={[0, 0.42, 0]} color="#ffb45e" intensity={1.25} distance={4.5} decay={1.8} />
    </group>
  );
}

function formatCounter(value) {
  const rounded = Math.round((Number(value) || 0) * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : String(rounded).replace(/0+$/, '').replace(/\.$/, '');
}

function cabinetPanelTexture({ label, value, note = '', progress = 0, palette }) {
  const canvas = document.createElement('canvas');
  canvas.width = 640;
  canvas.height = 400;
  const ctx = canvas.getContext('2d');
  const [top, bottom, accent, ink] = palette;

  const ground = ctx.createLinearGradient(0, 0, 0, canvas.height);
  ground.addColorStop(0, top);
  ground.addColorStop(1, bottom);
  ctx.fillStyle = ground;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const glow = ctx.createRadialGradient(320, 310, 12, 320, 310, 330);
  glow.addColorStop(0, `${accent}66`);
  glow.addColorStop(1, `${accent}00`);
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = `${accent}b8`;
  ctx.lineWidth = 12;
  ctx.strokeRect(18, 18, canvas.width - 36, canvas.height - 36);
  ctx.strokeStyle = `${accent}55`;
  ctx.lineWidth = 3;
  ctx.strokeRect(38, 38, canvas.width - 76, canvas.height - 76);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = ink;
  ctx.shadowColor = '#000000';
  ctx.shadowBlur = 12;
  ctx.font = '700 47px Georgia, serif';
  ctx.fillText(label.toUpperCase(), 320, 82);

  ctx.strokeStyle = `${accent}99`;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(118, 124);
  ctx.lineTo(522, 124);
  ctx.stroke();

  ctx.font = '700 142px Georgia, serif';
  ctx.fillText(formatCounter(value), 320, 232);

  if (note) {
    ctx.fillStyle = '#ef6d5f';
    ctx.font = '700 34px Georgia, serif';
    ctx.fillText(note, 320, 321);
  }

  const clamped = Math.max(0, Math.min(1, progress));
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#0a0705aa';
  ctx.fillRect(112, 352, 416, 14);
  ctx.fillStyle = accent;
  ctx.fillRect(112, 352, 416 * clamped, 14);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  return texture;
}

function CabinetPanel({ x, label, value, note, progress, palette }) {
  const texture = useMemo(
    () => cabinetPanelTexture({ label, value, note, progress, palette }),
    [label, note, palette, progress, value],
  );
  useEffect(() => () => texture.dispose(), [texture]);

  const frame = [
    [-0.169, 0, 0.02, 0.218],
    [0.169, 0, 0.02, 0.218],
  ];

  return (
    <group position={[x, 0.205, 0.106]}>
      <mesh position={[0, 0, -0.008]}>
        <boxGeometry args={[0.35, 0.258, 0.025]} />
        <meshLambertMaterial color="#17100b" />
      </mesh>
      <mesh position={[0, 0, 0.007]}>
        <planeGeometry args={[0.318, 0.218]} />
        <meshBasicMaterial map={texture} toneMapped={false} />
      </mesh>
      {frame.map(([fx, fy, fw, fh], index) => (
        <mesh key={index} position={[fx, fy, 0.017]}>
          <boxGeometry args={[fw, fh, 0.014]} />
          <meshLambertMaterial color="#9a7538" />
        </mesh>
      ))}
    </group>
  );
}

// The old screen-space Score/Threshold pill becomes a physical tabletop object.
// The cabinet stays entirely on the far half of the green cloth, behind the
// spread. It reads live reducer state, but never owns or mutates that state.
function ScoreThresholdCabinet() {
  const storeState = useTlrStore(state => state);
  const reading = useMemo(() => {
    if (!storeState?.run) return { score: 0, threshold: 0, mult: 1, pending: 0 };
    const placed = scorePlacedCards(storeState);
    const run = storeState.run;
    const stillBuilding = run.phase === 'table' || run.phase === 'ability';
    const score = stillBuilding ? (run.roundScore || 0) + (placed.finalScore || 0) : run.roundScore || 0;
    return {
      score,
      threshold: thresholdValue(storeState),
      mult: placed.mult || 1,
      pending: run.thresholdBonusPending || 0,
    };
  }, [storeState]);

  useEffect(() => {
    const className = 'table3d-score-cabinet';
    document.body?.classList.add(className);
    let style = document.getElementById('table3d-score-cabinet-style');
    if (!style) {
      style = document.createElement('style');
      style.id = 'table3d-score-cabinet-style';
      style.textContent = `body.table3d-live.${className} .score-stack{opacity:0!important;visibility:hidden!important;pointer-events:none!important;}`;
      document.head.appendChild(style);
    }
    return () => document.body?.classList.remove(className);
  }, []);

  const scoreNote = reading.mult > 1 ? `×${formatCounter(reading.mult)}` : '';
  const thresholdNote = reading.pending ? `+${reading.pending} NEXT` : '';
  const progress = reading.threshold > 0 ? reading.score / reading.threshold : 0;
  const [tx, , tz] = TABLE.position;

  return (
    <group name="score-threshold-cabinet" position={[tx, TABLE.topY, tz - 0.63]}>
      {[-1, 1].map(side =>
        [-1, 1].map(front => (
          <mesh key={`${side}-${front}`} position={[side * 0.36, 0.024, front * 0.064]}>
            <boxGeometry args={[0.055, 0.048, 0.055]} />
            <meshLambertMaterial color="#3b2414" />
          </mesh>
        )),
      )}
      <mesh position={[0, 0.058, 0]}>
        <boxGeometry args={[0.86, 0.07, 0.235]} />
        <meshLambertMaterial color="#3a2415" />
      </mesh>
      <mesh position={[0, 0.205, 0]}>
        <boxGeometry args={[0.82, 0.27, 0.205]} />
        <meshLambertMaterial color="#51331d" />
      </mesh>
      <mesh position={[0, 0.355, -0.008]}>
        <boxGeometry args={[0.88, 0.045, 0.235]} />
        <meshLambertMaterial color="#3e2717" />
      </mesh>
      <mesh position={[0, 0.205, 0.108]}>
        <boxGeometry args={[0.035, 0.278, 0.02]} />
        <meshLambertMaterial color="#8d6935" />
      </mesh>
      {[-1, 1].map(side => (
        <mesh key={side} position={[side * 0.405, 0.205, 0.108]}>
          <boxGeometry args={[0.028, 0.282, 0.022]} />
          <meshLambertMaterial color="#76562d" />
        </mesh>
      ))}
      <CabinetPanel
        x={-0.205}
        label="Score"
        value={reading.score}
        note={scoreNote}
        progress={progress}
        palette={['#231608', '#0d0905', '#d39a3f', '#ffe0a0']}
      />
      <CabinetPanel
        x={0.205}
        label="Threshold"
        value={reading.threshold}
        note={thresholdNote}
        progress={progress}
        palette={['#1b1326', '#0b0810', '#8f70d5', '#ded0ff']}
      />
      <mesh position={[0, 0.39, 0.02]} rotation={[0, 0, Math.PI / 4]}>
        <octahedronGeometry args={[0.035, 0]} />
        <meshLambertMaterial color="#a9813d" />
      </mesh>
    </group>
  );
}

// ── keepsakes: the archive made physical ─────────────────────────────────
// Every discovered archive item stands on the trunk lid as a small framed
// keepsake, so the attic visibly accumulates the story you have uncovered.
// Store-driven (DISCOVER_ARCHIVE_ITEM lands here live when a pickup is
// taken), with the adapter's persisted list unioned in as a fallback.

const KEEPSAKE_SLOTS = [-0.36, -0.12, 0.12, 0.36];

function KeepsakeFrame({ itemId, slot, children }) {
  return (
    <group position={[slot, 0, 0]} rotation={[-0.14, 0, 0]}>
      <mesh name={`keepsake-${itemId}`} position={[0, 0.15, 0]}>
        <planeGeometry args={[0.2, 0.26]} />
        {children}
      </mesh>
      <mesh position={[0, 0.15, -0.008]}>
        <planeGeometry args={[0.24, 0.3]} />
        <meshLambertMaterial color="#2e1f12" />
      </mesh>
    </group>
  );
}

function TexturedKeepsake({ itemId, thumb, slot }) {
  const texture = useLoader(THREE.TextureLoader, `/${thumb}`);
  texture.colorSpace = THREE.SRGBColorSpace;
  return (
    <KeepsakeFrame itemId={itemId} slot={slot}>
      <meshLambertMaterial map={texture} />
    </KeepsakeFrame>
  );
}

function PaperKeepsake({ itemId, slot }) {
  return (
    <KeepsakeFrame itemId={itemId} slot={slot}>
      <meshLambertMaterial color="#e8d998" emissive="#3a3012" />
    </KeepsakeFrame>
  );
}

function Keepsakes() {
  const { adapter } = useContext(AtticContext);
  const storeKey = useTlrStore(state => (state?.persist?.discoveredArchiveItems || []).join(','));
  const items = useMemo(() => {
    const union = new Set(storeKey ? storeKey.split(',') : []);
    try {
      for (const id of adapter.foundItemIds()) union.add(id);
    } catch {
      /* adapter list is a bonus, not a requirement */
    }
    const thumbs = new Map();
    for (const prop of Object.values(adapter.objects || {})) thumbs.set(prop.itemId, prop.thumb);
    thumbs.set(adapter.note?.itemId, null); // the note keepsake is plain paper
    return [...union]
      .filter(id => thumbs.has(id))
      .slice(0, KEEPSAKE_SLOTS.length)
      .map((id, index) => ({
        itemId: id,
        thumb: thumbs.get(id),
        slot: KEEPSAKE_SLOTS[index],
      }));
  }, [adapter, storeKey]);

  if (!items.length) return null;
  const [tx, , tz] = TRUNK_SPOT.position;
  return (
    <group position={[tx, TRUNK_SPOT.lidY, tz]} rotation={[0, TRUNK_SPOT.rotationY, 0]}>
      {items.map(item => (
        <QuietBoundary key={item.itemId}>
          <Suspense fallback={null}>
            {item.thumb ? (
              <TexturedKeepsake itemId={item.itemId} thumb={item.thumb} slot={item.slot} />
            ) : (
              <PaperKeepsake itemId={item.itemId} slot={item.slot} />
            )}
          </Suspense>
        </QuietBoundary>
      ))}
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
  const { mode } = useContext(AtticContext);
  return (
    <group>
      <CandleShelf />
      <TableCandle />
      {mode === 'table' && (
        <>
          <TableReadingGlow />
          <ScoreThresholdCabinet />
        </>
      )}
      <Keepsakes />
      <QuietBoundary>
        <Suspense fallback={null}>
          <DustField />
        </Suspense>
      </QuietBoundary>
    </group>
  );
}
