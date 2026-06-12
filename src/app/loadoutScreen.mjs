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

  function selectPersonaByIndex(index) {
    if (!personas.length) return;
    const wrapped = (index + personas.length) % personas.length;
    profile = { ...profile, personaId: personas[wrapped].id };
    saveProfile(target.localStorage, profile);
    renderAll();
  }

  // --- Render helpers ---

  function renderPersonaGrid() {
    const grid = el('loadoutPersonaGrid');
    if (!grid) return;

    const p = activePersona();
    if (!p) {
      grid.innerHTML = '<p class="loadout-empty">No personas available.</p>';
      return;
    }

    const index = personaIndex();
    grid.innerHTML = `
      <div
        class="loadout-persona-carousel"
        ontouchstart="tlrLoadoutSwipeStart(event)"
        ontouchend="tlrLoadoutSwipeEnd(event)"
      >
        <button class="loadout-carousel-btn prev" onclick="tlrLoadoutShiftPersona(-1)" type="button" aria-label="Previous persona">‹</button>
        <button
          class="loadout-persona-card loadout-persona-active selected"
          onclick="tlrLoadoutSelectPersona('${esc(p.id)}')"
          aria-pressed="true"
          type="button"
        >
          <span class="loadout-persona-check">✓</span>
          <span class="loadout-persona-kicker">Persona ${index + 1} / ${personas.length}</span>
          <span class="loadout-persona-name">${esc(p.name)}</span>
          <span class="loadout-persona-tagline">${esc(p.tagline)}</span>
        </button>
        <button class="loadout-carousel-btn next" onclick="tlrLoadoutShiftPersona(1)" type="button" aria-label="Next persona">›</button>
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

  function renderTargetRow() {
    target.document.querySelectorAll('.loadout-target-btn').forEach(btn => {
      const val = Number(btn.dataset.target);
      btn.classList.toggle('selected', val === profile.scoreTarget);
      btn.setAttribute('aria-pressed', val === profile.scoreTarget);
    });
  }

  function renderReady() {
    const btn = el('loadoutReadyBtn');
    if (btn) btn.disabled = profile.personaId === null;
  }

  function renderAll() {
    ensurePersonaSelected();
    renderPersonaGrid();
    renderPersonaDescription();
    renderTargetRow();
    renderReady();
  }

  // --- Public API ---

  target.tlrShowLoadout = function () {
    profile = loadProfile(target.localStorage);
    renderAll();
    el('loadoutScreen')?.classList.remove('loadout-hidden');
  };

  target.tlrHideLoadout = function () {
    const screen = el('loadoutScreen');
    if (screen) screen.classList.add('loadout-hidden');
  };

  target.tlrLoadoutBack = function () {
    target.tlrHideLoadout();
    if (typeof target.tlrShowMainMenu === 'function') target.tlrShowMainMenu();
  };

  target.tlrLoadoutSelectPersona = function (personaId) {
    profile = { ...profile, personaId };
    saveProfile(target.localStorage, profile);
    renderAll();
  };

  target.tlrLoadoutShiftPersona = function (delta) {
    selectPersonaByIndex(personaIndex() + Number(delta || 0));
  };

  target.tlrLoadoutSwipeStart = function (event) {
    const touch = event.changedTouches?.[0] || event.touches?.[0];
    if (!touch) return;
    swipeStartX = touch.clientX;
    swipeStartY = touch.clientY;
  };

  target.tlrLoadoutSwipeEnd = function (event) {
    const touch = event.changedTouches?.[0];
    if (!touch) return;
    const dx = touch.clientX - swipeStartX;
    const dy = touch.clientY - swipeStartY;
    if (Math.abs(dx) < 38 || Math.abs(dx) < Math.abs(dy)) return;
    target.tlrLoadoutShiftPersona(dx < 0 ? 1 : -1);
  };

  target.tlrLoadoutSetTarget = function (value) {
    profile = { ...profile, scoreTarget: Number(value) };
    saveProfile(target.localStorage, profile);
    renderTargetRow();
  };

  target.tlrLoadoutReady = function () {
    ensurePersonaSelected();
    if (!profile.personaId) return;
    saveProfile(target.localStorage, profile);
    // Hide loadout, open matchmaking with the saved profile
    target.tlrHideLoadout();
    if (typeof target.tlrShowMatchmaking === 'function') {
      target.tlrShowMatchmaking({ ...profile });
    }
  };

  // Expose profile for use by the match init system
  target.tlrGetMpProfile = function () {
    ensurePersonaSelected();
    return { ...profile };
  };
}

// Static HTML for the loadout screen body (rebuilt after returning from lobby)
const LOADOUT_HTML = `
  <div class="loadout-inner">
    <div class="loadout-header">
      <button class="loadout-back" onclick="tlrLoadoutBack()" type="button">← Back</button>
      <h2 class="loadout-title">Loadout</h2>
    </div>

    <section class="loadout-section loadout-persona-section">
      <h3 class="loadout-section-label">Persona</h3>
      <div id="loadoutPersonaGrid" class="loadout-persona-grid"></div>
    </section>

    <section class="loadout-description-section">
      <div id="loadoutPersonaDescBox" class="loadout-persona-desc-box"></div>
    </section>

    <section class="loadout-section loadout-match-section">
      <h3 class="loadout-section-label">Match Length</h3>
      <div class="loadout-targets">
        <button class="loadout-target-btn" data-target="100" onclick="tlrLoadoutSetTarget(100)" type="button">Quick <span>100</span></button>
        <button class="loadout-target-btn" data-target="200" onclick="tlrLoadoutSetTarget(200)" type="button">Standard <span>200</span></button>
        <button class="loadout-target-btn" data-target="300" onclick="tlrLoadoutSetTarget(300)" type="button">Long <span>300</span></button>
      </div>
    </section>

    <div class="loadout-footer">
      <button class="loadout-ready-btn" id="loadoutReadyBtn" onclick="tlrLoadoutReady()" type="button" disabled>Ready</button>
      <p class="loadout-ready-note">Swipe to choose a Persona.</p>
    </div>
  </div>
`;
