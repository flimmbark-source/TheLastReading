// Top-level game mode selector. Score Mode is the existing game; Adventure Mode
// is the narrative roguelite variant. Adventure Mode keeps its own run
// progression (see src/systems/adventure/run.mjs) and never mutates Score Mode
// state.

export const GAME_MODES = Object.freeze({
  SCORE: 'score',
  ADVENTURE: 'adventure',
});

/** @typedef {('score'|'adventure')} GameMode */

export function isGameMode(value) {
  return value === GAME_MODES.SCORE || value === GAME_MODES.ADVENTURE;
}
