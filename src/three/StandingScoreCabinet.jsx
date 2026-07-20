// Physical Score / Threshold readout and reference book used while the
// player rises and walks the attic.

import { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { scorePlacedCards, thresholdValue } from '../game/selectors.mjs';
import { TABLE } from './atticLayout.mjs';
import { useTlrStore } from './useTlrStore.mjs';

const SCORE_PALETTE = ['#231608', '#0d0905', '#d39a3f', '#ffe0a0'];
const THRESHOLD_PALETTE = ['#1b1326', '#0b0810', '#8f70d5', '#ded0ff'];
const BOOK_POSITION = [TABLE.position[0] + 0.43, TABLE.topY + 0.035, TABLE.position[2] + 0.02];

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
  ground.addColorStop(0, top); ground.addColorStop(1, bottom); ctx.fillStyle = ground; ctx.fillRect(0, 0, canvas.width, canvas.height);
  const glow = ctx.createRadialGradient(320, 310, 12, 320, 310, 330);
  glow.addColorStop(0, `${accent}66`); glow.addColorStop(1, `${accent}00`); ctx.fillStyle = glow; ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = `${accent}b8`; ctx.lineWidth = 12; ctx.strokeRect(18, 18, canvas.width - 36, canvas.height - 36);
  ctx.strokeStyle = `${accent}55`; ctx.lineWidth = 3; ctx.strokeRect(38, 38, canvas.width - 76, canvas.height - 76);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = ink; ctx.shadowColor = '#000000'; ctx.shadowBlur = 12;
  ctx.font = '700 47px Georgia, serif'; ctx.fillText(label.toUpperCase(), 320, 82);
  ctx.strokeStyle = `${accent}99`; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(118, 124); ctx.lineTo(522, 124); ctx.stroke();
  ctx.font = '700 142px Georgia, serif'; ctx.fillText(formatCounter(value), 320, 232);
  if (note) { ctx.fillStyle = '#ef6d5f'; ctx.font = '700 34px Georgia, serif'; ctx.fillText(note, 320, 321); }
  const clamped = Math.max(0, Math.min(1, progress)); ctx.shadowBlur = 0; ctx.fillStyle = '#0a0705aa'; ctx.fillRect(112, 352, 416, 14); ctx.fillStyle = accent; ctx.fillRect(112, 352, 416 * clamped, 14);
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; texture.minFilter = THREE.LinearFilter; texture.magFilter = THREE.LinearFilter; texture.generateMipmaps = false; texture.needsUpdate = true; return texture;
}

function CabinetPanel({ x, label, value, note, progress, palette }) {
  const texture = useMemo(() => cabinetPanelTexture({ label, value, note, progress, palette }), [label, note, palette, progress, value]);
  useLayoutEffect(() => () => texture.dispose(), [texture]);
  return <group position={[x, 0.205, 0.106]}><mesh position={[0, 0, -0.008]}><boxGeometry args={[0.35, 0.258, 0.025]} /><meshLambertMaterial color="#17100b" /></mesh><mesh position={[0, 0, 0.007]}><planeGeometry args={[0.318, 0.218]} /><meshBasicMaterial map={texture} toneMapped={false} /></mesh>{[-0.169, 0.169].map((frameX, index) => <mesh key={index} position={[frameX, 0, 0.017]}><boxGeometry args={[0.02, 0.218, 0.014]} /><meshLambertMaterial color="#9a7538" /></mesh>)}</group>;
}

function AtticReferenceBook() {
  const lightRef = useRef();
  useFrame(({ clock }) => { if (lightRef.current) lightRef.current.intensity = 0.28 + 0.08 * Math.sin(clock.elapsedTime * 2.1); });
  const open = event => { event.stopPropagation(); window.tlrOpenAtticBook?.(); };
  return <group name="attic-reference-book" position={BOOK_POSITION} rotation={[0, -0.18, 0]} onClick={open} onPointerOver={event => { event.stopPropagation(); document.body.style.cursor = 'pointer'; }} onPointerOut={event => { event.stopPropagation(); document.body.style.removeProperty('cursor'); }}>
    <mesh position={[0, 0.018, 0]}><boxGeometry args={[0.48, 0.035, 0.34]} /><meshLambertMaterial color="#4b2318" /></mesh>
    <mesh position={[-0.12, 0.043, -0.004]} rotation={[0, 0, -0.035]}><boxGeometry args={[0.225, 0.018, 0.3]} /><meshLambertMaterial color="#d8c38d" emissive="#2b1d0d" /></mesh>
    <mesh position={[0.12, 0.043, -0.004]} rotation={[0, 0, 0.035]}><boxGeometry args={[0.225, 0.018, 0.3]} /><meshLambertMaterial color="#e2cf9d" emissive="#2b1d0d" /></mesh>
    <mesh position={[0, 0.056, 0]}><boxGeometry args={[0.018, 0.024, 0.31]} /><meshLambertMaterial color="#81562b" /></mesh>
    {[{ x: -0.16, color: '#8f70d5' }, { x: 0, color: '#b78336' }, { x: 0.16, color: '#74452b' }].map(tab => <mesh key={tab.x} position={[tab.x, 0.064, -0.16]}><boxGeometry args={[0.055, 0.012, 0.07]} /><meshLambertMaterial color={tab.color} emissive={tab.color} emissiveIntensity={0.16} /></mesh>)}
    <pointLight ref={lightRef} position={[0, 0.26, 0]} color="#e5bd6f" intensity={0.3} distance={1.2} decay={2} />
  </group>;
}

function ScoreThresholdCabinet() {
  const storeState = useTlrStore(state => state);
  const reading = useMemo(() => { if (!storeState?.run) return { score: 0, threshold: 0, mult: 1, pending: 0 }; const placed = scorePlacedCards(storeState); const run = storeState.run; const stillBuilding = run.phase === 'table' || run.phase === 'ability'; return { score: stillBuilding ? (run.roundScore || 0) + (placed.finalScore || 0) : run.roundScore || 0, threshold: thresholdValue(storeState), mult: placed.mult || 1, pending: run.thresholdBonusPending || 0 }; }, [storeState]);
  useLayoutEffect(() => { document.body?.classList.remove('table3d-continuous-return'); const className = 'table3d-score-cabinet'; document.body?.classList.add(className); let style = document.getElementById('table3d-score-cabinet-style'); if (!style) { style = document.createElement('style'); style.id = 'table3d-score-cabinet-style'; style.textContent = `body.table3d-live.${className} .score-stack{opacity:0!important;visibility:hidden!important;pointer-events:none!important;}`; document.head.appendChild(style); } return () => document.body?.classList.remove(className); }, []);
  const scoreNote = reading.mult > 1 ? `×${formatCounter(reading.mult)}` : ''; const thresholdNote = reading.pending ? `+${reading.pending} NEXT` : ''; const progress = reading.threshold > 0 ? reading.score / reading.threshold : 0; const [tx, , tz] = TABLE.position;
  return <group name="standing-score-threshold-cabinet" position={[tx, TABLE.topY, tz - 0.63]}>
    {[-1, 1].map(side => [-1, 1].map(front => <mesh key={`${side}-${front}`} position={[side * 0.36, 0.024, front * 0.064]}><boxGeometry args={[0.055, 0.048, 0.055]} /><meshLambertMaterial color="#3b2414" /></mesh>))}
    <mesh position={[0, 0.058, 0]}><boxGeometry args={[0.86, 0.07, 0.235]} /><meshLambertMaterial color="#3a2415" /></mesh><mesh position={[0, 0.205, 0]}><boxGeometry args={[0.82, 0.27, 0.205]} /><meshLambertMaterial color="#51331d" /></mesh><mesh position={[0, 0.355, -0.008]}><boxGeometry args={[0.88, 0.045, 0.235]} /><meshLambertMaterial color="#3e2717" /></mesh><mesh position={[0, 0.205, 0.108]}><boxGeometry args={[0.035, 0.278, 0.02]} /><meshLambertMaterial color="#8d6935" /></mesh>
    {[-1, 1].map(side => <mesh key={side} position={[side * 0.405, 0.205, 0.108]}><boxGeometry args={[0.028, 0.282, 0.022]} /><meshLambertMaterial color="#76562d" /></mesh>)}
    <CabinetPanel x={-0.205} label="Score" value={reading.score} note={scoreNote} progress={progress} palette={SCORE_PALETTE} /><CabinetPanel x={0.205} label="Threshold" value={reading.threshold} note={thresholdNote} progress={progress} palette={THRESHOLD_PALETTE} />
    <mesh position={[0, 0.39, 0.02]} rotation={[0, 0, Math.PI / 4]}><octahedronGeometry args={[0.035, 0]} /><meshLambertMaterial color="#a9813d" /></mesh>
  </group>;
}

export function StandingScoreCabinet() { return <><ScoreThresholdCabinet /><AtticReferenceBook /></>; }
