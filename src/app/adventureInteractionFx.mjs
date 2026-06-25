// Compatibility entry point for the awaited Adventure interaction sequence.
// Re-exporting instantiates V2, which owns the animation and defers the result
// overlay until the Event reaction has completely finished.
export {
  NODE_VISUALS,
  installAdventureInteractionFxV2 as installAdventureInteractionFx,
} from './adventureInteractionFxV2.mjs';
