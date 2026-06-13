import { allPersonas } from '../multiplayer/personas.mjs';
import { SCORE_TARGETS } from '../multiplayer/mpState.mjs';

const PROFILE_KEY = 'tlr_mp_profile';

const DEFAULT_PROFILE = {
  personaId: null,
  scoreTarget: SCORE_TARGETS.STANDARD,
};

function loadProfile(storage) {
  try {
    const raw = storage?.getItem(PROFILE_KEY);
    if (!raw) return { ...DEFAULT_PROFILE };
    const parsed = JSON.parse(raw);
    return {
      personaId: parsed.personaId ?? null,
      scoreTarget: parsed.scoreTarget ?? SCORE_TARGETS.STANDARD,
    };
  } catch (_) {
    return { ...DEFAULT_PROFILE };
  }
}

function saveProfile(storage, profile) {
  try { storage?.setItem(PROFILE_KEY, JSON.stringify(profile)); } catch (_) {}
}

function el(id) { return document.getElementById(id); }
function esc(str) {
  return String(str ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}
// Renders ability rules text: escapes, then turns **word** into keyword markup.
function abilityText(str) {
  return esc(str).replace(/\*\*(.+?)\*\*/g, '<strong class="loadout-desc-key">$1</strong>');
}
// Wraps a persona's stored SVG glyph markup in a styleable, inert <svg>.
function personaIconSvg(p) {
  if (!p?.icon) return '';
  return `<svg class="loadout-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p.icon}</svg>`;
}

export function installLoadoutScreen(target = window) {
  if (!target || target.__tlrLoadoutInstalled) return;
  target.__tlrLoadoutInstalled = true;

  const personas = allPersonas();
  let profile = loadProfile(target.localStorage);
  let swipeStartX = 0;
  let swipeStartY = 0;

  function personaIndex() {
    const index = personas.findIndex(p => p.id === profile.personaId);
    return index >= 0 ? index : 0;
  }

  function activePersona() {
    return personas[personaIndex()] ?? null;
  }

  function ensurePersonaSelected() {
    if (!personas.length) return;
    if (!profile.personaId || !personas.some(p => p.id === profile.personaId)) {
      profile = { ...profile, personaId: personas[0].id };
      saveProfile(target.localStorage, profile);
    }
  }

  function prefersReducedMotion() {
    try { return target.matchMedia?.('(prefers-reduced-motion: reduce)').matches; }
    catch (_) { return false; }
  }

  // Central selection entry point. `dir` is 'next' | 'prev' | null and drives
  // the enter animation direction; null = a neutral fade (e.g. roster tap).
  function setPersona(personaId, dir) {
    if (!personas.some(p => p.id === personaId)) return;
    if (personaId === profile.personaId) return;
    profile = { ...profile, personaId };
    saveProfile(target.localStorage, profile);
    renderAll(dir);
  }

  function shiftPersona(delta) {
    if (!personas.length) return;
    const step = Number(delta) || 0;
    const next = (personaIndex() + step + personas.length) % personas.length;
    setPersona(personas[next].id, step >= 0 ? 'next' : 'prev');
  }

  function selectPersonaById(personaId) {
    const from = personaIndex();
    const to = personas.findIndex(p => p.id === personaId);
    if (to < 0) return;
    setPersona(personaId, to === from ? null : (to > from ? 'next' : 'prev'));
  }

  // --- Render helpers ---

  function applyAccent() {
    const inner = target.document.querySelector('#loadoutScreen .loadout-inner');
    const p = activePersona();
    if (inner && p?.accent) inner.style.setProperty('--accent', p.accent);
  }

  function renderRoster() {
    const rail = el('loadoutRosterRail');
    if (!rail) return;
    if (!personas.length) { rail.innerHTML = ''; return; }
    const activeId = activePersona()?.id;
    rail.innerHTML = personas.map(p => {
      const active = p.id === activeId;
      return `
        <button
          class="loadout-roster-tile${active ? ' active' : ''}"
          style="--tile-accent:${esc(p.accent || '#d4af6a')}"
          data-persona="${esc(p.id)}"
          type="button"
          aria-pressed="${active}"
          title="${esc(p.name)}"
        >
          <span class="loadout-roster-icon">${personaIconSvg(p)}</span>
          <span class="loadout-roster-name">${esc(p.name.replace(/^The\s+/i, ''))}</span>
        </button>`;
    }).join('');
  }

  function renderFeatured(dir) {
    const stage = el('loadoutPersonaGrid');
    if (!stage) return;

    const p = activePersona();
    if (!p) {
      stage.innerHTML = '<p class="loadout-empty">No personas available.</p>';
      return;
    }

    const index = personaIndex();
    const enterClass = prefersReducedMotion()
      ? ''
      : dir === 'next' ? ' loadout-enter-next'
      : dir === 'prev' ? ' loadout-enter-prev'
      : ' loadout-enter';

    stage.innerHTML = `
      <div class="loadout-featured-row">
        <button class="loadout-carousel-btn prev" data-loadout-action="prev" type="button" aria-label="Previous persona">‹</button>
        <div class="loadout-persona-card${enterClass}">
          <span class="loadout-persona-kicker">Persona ${index + 1} / ${personas.length}</span>
          <span class="loadout-persona-icon">${personaIconSvg(p)}</span>
          <span class="loadout-persona-name">${esc(p.name)}</span>
        </div>
        <button class="loadout-carousel-btn next" data-loadout-action="next" type="button" aria-label="Next persona">›</button>
      </div>
      <div class="loadout-persona-dots" aria-hidden="true">
        ${personas.map((_, i) => `<span class="loadout-persona-dot${i === index ? ' active' : ''}"></span>`).join('')}
      </div>
    `;
  }

  function renderPersonaDescription() {
    const box = el('loadoutPersonaDescBox');
    if (!box) return;
    const p = activePersona();
    if (!p) { box.innerHTML = ''; return; }
    const a = p.ability;
    box.innerHTML = `
      <div class="loadout-desc-header">
        <span class="loadout-desc-ability">✦ ${esc(a.name)}</span>
        <span class="loadout-desc-tag">${esc(a.tag)}</span>
      </div>
      <p class="loadout-desc-text">${abilityText(a.rules)}</p>
      ${a.reminder ? `<p class="loadout-desc-reminder">(${esc(a.reminder)})</p>` : ''}
      ${a.flavor ? `<p class="loadout-desc-flavor">${esc(a.flavor)}</p>` : ''}
    `;
  }

  function renderReady() {
    const btn = el('loadoutReadyBtn');
    if (btn) btn.disabled = profile.personaId === null;
  }

  function renderAll(dir = null) {
    ensurePersonaSelected();
    applyAccent();
    renderRoster();
    renderFeatured(dir);
    renderPersonaDescription();
    renderReady();
  }

  // --- Event wiring (delegated; no inline handlers) ---

  function onClick(event) {
    const action = event.target.closest('[data-loadout-action]');
    if (action) {
      switch (action.dataset.loadoutAction) {
        case 'back': return backToMenu();
        case 'ready': return readyUp();
        case 'prev': return shiftPersona(-1);
        case 'next': return shiftPersona(1);
        default: return;
      }
    }
    const personaBtn = event.target.closest('[data-persona]');
    if (personaBtn) return selectPersonaById(personaBtn.dataset.persona);
  }

  function onTouchStart(event) {
    const touch = event.changedTouches?.[0] || event.touches?.[0];
    if (!touch) return;
    swipeStartX = touch.clientX;
    swipeStartY = touch.clientY;
  }

  function onTouchEnd(event) {
    const touch = event.changedTouches?.[0];
    if (!touch) return;
    const dx = touch.clientX - swipeStartX;
    const dy = touch.clientY - swipeStartY;
    if (Math.abs(dx) < 38 || Math.abs(dx) < Math.abs(dy)) return;
    shiftPersona(dx < 0 ? 1 : -1);
  }

  function backToMenu() {
    hideScreen();
    if (typeof target.tlrShowMainMenu === 'function') target.tlrShowMainMenu();
  }

  function readyUp() {
    ensurePersonaSelected();
    if (!profile.personaId) return;
    saveProfile(target.localStorage, profile);
    hideScreen();
    if (typeof target.tlrShowMatchmaking === 'function') {
      target.tlrShowMatchmaking({ ...profile });
    }
  }

  function hideScreen() {
    el('loadoutScreen')?.classList.add('loadout-hidden');
  }

  const screen = el('loadoutScreen');
  if (screen) {
    screen.addEventListener('click', onClick);
    const swipeZone = el('loadoutPersonaGrid');
    if (swipeZone) {
      swipeZone.addEventListener('touchstart', onTouchStart, { passive: true });
      swipeZone.addEventListener('touchend', onTouchEnd, { passive: true });
    }
  }

  // --- Public API (referenced from other screens / match init) ---

  target.tlrShowLoadout = function () {
    profile = loadProfile(target.localStorage);
    renderAll();
    el('loadoutScreen')?.classList.remove('loadout-hidden');
  };

  target.tlrHideLoadout = hideScreen;

  // Expose profile for use by the match init system.
  target.tlrGetMpProfile = function () {
    ensurePersonaSelected();
    return { ...profile };
  };
}
