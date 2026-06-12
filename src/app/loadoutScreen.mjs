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
  let inLobby = false;

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

  function showLobby() {
    inLobby = true;
    const personas = allPersonas();
    const persona = personas.find(p => p.id === profile.personaId);
    const targetLabel = {
      [SCORE_TARGETS.QUICK]: 'Quick — 100 pts',
      [SCORE_TARGETS.STANDARD]: 'Standard — 200 pts',
      [SCORE_TARGETS.LONG]: 'Long — 300 pts',
    }[profile.scoreTarget] ?? `${profile.scoreTarget} pts`;

    const screen = el('loadoutScreen');
    if (!screen) return;
    screen.innerHTML = `
      <div class="loadout-inner" style="justify-content:center;min-height:100vh">
        <div class="loadout-header">
          <button class="loadout-back" onclick="tlrLoadoutLobbyBack()" type="button">← Back</button>
          <h2 class="loadout-title">Ready</h2>
        </div>
        <div class="loadout-lobby">
          <div class="loadout-lobby-profile">
            <div class="loadout-lobby-profile-persona">${persona ? persona.name : '—'}</div>
            <div class="loadout-lobby-profile-target">${targetLabel}</div>
          </div>
          <h3 class="loadout-lobby-title">Waiting for opponent</h3>
          <p class="loadout-lobby-sub">Host and Connect are coming soon.<br>Your loadout has been saved.</p>
        </div>
      </div>
    `;
  }

  function rebuildLoadout() {
    inLobby = false;
    const screen = el('loadoutScreen');
    if (!screen) return;
    screen.innerHTML = LOADOUT_HTML;
    renderAll();
  }

  // --- Public API ---

  target.tlrShowLoadout = function () {
    profile = loadProfile(target.localStorage);
    const screen = el('loadoutScreen');
    if (!screen) return;
    if (inLobby) rebuildLoadout();
    else renderAll();
    screen.classList.remove('loadout-hidden');
  };

  target.tlrHideLoadout = function () {
    const screen = el('loadoutScreen');
    if (screen) screen.classList.add('loadout-hidden');
  };

  target.tlrLoadoutBack = function () {
    target.tlrHideLoadout();
    if (typeof target.tlrShowMainMenu === 'function') target.tlrShowMainMenu();
  };

  target.tlrLoadoutLobbyBack = function () {
    rebuildLoadout();
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
    showLobby();
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
