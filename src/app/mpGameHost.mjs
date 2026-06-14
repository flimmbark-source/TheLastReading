import { installMpGame as installBaseMpGame } from './mpGame.mjs';
import { installSurgeonHandSwapPatch } from './surgeonHandSwapPatch.mjs';
import { installMpScoringFeedbackPatch } from './mpScoringFeedbackPatch.mjs';
import { installMpScorePillStabilityPatch } from './mpScorePillStabilityPatch.mjs';
import { installMpSingleplayerAbilityFlow } from './mpSingleplayerAbilityFlow.mjs';
import { installMpUiStateFixes } from './mpUiStateFixes.mjs';
import { installMpPersonaAbilityPrompt } from './mpPersonaAbilityPrompt.mjs';
import { installMpBetweenChoiceLimit } from './mpBetweenChoiceLimit.mjs';
import { installMpPendingPlacementPreview } from './mpPendingPlacementPreview.mjs';

export function installMpGame(target = window) {
  installBaseMpGame(target);
  installSurgeonHandSwapPatch(target);
  installMpScoringFeedbackPatch(target);
  installMpScorePillStabilityPatch(target);
  installMpSingleplayerAbilityFlow(target);
  installMpUiStateFixes(target);
  installMpPersonaAbilityPrompt(target);
  installMpBetweenChoiceLimit(target);
  installMpPendingPlacementPreview(target);
}
