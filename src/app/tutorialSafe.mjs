export const TUT_STEP = Object.freeze({
  INTRO: 0,
  SELECT_CARD: 1,
  PLACE_CARD: 2,
  SCORE_ADDED: 3,
  CARD_POINTS: 4,
  THRESHOLD: 5,
  DISCARD_ABILITY: 6,
  PATTERN_NOTICE: 7,
  THRESHOLD_PROGRESS: 8,
  RELIC: 9,
  PATTERN_SCORING: 10,
  PURGE: 11,
  READING_COMPLETE: 12,
  ARCHIVES: 13,
  MARKET_RESERVE: 14,
  MARKET_SCORING: 15,
  MARKET_ABILITIES: 16,
  MARKET_RELICS: 17,
  MARKET_REFRESH: 18,
  MARKET_NEXT: 19,
});

let currentStep = -1;

export function tutSkip(){ tutHide(); }
export function replayTutorial(){ tutShow(TUT_STEP.INTRO, { force: true }); }
export function tutHide(){
  currentStep = -1;
  const tip = document.getElementById('tutTip');
  if (tip) {
    tip.classList.remove('show', 'tut-center');
    tip.style.cssText = '';
  }
}
export function tutShow(step){
  currentStep = Number.isFinite(step) ? step : -1;
  tutHide();
}
export function tutNext(){ tutHide(); }
export function tutSignal(){ tutHide(); }
export function maybeShowPatternTutorial(){}
export function maybeShowReadingCompletionTutorial(){}
export function maybeShowPurgeTutorial(){}
export function maybeShowArchivesTutorial(){}
export function maybeShowMarketTutorial(){}
