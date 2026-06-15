// Multiplayer-only cleanup for ability flow surfaces that share singleplayer DOM.
// In MP, relation abilities move from a hand/spread target selector into the
// shared #modal card-choice screen. If the card-choice screen is hidden, the old
// target selector must not remain visible underneath it.

function clearMpTargetClasses(doc) {
  doc.querySelectorAll('body.mp-game-active #hand .card, body.mp-game-active #spread .card').forEach(cardEl => {
    cardEl.classList.remove('ability-target', 'ability-picked', 'ability-disabled');
  });
  doc.querySelectorAll('body.mp-game-active #spread .slot').forEach(slot => {
    slot.classList.remove('ability-target-slot', 'ability-picked-slot', 'ability-disabled-slot', 'ability-empty-slot');
  });
}

function hideMpTargetPrompts(doc) {
  doc.getElementById('abilityPrompt')?.classList.remove('show');
  doc.getElementById('purgePrompt')?.classList.remove('show');
}

function modalHasChoiceCards(doc) {
  return !!doc.querySelector('#modal.show #choices .card, #modal.collapsed #choices .card');
}

function cleanupMpAbilitySurfaces(doc) {
  if (!doc.body.classList.contains('mp-game-active')) return;
  const modal = doc.getElementById('modal');
  if (!modal) return;
  const modalActive = modal.classList.contains('show') || modal.classList.contains('collapsed');
  if (!modalActive || !modalHasChoiceCards(doc)) return;

  hideMpTargetPrompts(doc);
  clearMpTargetClasses(doc);

  const toggle = doc.getElementById('modalToggle');
  if (toggle) toggle.textContent = modal.classList.contains('collapsed') ? 'Show' : 'Hide';
}

export function installMpAbilitySurfaceCleanup(target = window) {
  if (!target || target.__tlrMpAbilitySurfaceCleanupInstalled) return;
  target.__tlrMpAbilitySurfaceCleanupInstalled = true;
  const doc = target.document;
  if (!doc?.body) return;

  const run = () => cleanupMpAbilitySurfaces(doc);
  const schedule = () => {
    run();
    target.requestAnimationFrame?.(run);
  };

  const observer = new MutationObserver(schedule);
  observer.observe(doc.body, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ['class'],
  });

  doc.addEventListener('click', event => {
    if (!doc.body.classList.contains('mp-game-active')) return;
    if (!event.target?.closest?.('#modalToggle, #choices .card, #choices button')) return;
    target.requestAnimationFrame?.(run);
  }, true);

  run();
  target.setTimeout?.(run, 100);
  target.setTimeout?.(run, 500);
}

if (typeof window !== 'undefined') {
  const install = () => installMpAbilitySurfaceCleanup(window);
  install();
  window.setTimeout?.(install, 0);
  window.setTimeout?.(install, 500);
}
