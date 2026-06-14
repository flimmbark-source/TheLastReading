import { installMpSingleplayerAbilityFlow } from './mpSingleplayerAbilityFlow.mjs';

// Multiplayer still has a compatibility extension while Phase 5 is in progress.
// Keep the seam centralized here so the main host has a single extension point
// instead of a long patch pile. Mult-span / score-pill maintenance has been
// folded into mpGame.mjs and its installer removed from this seam.
export function installMpGameExtensions(target = window) {
  installMpSingleplayerAbilityFlow(target);
}
