// Canvas-built textures for the diegetic attic UI: floating prompt labels,
// glow/flame sprites. Everything here is generated at runtime so the 3D layer
// adds no new image assets; the prop art itself reuses the existing /props
// PNGs untouched.

import * as THREE from 'three';

const promptCache = new Map();

// A rounded parchment tag with the interaction verb, e.g. "Check pocket [E]".
// Rendered once per distinct label and cached; sprites share the texture.
export function promptTexture(label) {
  const cached = promptCache.get(label);
  if (cached) return cached;

  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');

  ctx.font = '600 44px Georgia, serif';
  const textWidth = Math.min(460, ctx.measureText(label).width);
  const w = Math.ceil(textWidth + 56);
  const h = 84;
  const x = (canvas.width - w) / 2;
  const y = (canvas.height - h) / 2;
  const r = 18;

  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fillStyle = 'rgba(17, 10, 5, 0.82)';
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = 'rgba(198, 150, 77, 0.85)';
  ctx.stroke();

  ctx.fillStyle = '#ead9b5';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, canvas.width / 2, canvas.height / 2 + 2, 452);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 2;
  promptCache.set(label, texture);
  return texture;
}

// Soft radial disc used for candle flames, prop glows, and the moon.
export function radialGlowTexture(inner, outer) {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createRadialGradient(64, 64, 4, 64, 64, 62);
  gradient.addColorStop(0, inner);
  gradient.addColorStop(0.55, outer);
  gradient.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 128, 128);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

// Gold ring used as the tap-to-walk destination marker on the floor.
export function ringTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.strokeStyle = 'rgba(255, 214, 128, 0.9)';
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.arc(64, 64, 44, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255, 214, 128, 0.35)';
  ctx.lineWidth = 16;
  ctx.beginPath();
  ctx.arc(64, 64, 44, 0, Math.PI * 2);
  ctx.stroke();
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

// Vertical gradient used on the moonlight shaft quad.
export function shaftTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createLinearGradient(0, 0, 0, 256);
  gradient.addColorStop(0, 'rgba(173, 197, 255, 0.30)');
  gradient.addColorStop(0.7, 'rgba(150, 175, 240, 0.10)');
  gradient.addColorStop(1, 'rgba(140, 165, 235, 0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 64, 256);
  // Feather the left/right edges so the shaft has no hard silhouette.
  const fade = ctx.createLinearGradient(0, 0, 64, 0);
  fade.addColorStop(0, 'rgba(0,0,0,1)');
  fade.addColorStop(0.2, 'rgba(0,0,0,0)');
  fade.addColorStop(0.8, 'rgba(0,0,0,0)');
  fade.addColorStop(1, 'rgba(0,0,0,1)');
  ctx.globalCompositeOperation = 'destination-out';
  ctx.fillStyle = fade;
  ctx.fillRect(0, 0, 64, 256);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
