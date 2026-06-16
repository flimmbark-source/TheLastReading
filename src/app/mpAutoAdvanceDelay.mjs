export function installMpAutoAdvanceDelay(target = window) {
  if (!target || target.__tlrMpAutoAdvanceDelayDisabled) return;
  target.__tlrMpAutoAdvanceDelayDisabled = true;
}
