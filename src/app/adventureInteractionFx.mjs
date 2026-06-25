// Compatibility entry point for the current Adventure interaction sequence.
// V4 crops and plays the authored node and outcome sprite sheets, then defers
// the result overlay until both sprite phases have fully completed.
export {
  NODE_VISUALS,
  OUTCOME_VISUALS,
  installAdventureInteractionFxV4 as installAdventureInteractionFx,
} from './adventureInteractionFxV4.mjs';
