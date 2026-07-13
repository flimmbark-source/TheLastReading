// Deterministic seeded RNG for the Adventure pilot. A run created from a given
// seed reproduces the exact same event order and effects, which the seeded
// scenario validators depend on.

export function createSeededRng(seed = 1) {
  // mulberry32 — small, fast, deterministic.
  let a = (Number(seed) >>> 0) || 1;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function seededPick(rng, list) {
  if (!Array.isArray(list) || list.length === 0) return null;
  return list[Math.floor(rng() * list.length)];
}
