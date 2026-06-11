const SET_TUTORIAL_KEY = 'tlr_tut_sets_explained';
const CONSTELLATION_TUTORIAL_KEY = 'tlr_tut_constellation_first_seen';

function closeSetTutorial() {
  const tip = document.getElementById('tutTip');
  if (!tip || tip.dataset.setTutorial !== '1') return;
  tip.dataset.setTutorial = '';
  tip.classList.remove('show', 'tut-center');
  tip.style.cssText = '';
  localStorage.setItem(SET_TUTORIAL_KEY, '1');
}

function showSetTutorial() {
  if (localStorage.getItem(SET_TUTORIAL_KEY)) return;
  const st = window.state;
  if (!st || st.setIndex !== 1) return;
  const summary = document.getElementById('summary');
  if (summary && summary.classList.contains('show')) return;

  const tip = document.getElementById('tutTip');
  const text = document.getElementById('tutText');
  if (!tip || !text || tip.classList.contains('show')) return;

  text.innerHTML = '<b>Set 2 begins.</b><br>A Round gives you 2 Sets. Each Set is 5 cards. Your Set 1 score stays in the Round total. Clear the Threshold before this Set ends.';
  tip.dataset.setTutorial = '1';
  tip.style.cssText = '';
  tip.classList.add('show', 'tut-center');

  const hide = event => {
    if (event) event.stopPropagation();
    tip.removeEventListener('click', hide);
    closeSetTutorial();
  };
  tip.addEventListener('click', hide);
}

function closeConstellationTutorial() {
  const tip = document.getElementById('tutTip');
  if (!tip || tip.dataset.constellationTutorial !== '1') return;
  tip.dataset.constellationTutorial = '';
  tip.classList.remove('show', 'tut-center');
  tip.style.cssText = '';
  localStorage.setItem(CONSTELLATION_TUTORIAL_KEY, '1');
}

function showConstellationTutorial() {
  if (localStorage.getItem(CONSTELLATION_TUTORIAL_KEY)) return;
  const st = window.state;
  if (!st || !st.constellationId) return;
  const summary = document.getElementById('summary');
  if (summary && summary.classList.contains('show')) return;
  const icon = document.getElementById('constellationPill');
  if (!icon || icon.classList.contains('hidden')) return;

  const tip = document.getElementById('tutTip');
  const text = document.getElementById('tutText');
  if (!tip || !text || tip.classList.contains('show')) return;

  text.innerHTML = '<b>A Constellation has appeared.</b><br>Each Round after the first can change one rule. Tap the star sign to see what it changes.';
  tip.dataset.constellationTutorial = '1';
  tip.style.cssText = '';
  tip.classList.add('show', 'tut-center');

  const hide = event => {
    if (event) event.stopPropagation();
    tip.removeEventListener('click', hide);
    closeConstellationTutorial();
  };
  tip.addEventListener('click', hide);
}

function autoAdvanceSetOverlay() {
  const summary = document.getElementById('summary');
  if (!summary || !summary.classList.contains('show')) return false;
  const btn = summary.querySelector('button[onclick*="continueSet"]');
  if (!btn || typeof window.continueSet !== 'function') return false;
  requestAnimationFrame(() => {
    window.continueSet();
    requestAnimationFrame(() => {
      showSetTutorial();
      showConstellationTutorial();
    });
  });
  return true;
}

function installSetFlowPatch() {
  if (window.__tlrSetFlowPatchInstalled) return;
  window.__tlrSetFlowPatchInstalled = true;

  const observer = new MutationObserver(() => {
    if (!autoAdvanceSetOverlay()) {
      showSetTutorial();
      showConstellationTutorial();
    }
  });
  observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });

  window.addEventListener('resize', () => {
    showSetTutorial();
    showConstellationTutorial();
  });
  requestAnimationFrame(() => requestAnimationFrame(() => {
    showSetTutorial();
    showConstellationTutorial();
  }));
}

installSetFlowPatch();
