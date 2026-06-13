import { allPersonas } from '../multiplayer/personas.mjs';
import { SCORE_TARGETS } from '../multiplayer/mpState.mjs';

const PROFILE_KEY = 'tlr_mp_profile';
const SWITCH_CUE_FILE = 'soundreality-bell-fx-410608.mp3';

// Per-persona portrait art (relative to the document root). `tile` is the
// half-body card used in the slot carousel; `full` is the full-body display.
const PERSONA_ART = {
  cleaner: { tile: 'Cleaner_Tile.png', full: 'Cleaner_Full.png' },
  hoarder: { tile: 'Hoarder_Tile.png', full: 'Hoarder_Full.png' },
  anchor:  { tile: 'Anchor_Tile.png',  full: 'Anchor_Full.png' },
  gambit:  { tile: 'Gambit_Tile.png',  full: 'Gambit_Full.png' },
  surgeon: { tile: 'Surgeon_Tile.png', full: 'Surgeon_Full.png' },
};
function personaArt(p) { return PERSONA_ART[p?.id] || null; }

// Number of placeholder relic/upgrade slots shown beside the portrait.
const RELIC_SLOT_COUNT = 3;

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
  let switchAudio = null;

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

  // Plays the persona-switch chime. Reuses one element so rapid switching
  // restarts the cue rather than stacking overlapping sounds.
  function playSwitchCue() {
    try {
      const vol = typeof target._sfxVol === 'number' ? target._sfxVol : 1;
      if (vol <= 0) return;
      if (!switchAudio) switchAudio = new (target.Audio || Audio)(SWITCH_CUE_FILE);
      switchAudio.volume = Math.max(0, Math.min(1, vol * 0.3));
      switchAudio.currentTime = 0;
      switchAudio.play().catch(() => {});
    } catch (_) {}
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

  // The slot carousel: one fixed tile per persona, active tile highlighted
  // with the selection marker. Tapping a tile features that persona.
  function renderSlots() {
    const rail = el('loadoutSlots');
    if (!rail) return;
    if (!personas.length) { rail.innerHTML = ''; return; }
    const activeId = activePersona()?.id;
    rail.innerHTML = personas.map(p => {
      const active = p.id === activeId;
      const art = personaArt(p);
      const tileStyle = art ? `background-image:url(${esc(art.tile)})` : '';
      return `
        <button
          class="loadout-slot${active ? ' active' : ''}"
          style="--tile-accent:${esc(p.accent || '#d4af6a')}"
          data-persona="${esc(p.id)}"
          type="button"
          aria-pressed="${active}"
          title="${esc(p.name)}"
        >
          <span class="loadout-slot-art"${tileStyle ? ` style="${tileStyle}"` : ''}>
            ${art ? '' : personaIconSvg(p)}
          </span>
          <span class="loadout-slot-marker" aria-hidden="true"></span>
        </button>`;
    }).join('');
  }

  // Left column: the featured persona's full-body art in the arched frame.
  function renderPortrait(dir) {
    const stage = el('loadoutPortrait');
    if (!stage) return;
    const p = activePersona();
    if (!p) { stage.innerHTML = '<p class="loadout-empty">No personas available.</p>'; return; }

    const art = personaArt(p);
    const enterClass = prefersReducedMotion()
      ? ''
      : dir === 'next' ? ' loadout-enter-next'
      : dir === 'prev' ? ' loadout-enter-prev'
      : ' loadout-enter';

    const imageStyle = art ? `style="background-image:url(${esc(art.full)})"` : '';
    stage.innerHTML = `
      <div class="loadout-portrait-art${enterClass}" ${imageStyle}>
        ${art ? '' : personaIconSvg(p)}
      </div>
      <span class="loadout-portrait-name">${esc(p.name)}</span>
    `;
  }

  // Right column: persona name, tagline and the relic/upgrade slots that the
  // character comes with. The slots are placeholders for now.
  function renderDetails() {
    const box = el('loadoutDetails');
    if (!box) return;
    const p = activePersona();
    if (!p) { box.innerHTML = ''; return; }
    const index = personaIndex();
    const relicSlots = Array.from({ length: RELIC_SLOT_COUNT }, () => `
      <li class="loadout-relic">
        <span class="loadout-relic-orb" aria-hidden="true"></span>
        <span class="loadout-relic-label">Relic slot — empty</span>
      </li>`).join('');
    box.innerHTML = `
      <span class="loadout-details-kicker">Persona ${index + 1} / ${personas.length}</span>
      <h3 class="loadout-details-name">${esc(p.name)}</h3>
      ${p.tagline ? `<p class="loadout-details-tagline">${esc(p.tagline)}</p>` : ''}
      <div class="loadout-details-divider" aria-hidden="true"></div>
      <ul class="loadout-relics">${relicSlots}</ul>
    `;
  }

  // Bottom bar: the active persona's signature ability.
  function renderAbility() {
    const box = el('loadoutPersonaDescBox');
    if (!box) return;
    const p = activePersona();
    if (!p) { box.innerHTML = ''; return; }
    const a = p.ability;
    box.innerHTML = `
      <span class="loadout-ability-icon">${personaIconSvg(p)}</span>
      <div class="loadout-ability-body">
        <div class="loadout-desc-header">
          <span class="loadout-desc-ability">${esc(a.name)}</span>
          <span class="loadout-desc-tag">${esc(a.tag)}</span>
        </div>
        <p class="loadout-desc-text">${abilityText(a.rules)}</p>
        ${a.reminder ? `<p class="loadout-desc-reminder">(${esc(a.reminder)})</p>` : ''}
        ${a.flavor ? `<p class="loadout-desc-flavor">${esc(a.flavor)}</p>` : ''}
      </div>
    `;
  }

  function renderReady() {
    const btn = el('loadoutReadyBtn');
    if (btn) btn.disabled = profile.personaId === null;
  }

  function renderAll(dir = null) {
    ensurePersonaSelected();
    applyAccent();
    renderSlots();
    renderPortrait(dir);
    renderDetails();
    renderAbility();
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
    const swipeZone = el('loadoutPortrait');
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
