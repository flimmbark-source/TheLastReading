const SET_TUTORIAL_KEY = 'tlr_tut_sets_explained';
const CONSTELLATION_TUTORIAL_KEY = 'tlr_tut_constellation_first_seen';

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
  const st = window.state;
  if (!st || st.setIndex !== 1) return;
  openTip('setTutorial', SET_TUTORIAL_KEY, '<b>Set 2 begins.</b><br>A Round gives you 2 Sets. Each Set is 5 cards. Your Set 1 score stays in the Round total. Clear the Threshold before this Set ends.');
}

function showConstellationTutorial() {
  const st = window.state;
  if (!st || Number(st.th || 0) <= 0 || !st.constellationId) return;
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
