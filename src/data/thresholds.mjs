export const THRESHOLDS = Object.freeze([10, 20, 35, 50, 70, 90, 115, 140, 175, 200]);

export function currentThreshold(thresholdIndex, thresholdBonus = 0) {
  return THRESHOLDS[thresholdIndex] + thresholdBonus;
}

export function hasMoreThresholds(thresholdIndex) {
  return thresholdIndex < THRESHOLDS.length;
}
