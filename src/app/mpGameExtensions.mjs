import { installMpSingleplayerAbilityFlow } from './mpSingleplayerAbilityFlow.mjs';
import { installMpUiStateFixes } from './mpUiStateFixes.mjs';

// Multiplayer still has several compatibility extensions while Phase 5 is in
// progress. Keep their ordering explicit and centralized here so the main host
// has a single extension seam instead of a long patch pile.
export function installMpGameExtensions(target = window) {
  installMpSingleplayerAbilityFlow(target);
  installMpUiStateFixes(target);
}
