import { installSurgeonHandSwapPatch } from './surgeonHandSwapPatch.mjs';
import { installMpScoringFeedbackPatch } from './mpScoringFeedbackPatch.mjs';
import { installMpScorePillStabilityPatch } from './mpScorePillStabilityPatch.mjs';
import { installMpSingleplayerAbilityFlow } from './mpSingleplayerAbilityFlow.mjs';
import { installMpUiStateFixes } from './mpUiStateFixes.mjs';
import { installMpPersonaAbilityPrompt } from './mpPersonaAbilityPrompt.mjs';
import { installMpBetweenChoiceLimit } from './mpBetweenChoiceLimit.mjs';
import { installMpPendingPlacementPreview } from './mpPendingPlacementPreview.mjs';

// Multiplayer still has several compatibility extensions while Phase 5 is in
// progress. Keep their ordering explicit and centralized here so the main host
// has a single extension seam instead of a long patch pile.
export function installMpGameExtensions(target = window) {
  installSurgeonHandSwapPatch(target);
  installMpScoringFeedbackPatch(target);
  installMpScorePillStabilityPatch(target);
  installMpSingleplayerAbilityFlow(target);
  installMpUiStateFixes(target);
  installMpPersonaAbilityPrompt(target);
  installMpBetweenChoiceLimit(target);
  installMpPendingPlacementPreview(target);
}
