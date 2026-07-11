import { ACTION_NODES } from './nodes.mjs';

export const ADVENTURE_SIGILS = Object.freeze({
  [ACTION_NODES.PHYSICAL]: Object.freeze({ id: 'might', name: 'Might', glyph: '✦' }),
  [ACTION_NODES.AGGRESSION]: Object.freeze({ id: 'blade', name: 'Blade', glyph: '✕' }),
  [ACTION_NODES.PROTECTION]: Object.freeze({ id: 'shield', name: 'Shield', glyph: '◆' }),
  [ACTION_NODES.ENDURANCE]: Object.freeze({ id: 'mountain', name: 'Mountain', glyph: '▲' }),
  [ACTION_NODES.COMPASSION]: Object.freeze({ id: 'heart', name: 'Heart', glyph: '♥' }),
  [ACTION_NODES.AUTHORITY]: Object.freeze({ id: 'crown', name: 'Crown', glyph: '♚' }),
  [ACTION_NODES.MYSTERY]: Object.freeze({ id: 'moon', name: 'Omen', glyph: '☾' }),
  [ACTION_NODES.DECEPTION]: Object.freeze({ id: 'mask', name: 'Mask', glyph: '◐' }),
  [ACTION_NODES.INVESTIGATION]: Object.freeze({ id: 'eye', name: 'Eye', glyph: '⊙' }),
  [ACTION_NODES.TRANSFORMATION]: Object.freeze({ id: 'serpent', name: 'Serpent', glyph: '∿' }),
  [ACTION_NODES.CREATION]: Object.freeze({ id: 'forge', name: 'Forge', glyph: '✚' }),
  [ACTION_NODES.FORTUNE]: Object.freeze({ id: 'wheel', name: 'Wheel', glyph: '◎' }),
});

export const SIGIL_BY_ID = Object.freeze(Object.fromEntries(
  Object.values(ADVENTURE_SIGILS).map(sigil => [sigil.id, sigil]),
));

export function sigilForNode(node) {
  return ADVENTURE_SIGILS[node] || null;
}

export function sigilName(node) {
  return sigilForNode(node)?.name || 'Unknown';
}

export function sigilGlyph(node) {
  return sigilForNode(node)?.glyph || '•';
}
