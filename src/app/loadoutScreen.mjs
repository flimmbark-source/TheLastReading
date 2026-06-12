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

export function installLoadoutScreen(target = window) {
  if (!target || target.__tlrLoadoutInstalled) return;
  target.__tlrLoadoutInstalled = true;

  let profile = loadProfile(target.localStorage);
  // --- Render helpers ---

  function renderPersonaGrid() {
    const grid = el('loadoutPersonaGrid');
    if (!grid) return;
    grid.innerHTML = allPersonas().map(p => `
      <button
        class="loadout-persona-card${profile.personaId === p.id ? ' selected' : ''}"
        onclick="tlrLoadoutSelectPersona('${p.id}')"
        aria-pressed="${profile.personaId === p.id}"
        type="button"
      >
        <span class="loadout-persona-check">✓</span>
        <span class="loadout-persona-name">${p.name}</span>
        <span class="loadout-persona-tagline">${p.tagline}</span>
        <span class="loadout-persona-desc">${p.description}</span>
      </button>
    `).join('');
  }

  function renderTargetRow() {
    const labels = { [SCORE_TARGETS.QUICK]: 'Quick', [SCORE_TARGETS.STANDARD]: 'Standard', [SCORE_TARGETS.LONG]: 'Long' };
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
    renderPersonaGrid();
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
    renderPersonaGrid();
    renderReady();
  };

  target.tlrLoadoutSetTarget = function (value) {
    profile = { ...profile, scoreTarget: Number(value) };
    saveProfile(target.localStorage, profile);
    renderTargetRow();
  };

  target.tlrLoadoutReady = function () {
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

    <section class="loadout-section">
      <h3 class="loadout-section-label">Persona</h3>
      <div id="loadoutPersonaGrid" class="loadout-persona-grid"></div>
    </section>

    <section class="loadout-section">
      <h3 class="loadout-section-label">Match Length</h3>
      <div class="loadout-targets">
        <button class="loadout-target-btn" data-target="100" onclick="tlrLoadoutSetTarget(100)" type="button">Quick <span>100</span></button>
        <button class="loadout-target-btn" data-target="200" onclick="tlrLoadoutSetTarget(200)" type="button">Standard <span>200</span></button>
        <button class="loadout-target-btn" data-target="300" onclick="tlrLoadoutSetTarget(300)" type="button">Long <span>300</span></button>
      </div>
    </section>

    <div class="loadout-footer">
      <button class="loadout-ready-btn" id="loadoutReadyBtn" onclick="tlrLoadoutReady()" type="button" disabled>Ready</button>
      <p class="loadout-ready-note">Select a Persona to continue.</p>
    </div>
  </div>
`;
