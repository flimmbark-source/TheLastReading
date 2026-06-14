import { installMpGame as installBaseMpGame } from './mpGame.mjs';
import { installSurgeonHandSwapPatch } from './surgeonHandSwapPatch.mjs';
import { installMpScoringFeedbackPatch } from './mpScoringFeedbackPatch.mjs';
import { installMpScorePillStabilityPatch } from './mpScorePillStabilityPatch.mjs';

export function installMpGame(target = window) {
  installBaseMpGame(target);
  installSurgeonHandSwapPatch(target);
  installMpScoringFeedbackPatch(target);
  installMpScorePillStabilityPatch(target);
}
