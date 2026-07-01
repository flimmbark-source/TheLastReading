import { allPersonas } from '../multiplayer/personas.mjs';
import { SCORE_TARGETS } from '../multiplayer/mpState.mjs';

const PROFILE_KEY = 'tlr_mp_profile';
const SWITCH_CUE_FILE = 'assets/audio/soundreality-bell-fx-410608.mp3';

// Per-persona portrait art (relative to the document root). `tile` is the
// half-body card used in the slot carousel; `full` is the full-body display.
const PERSONA_ART = {
  cleaner: { tile: 'assets/Cleaner_Tile.webp', full: 'assets/Cleaner_Full.webp' },
  hoarder: { tile: 'assets/Hoarder_Tile.webp', full: 'assets/Hoarder_Full.webp' },
  anchor:  { tile: 'assets/Anchor_Tile.webp',  full: 'assets/Anchor_Full.webp' },
  gambit:  { tile: 'assets/Gambit_Tile.webp',  full: 'assets/Gambit_Full.webp' },
  surgeon: { tile: 'assets/Surgeon_Tile.webp', full: 'assets/Surgeon_Full.webp' },
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
  let artPreloaded = false;

  function preloadPersonaArt() {
    if (artPreloaded) return;
    artPreloaded = true;
    const ImageCtor = target.Image || Image;
    const sources = Object.values(PERSONA_ART).flatMap(art => [art.tile, art.full]).filter(Boolean);
    for (const src of sources) {
      try {
        const img = new ImageCtor();
        img.src = src;
        img.decode?.().catch(() => {});
      } catch (_) {}
    }
  }

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
    const existing = Array.from(rail.querySelectorAll(':scope > .loadout-slot[data-persona]'));
    const canReuse = existing.length === personas.length && personas.every((p, i) => existing[i]?.dataset.persona === p.id);

    if (canReuse) {
      personas.forEach((p, i) => {
        const btn = existing[i];
        const active = p.id === activeId;
        btn.classList.toggle('active', active);
        btn.setAttribute('aria-pressed', String(active));
        btn.style.setProperty('--tile-accent', p.accent || '#d4af6a');
      });
      return;
    }

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

    let artEl = stage.querySelector(':scope > .loadout-portrait-art');
    if (!artEl) {
      stage.replaceChildren();
      artEl = target.document.createElement('div');
      stage.appendChild(artEl);
    }

    artEl.className = 'loadout-portrait-art';
    requestAnimationFrame(() => requestAnimationFrame(() => { artEl.className = `loadout-portrait-art${enterClass}`; }));
    if (art) {
      artEl.style.backgroundImage = `url("${art.full}")`;
      artEl.innerHTML = '';
    } else {
      artEl.style.backgroundImage = '';
      artEl.innerHTML = personaIconSvg(p);
    }
  }

  // Right column: persona name and the relic/upgrade slots that the character
  // comes with. The slots are placeholders for now.
  function renderDetails() {
    const box = el('loadoutDetails');
    if (!box) return;
    const p = activePersona();
    if (!p) { box.innerHTML = ''; return; }
    const relicSlots = Array.from({ length: RELIC_SLOT_COUNT }, () => `
      <li class="loadout-relic">
        <span class="loadout-relic-orb" aria-hidden="true"></span>
        <span class="loadout-relic-label">Relic slot — empty</span>
      </li>`).join('');
    box.innerHTML = `
      <h3 class="loadout-details-name">${esc(p.name)}</h3>
      ${p.bio ? `<p class="loadout-details-bio">${esc(p.bio)}</p>` : ''}
      <div class="loadout-details-divider" aria-hidden="true"></div>
      <ul class="loadout-relics">${relicSlots}</ul>
    `;
  }

  // Markup for the bottom ability bar for a given persona.
  function abilityBarHtml(p) {
    const a = p.ability;
    return `
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

  // Bottom bar: the active persona's signature ability.
  function renderAbility() {
    const box = el('loadoutPersonaDescBox');
    if (!box) return;
    const p = activePersona();
    if (!p) { box.innerHTML = ''; return; }
    box.innerHTML = abilityBarHtml(p);
  }

  // Locks the ability bar to the height of its tallest persona so switching
  // personas never resizes the row. Measures each persona's content in place
  // (no paint occurs mid-loop), then pins min-height to the largest.
  function lockAbilityHeight() {
    const box = el('loadoutPersonaDescBox');
    if (!box || !personas.length) return;
    box.style.minHeight = '0px';
    let max = 0;
    for (const p of personas) {
      box.innerHTML = abilityBarHtml(p);
      if (box.offsetHeight > max) max = box.offsetHeight;
    }
    box.style.minHeight = `${max}px`;
    renderAbility();
  }

  function renderReady() {
    const btn = el('loadoutReadyBtn');
    if (btn) btn.disabled = profile.personaId === null;
  }

  function renderAll(dir = null) {
    ensurePersonaSelected();
    preloadPersonaArt();
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
    const swipeZone = el('loadoutMain');
    if (swipeZone) {
      swipeZone.addEventListener('touchstart', onTouchStart, { passive: true });
      swipeZone.addEventListener('touchend', onTouchEnd, { passive: true });
    }
    // Re-measure the ability bar when the viewport changes (e.g. rotation),
    // since text wrapping — and so the tallest persona's height — can shift.
    target.addEventListener?.('resize', () => {
      if (screen.classList.contains('loadout-hidden')) return;
      lockAbilityHeight();
    });
  }

  // --- Public API (referenced from other screens / match init) ---

  target.tlrShowLoadout = function () {
    profile = loadProfile(target.localStorage);
    preloadPersonaArt();
    renderAll();
    lockAbilityHeight();
    el('loadoutScreen')?.classList.remove('loadout-hidden');
  };

  target.tlrHideLoadout = hideScreen;

  // Expose profile for use by the match init system.
  target.tlrGetMpProfile = function () {
    ensurePersonaSelected();
    return { ...profile };
  };
}
