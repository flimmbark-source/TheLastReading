export const THRESHOLDS = Object.freeze([30, 60, 90, 120, 150, 180, 210, 240, 270, 300]);

export function currentThreshold(thresholdIndex, thresholdBonus = 0) {
  return THRESHOLDS[thresholdIndex] + thresholdBonus;
}

export function hasMoreThresholds(thresholdIndex) {
  return thresholdIndex < THRESHOLDS.length;
}
