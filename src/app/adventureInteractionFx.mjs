// Compatibility entry point for the current Adventure interaction sequence.
// V3 keeps the node item near the played card, gives that item its own motion,
// then plays a separate outcome visual over the Event before showing results.
export {
  NODE_VISUALS,
  installAdventureInteractionFxV3 as installAdventureInteractionFx,
} from './adventureInteractionFxV3.mjs';
