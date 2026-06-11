const SET_TUTORIAL_KEY = 'tlr_tut_sets_explained';
const CONSTELLATION_TUTORIAL_KEY = 'tlr_tut_constellation_first_seen';

function currentRun() {
  return window.tlrStore?.getState?.().run || window.state || {};
}

function closeTip(datasetKey, storageKey) {
  const tip = document.getElementById('tutTip');
  if (!tip || tip.dataset[datasetKey] !== '1') return;
  tip.dataset[datasetKey] = '';
  tip.classList.remove('show', 'tut-center');
  tip.style.cssText = '';
  localStorage.setItem(storageKey, '1');
}

function openTip(datasetKey, storageKey, html) {
  if (localStorage.getItem(storageKey)) return false;
  const summary = document.getElementById('summary');
  if (summary && summary.classList.contains('show')) return false;
  const tip = document.getElementById('tutTip');
  const text = document.getElementById('tutText');
  if (!tip || !text || tip.classList.contains('show')) return false;
  text.innerHTML = html;
  tip.dataset[datasetKey] = '1';
  tip.style.cssText = '';
  tip.classList.add('show', 'tut-center');
  const hide = event => {
    if (event) event.stopPropagation();
    tip.removeEventListener('click', hide);
    closeTip(datasetKey, storageKey);
  };
  tip.addEventListener('click', hide);
  return true;
}

function showSetTutorial() {
  const run = currentRun();
  if (run.setIndex !== 1) return;
  openTip('setTutorial', SET_TUTORIAL_KEY, '<b>Set 2 begins.</b><br>There are typically 2 Sets in a Round. Clear the Threshold before this Set ends.');
}

function showConstellationTutorial() {
  const run = currentRun();
  if (Number(run.thresholdIndex ?? run.th ?? 0) <= 0 || !run.constellationId) return;
  const icon = document.getElementById('constellationPill');
  if (!icon || icon.classList.contains('hidden')) return;
  openTip('constellationTutorial', CONSTELLATION_TUTORIAL_KEY, '<b>A Constellation has appeared.</b><br>Each Round after the first can change one rule. Tap the star sign to see what it changes.');
}

function runTutorialChecks() {
  showSetTutorial();
  showConstellationTutorial();
}

function installSetFlowTutorials() {
  if (window.__tlrSetFlowPatchInstalled) return;
  window.__tlrSetFlowPatchInstalled = true;
  new MutationObserver(runTutorialChecks).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
  window.addEventListener('resize', runTutorialChecks);
  requestAnimationFrame(() => requestAnimationFrame(runTutorialChecks));
}

installSetFlowTutorials();
