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
  const pill = document.getElementById('constellationPill');
  if (!pill || pill.classList.contains('hidden')) return;
  const storageKey = CONSTELLATION_TUTORIAL_KEY;
  try { if (localStorage.getItem(storageKey)) return; } catch(e) {}
  const tip = document.getElementById('tutTip');
  const text = document.getElementById('tutText');
  if (!tip || !text || tip.classList.contains('show')) return;
  const summary = document.getElementById('summary');
  if (summary && summary.classList.contains('show')) return;
  text.innerHTML = '<b>A Constellation has appeared.</b><br>Each Round after the first can change one rule. Tap the star sign to see what it changes.';
  tip.dataset.constellationTutorial = '1';
  tip.classList.remove('tut-center');
  tip.style.cssText = '';
  const rect = pill.getBoundingClientRect();
  const margin = 8;
  requestAnimationFrame(() => {
    const w = tip.offsetWidth || 220;
    const h = tip.offsetHeight || 80;
    let left, top;
    if (window.innerWidth > 640) {
      left = rect.left - w - 12;
      if (left < margin) left = rect.right + 12;
      top = rect.top + rect.height / 2 - h / 2;
    } else {
      left = rect.left + rect.width / 2 - w / 2;
      top = rect.top - h - 12;
      if (top < margin) top = rect.bottom + 12;
    }
    left = Math.max(margin, Math.min(window.innerWidth - w - margin, left));
    top = Math.max(margin, Math.min(window.innerHeight - h - margin, top));
    tip.style.left = left + 'px';
    tip.style.top = top + 'px';
    tip.style.position = 'fixed';
    tip.classList.add('show');
  });
  const hide = event => {
    if (event) event.stopPropagation();
    tip.removeEventListener('click', hide);
    tip.classList.remove('show');
    tip.style.cssText = '';
    try { localStorage.setItem(storageKey, '1'); } catch(e) {}
    delete tip.dataset.constellationTutorial;
  };
  tip.addEventListener('click', hide);
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
