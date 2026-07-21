// The placed reading rendered as real cards lying on the cloth, shown while the
// player rises from the table and walks the attic. During the seated reading
// the live SPv2 DOM spread is what you touch; the moment you stand up it hands
// off to these 3D cards so the reading stays physically on the table as the
// camera moves — the same trick the score/threshold cabinet uses, instead of a
// flat screen-space layer that can't hold the table under a moving camera.

import { useLayoutEffect, useMemo } from 'react';
import * as THREE from 'three';
import { TABLE_ANCHORS } from './atticLayout.mjs';
import { SUIT_GLYPHS, MAJOR_GLYPHS, ROMAN } from '../data/cards.mjs';
import { useTlrStore } from './useTlrStore.mjs';

const EMPTY = [];
const SLOT_ORDER = ['spread-1', 'spread-2', 'spread-3', 'spread-4', 'spread-5'];
// Card footprint on the cloth (world metres). The anchors are 0.31 apart, so
// this leaves a hair of green between neighbours.
const CARD_W = 0.27;
const CARD_H = 0.38;
const LIFT = 0.012; // rest just above the cloth to avoid z-fighting

// Dark card stock with a bright suit-coloured accent and cream ink, to match
// the game's own hand cards (dark with gold/colour accents) and stay legible on
// the green cloth under the attic's low light. Returns [bgTop, bgBottom,
// accent, ink].
function suitPalette(card) {
  const ink = '#f0dcab';
  const accent = card.type === 'major' ? '#e7c667'
    : card.suit === 'Cups' ? '#ec8a80'
    : card.suit === 'Wands' ? '#ecb057'
    : card.suit === 'Swords' ? '#93b8ec'
    : card.suit === 'Pentacles' ? '#86df9c'
    : '#e7d29a';
  const top = card.type === 'major' ? '#2a1830' : '#2a1810';
  const bottom = '#140907';
  return [top, bottom, accent, ink];
}

function cardGlyph(card) {
  if (card.type === 'major') return MAJOR_GLYPHS[card.number] || '✦';
  return SUIT_GLYPHS[card.suit] || '✦';
}

function cardIndex(card) {
  if (card.type === 'major') return ROMAN[card.number] ?? String(card.number ?? '');
  if (card.type === 'court') return (card.rank || '').slice(0, 2);
  return '';
}

function cardName(card) {
  if (card.type === 'major') return card.name || '';
  if (card.type === 'court') return `${card.rank} of ${card.suit}`;
  return card.name || card.suit || '';
}

function cardFaceTexture(card) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 358;
  const ctx = canvas.getContext('2d');
  const [top, bottom, accent, ink] = suitPalette(card);

  const ground = ctx.createLinearGradient(0, 0, 0, 358);
  ground.addColorStop(0, top);
  ground.addColorStop(1, bottom);
  ctx.fillStyle = ground;
  ctx.fillRect(0, 0, 256, 358);

  const glow = ctx.createRadialGradient(128, 178, 10, 128, 178, 210);
  glow.addColorStop(0, `${accent}44`);
  glow.addColorStop(1, `${accent}00`);
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, 256, 358);

  ctx.strokeStyle = `${accent}cc`;
  ctx.lineWidth = 8;
  ctx.strokeRect(10, 10, 236, 338);
  ctx.strokeStyle = `${accent}55`;
  ctx.lineWidth = 2;
  ctx.strokeRect(22, 22, 212, 314);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = '#000000';
  ctx.shadowBlur = 10;
  ctx.fillStyle = accent;
  ctx.font = '140px Georgia, serif';
  ctx.fillText(cardGlyph(card), 128, 168);

  const index = cardIndex(card);
  if (index) {
    ctx.shadowBlur = 4;
    ctx.fillStyle = ink;
    ctx.font = '700 32px Georgia, serif';
    ctx.textAlign = 'left';
    ctx.fillText(index, 34, 52);
    ctx.textAlign = 'right';
    ctx.fillText(index, 222, 322);
  }

  const name = cardName(card);
  if (name) {
    ctx.shadowBlur = 6;
    ctx.fillStyle = ink;
    ctx.textAlign = 'center';
    ctx.font = '700 24px Georgia, serif';
    ctx.fillText(name.length > 16 ? `${name.slice(0, 15)}…` : name, 128, 306);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  return texture;
}

function SpreadCard({ card, anchor }) {
  const texture = useMemo(() => cardFaceTexture(card), [card.id]);
  useLayoutEffect(() => () => texture.dispose(), [texture]);
  const [x, y, z] = anchor;
  // Laid flat and face up: rotateX(-90°) maps the card's top edge to the far
  // side of the table, so it reads upright to the seated/standing player.
  return (
    <group position={[x, y + LIFT, z]} rotation={[-Math.PI / 2, 0, 0]}>
      <mesh position={[0, 0, -0.005]}>
        <boxGeometry args={[CARD_W + 0.014, CARD_H + 0.014, 0.01]} />
        <meshLambertMaterial color="#0c0805" />
      </mesh>
      <mesh name={`spread-card-${card.id}`}>
        <planeGeometry args={[CARD_W, CARD_H]} />
        <meshBasicMaterial map={texture} toneMapped={false} />
      </mesh>
    </group>
  );
}

export function TableSpread() {
  const spread = useTlrStore(state => state?.run?.spread ?? EMPTY);
  const cards = useMemo(
    () => SLOT_ORDER
      .map((slot, index) => ({ card: spread[index], anchor: TABLE_ANCHORS[slot] }))
      .filter(entry => entry.card && entry.anchor),
    [spread],
  );
  if (!cards.length) return null;
  return (
    <group name="table-spread-3d">
      {cards.map(({ card, anchor }) => (
        <SpreadCard key={card.uid || card.id} card={card} anchor={anchor} />
      ))}
    </group>
  );
}
