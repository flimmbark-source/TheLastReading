const SET_TUTORIAL_KEY = 'tlr_tut_sets_explained';

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
  if (!tip || !text) return;

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

function autoAdvanceSetOverlay() {
  const summary = document.getElementById('summary');
  if (!summary || !summary.classList.contains('show')) return false;
  const btn = summary.querySelector('button[onclick*="continueSet"]');
  if (!btn || typeof window.continueSet !== 'function') return false;
  requestAnimationFrame(() => {
    window.continueSet();
    requestAnimationFrame(showSetTutorial);
  });
  return true;
}

function installSetFlowPatch() {
  if (window.__tlrSetFlowPatchInstalled) return;
  window.__tlrSetFlowPatchInstalled = true;

  const observer = new MutationObserver(() => {
    if (!autoAdvanceSetOverlay()) showSetTutorial();
  });
  observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });

  window.addEventListener('resize', showSetTutorial);
  requestAnimationFrame(() => requestAnimationFrame(showSetTutorial));
}

installSetFlowPatch();
