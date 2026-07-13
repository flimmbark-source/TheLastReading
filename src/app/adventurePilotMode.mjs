// Adventure Mode — Consequence Pilot (playable vertical slice).
//
// This is a SELF-CONTAINED, DEV-ONLY screen reached via the `#adv-pilot` hash
// route. It deliberately does not touch the legacy Adventure V3 UI, Score Mode,
// or Multiplayer: it renders the card-first consequence loop directly from the
// pure pilot engine in src/systems/adventure/pilot/. Nothing here compares card
// potency to a requirement, routes a card to a "nearest" node, or shows a
// Failure/Success/Great Success tier. The chosen card's Adventure trait is the
// event response, and the world remembers the consequence.

import { ALL_CARD_DEFINITIONS } from '../data/cards.mjs';
import { cardAdventureProfile } from '../data/adventure/cardNodes.mjs';
import { TRAIT_LABELS, PILOT_STATUSES, PILOT_MATERIALS, pilotNounName, STRAIN_WARNINGS } from '../data/adventure/pilot/vocab.mjs';
import { warningForSource } from '../systems/adventure/pilot/pilotTerminal.mjs';
import { createSeededRng } from '../systems/adventure/pilot/rng.mjs';
import {
  startPilotRun,
  enterStage,
  resolveCurrent,
  resolveChoice,
  applyResolution,
  applyRecovery,
  advanceStage,
} from '../systems/adventure/pilot/pilotRun.mjs';
import { getPilotEvent } from '../data/adventure/pilot/pilotContent.mjs';
import { buildFinalePayload } from '../systems/adventure/pilot/pilotFinale.mjs';
import { buildRecoveryChoices } from '../data/adventure/pilot/pilotRecovery.mjs';

const ROOT_ID = 'advPilotRoot';
const STYLE_ID = 'advPilotStyle';

const TRAIT_GLYPHS = {
  physical: '✊', aggression: '⚔', protection: '🛡', endurance: '⛰', compassion: '❦', authority: '♜',
  mystery: '☾', deception: '🎭', investigation: '🔍', transformation: '⟳', creation: '⚒', fortune: '🎲',
};

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

const CARD_NAME = new Map(ALL_CARD_DEFINITIONS.map(card => [card.id, card.name]));

// ---------------------------------------------------------------------------
// UI/session state (deck + hand economy live here, not in the pure run state).
// ---------------------------------------------------------------------------
let session = null;

function newSession(seed) {
  const run = startPilotRun({ seed });
  const deck = ALL_CARD_DEFINITIONS.map(card => card.id);
  return {
    run,
    seed,
    deck,
    used: [],
    hand: [],
    descriptor: enterStage(run),
    phase: 'event',
    lastPacket: null,
    pendingEvent: null,
    pendingTrait: null,
    showHistory: false,
    showDebug: false,
    handCounter: 0,
  };
}

function drawHand(count = 5) {
  const s = session;
  // Deterministic draw keyed by seed + a monotonic counter so a replay is
  // reproducible; preserves a persistent card-use economy (played cards move to
  // the used pile and only return on reshuffle).
  s.handCounter += 1;
  const rng = createSeededRng((s.seed ^ (s.handCounter * 2246822519)) >>> 0);
  if (s.deck.length < count) {
    s.deck = s.deck.concat(s.used.splice(0, s.used.length));
  }
  const pool = [...s.deck];
  const hand = [];
  while (hand.length < count && pool.length) {
    const index = Math.floor(rng() * pool.length);
    hand.push(pool.splice(index, 1)[0]);
  }
  s.hand = hand;
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------
function ensureRoot(doc) {
  let root = doc.getElementById(ROOT_ID);
  if (!root) {
    root = doc.createElement('div');
    root.id = ROOT_ID;
    doc.body.appendChild(root);
  }
  if (!doc.getElementById(STYLE_ID)) {
    const style = doc.createElement('style');
    style.id = STYLE_ID;
    style.textContent = STYLES;
    doc.head.appendChild(style);
  }
  return root;
}

function statusChips(run) {
  if (!run.statuses.length && run.strain === 'clear') return '<span class="advp-muted">No conditions.</span>';
  const chips = [];
  if (run.strain !== 'clear') {
    const warn = STRAIN_WARNINGS[run.strain];
    chips.push(`<span class="advp-chip advp-chip--strain" title="${esc(warn || '')}">Strain: ${esc(run.strain)}${warn ? ' ⚠' : ''}</span>`);
  }
  for (const id of run.statuses) {
    const def = PILOT_STATUSES[id];
    const danger = def?.danger ? ' advp-chip--danger' : '';
    const warn = def?.warning ? ` title="${esc(def.warning)}"` : '';
    chips.push(`<span class="advp-chip${danger}"${warn}>${esc(def?.name || id)}${def?.warning ? ' ⚠' : ''}</span>`);
  }
  return chips.join('');
}

function inventoryRow(run) {
  const parts = [];
  if (run.companions.length) parts.push(`<div class="advp-inv"><b>Companions</b> ${run.companions.map(c => esc(pilotNounName(c))).join(', ')}</div>`);
  const items = run.items.filter(i => i !== 'provision');
  if (items.length) parts.push(`<div class="advp-inv"><b>Items</b> ${items.map(i => esc(pilotNounName(i))).join(', ')}</div>`);
  const mats = run.materials.map(m => esc(PILOT_MATERIALS[m]?.name || m));
  parts.push(`<div class="advp-inv"><b>Materials</b> ${mats.length ? mats.join(', ') : '—'} <span class="advp-muted">(${run.materials.length}/3)</span> · <b>Provisions</b> ${run.provisions}</div>`);
  if (run.threads.length) parts.push(`<div class="advp-inv"><b>Threads</b> ${run.threads.map(t => `${esc(t.id.replace(/_/g, ' '))} <i>(${esc(t.urgency)})</i>`).join(', ')}</div>`);
  return parts.join('');
}

function warningBanner(run, event) {
  // Surface every currently-visible terminal warning so danger is never a
  // surprise, without revealing the exact outcome.
  const warnings = [];
  if (run.strain === 'exhausted') warnings.push(STRAIN_WARNINGS.exhausted);
  else if (run.strain === 'spent') warnings.push(STRAIN_WARNINGS.spent);
  for (const id of run.statuses) {
    const w = PILOT_STATUSES[id]?.warning;
    if (w) warnings.push(w);
  }
  if (!warnings.length) return '';
  return `<div class="advp-warn">${warnings.map(w => `<div>⚠ ${esc(w)}</div>`).join('')}</div>`;
}

function renderEvent() {
  const { run, descriptor } = session;
  const event = descriptor.event;
  if (!session.hand.length) drawHand();
  const cards = session.hand.map(id => {
    const card = ALL_CARD_DEFINITIONS.find(c => c.id === id);
    const trait = cardAdventureProfile(card)?.node;
    return `<button class="advp-card" data-card="${esc(id)}" data-trait="${esc(trait)}">
      <span class="advp-card__glyph">${TRAIT_GLYPHS[trait] || '?'}</span>
      <span class="advp-card__name">${esc(CARD_NAME.get(id) || id)}</span>
      <span class="advp-card__trait">${esc(TRAIT_LABELS[trait] || trait)}</span>
    </button>`;
  }).join('');
  return `
    <div class="advp-stage">Stage ${run.stage + 1} of 8 · ${esc(descriptor.kind)}</div>
    <h1 class="advp-title">${esc(event.title)}${event.placeholder ? ' <span class="advp-flag">playtest placeholder</span>' : ''}</h1>
    <p class="advp-desc">${esc(event.description)}</p>
    ${warningBanner(run, event)}
    <div class="advp-conditions"><b>Conditions</b> ${statusChips(run)}</div>
    <div class="advp-inventory">${inventoryRow(run)}</div>
    <div class="advp-handlabel">Choose one card. Its Adventure trait is your answer — you will not see the exact outcome first.</div>
    <div class="advp-hand">${cards}</div>
    ${controlsBar()}
  `;
}

function renderChoice() {
  const { lastPacket } = session;
  const buttons = lastPacket.pendingChoices.map(choice => `
    <button class="advp-choice" data-choice="${esc(choice.id)}">
      <b>${esc(choice.label)}</b>
      <span>${esc(choice.description)}</span>
    </button>`).join('');
  return `
    <div class="advp-stage">Secondary choice · ${esc(lastPacket.traitLabel)}</div>
    <h1 class="advp-title">${esc(lastPacket.action || 'A supernatural choice')}</h1>
    <p class="advp-desc">The contact supports more than one substantial resolution. Choose how you answer it.</p>
    <div class="advp-choices">${buttons}</div>
    ${controlsBar()}
  `;
}

function renderResult() {
  const { lastPacket } = session;
  if (lastPacket.terminal) return renderTerminal();
  const lines = (lastPacket.consequenceLines || []).map(line => `<li>${esc(line)}</li>`).join('');
  const narrative = (lastPacket.narrative || []).map(p => `<p>${esc(p)}</p>`).join('');
  return `
    <div class="advp-stage">You answered with</div>
    <h1 class="advp-title">${TRAIT_GLYPHS[lastPacket.trait] || ''} ${esc(lastPacket.traitLabel)}${lastPacket.choiceLabel ? ' · ' + esc(lastPacket.choiceLabel) : ''}</h1>
    <div class="advp-narrative">${narrative}</div>
    ${lines ? `<ul class="advp-consequences">${lines}</ul>` : ''}
    <div class="advp-actions"><button class="advp-primary" data-action="continue">Continue</button></div>
    ${controlsBar()}
  `;
}

function renderTerminal() {
  const t = session.run.terminalEnding;
  const payload = buildFinalePayload(session.run);
  const causes = payload.causalSummary.slice(-4).map(c => `<li>${esc(c)}</li>`).join('');
  return `
    <div class="advp-stage advp-stage--end">Your journey ended</div>
    <h1 class="advp-title">${esc(t.title)}</h1>
    <div class="advp-narrative"><p>${esc(t.prose)}</p></div>
    <div class="advp-cause"><b>Activated by</b> ${esc(t.eventTitle)} · ${esc(TRAIT_LABELS[t.activatingTrait] || t.activatingTrait)}<br><b>The danger you carried</b> ${esc(warningForSource(t.warningSource) || t.warningSource)}</div>
    <ul class="advp-consequences">${causes}</ul>
    <div class="advp-actions"><button class="advp-primary" data-action="restart">New Journey</button></div>
    ${controlsBar()}
  `;
}

function renderRecovery() {
  const { descriptor } = session;
  const buttons = (descriptor.recoveryChoices || []).map(choice => `
    <button class="advp-choice" data-recovery="${esc(choice.id)}">
      <b>${esc(choice.label)}</b>
      <span>${esc(choice.description)}</span>
    </button>`).join('');
  return `
    <div class="advp-stage">Stage ${session.run.stage + 1} of 8 · recovery</div>
    <h1 class="advp-title">A Place to Rest</h1>
    <p class="advp-desc">${esc(getPilotEvent('recovery').description)}</p>
    <div class="advp-conditions"><b>Conditions</b> ${statusChips(session.run)}</div>
    <div class="advp-choices">${buttons}</div>
    ${controlsBar()}
  `;
}

function renderFinale() {
  const run = session.run;
  const p = buildFinalePayload(run);
  const section = (title, body) => `<div class="advp-fin-section"><h3>${esc(title)}</h3>${body}</div>`;
  const list = arr => arr.length ? `<ul>${arr.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : '<p class="advp-muted">—</p>';

  const identity = `<p>${esc(p.identity.sentence)}</p><p class="advp-muted">Echoes: ${p.identity.topEchoes.map(e => `${e.label} ×${e.value}`).join(', ') || 'none'}</p>`;
  const toll = list([
    `Strain: ${p.toll.strain}`,
    ...p.toll.dangerStatuses.map(s => `Dangerous status: ${PILOT_STATUSES[s]?.name || s}`),
    ...p.toll.obligations.map(o => `Obligation: ${o.replace(/_/g, ' ')}`),
  ]);
  const remains = list([
    ...p.remains.companions.map(c => `Companion: ${pilotNounName(c)}`),
    ...p.remains.items.filter(i => i !== 'provision').map(i => `Item: ${pilotNounName(i)}`),
    ...p.remains.materials.map(m => `Material: ${PILOT_MATERIALS[m]?.name || m}`),
    ...p.remains.allies.map(a => `Ally: ${a.replace(/_/g, ' ')}`),
    ...p.remains.witnesses.map(w => `Witness: ${w.replace(/_/g, ' ')}`),
  ]);
  const world = list([...p.world.lines, p.world.roadTruth].filter(Boolean));
  const hooks = list(p.finaleHooks);
  const summary = `<ol class="advp-summary">${p.causalSummary.map(c => `<li>${esc(c)}</li>`).join('')}</ol>`;

  const outcome = p.terminalEnding
    ? `<div class="advp-fin-banner advp-fin-banner--end">Journey ended: ${esc(p.terminalEnding.title)}</div>`
    : `<div class="advp-fin-banner">You reached the Woman in the Well. The final encounter is not part of this playtest.</div>`;

  return `
    <div class="advp-stage advp-stage--end">Temporary Finale Evaluation <span class="advp-flag">playtest instrument</span></div>
    ${outcome}
    ${section('Who the road made you', identity)}
    ${section('What the journey did to you', toll)}
    ${section('What remains with you', remains)}
    ${section('What changed in the world', world)}
    ${section('Active finale hooks', hooks)}
    ${section('Causal run summary', summary)}
    <div class="advp-actions"><button class="advp-primary" data-action="restart">New Journey</button></div>
    ${controlsBar()}
  `;
}

function historyPanel() {
  if (!session.showHistory) return '';
  const rows = session.run.eventHistory.map(e => `
    <div class="advp-hist-row">
      <b>${esc(e.eventTitle)}</b> — ${esc(e.traitLabel || e.choiceLabel || '—')}
      ${e.terminal ? ' <span class="advp-chip advp-chip--danger">ended</span>' : ''}
      <div class="advp-muted">${esc((e.consequenceLines || []).join(' · '))}</div>
    </div>`).join('');
  return `<div class="advp-panel"><h3>Run history</h3>${rows || '<p class="advp-muted">Nothing yet.</p>'}</div>`;
}

function debugPanel() {
  if (!session.showDebug) return '';
  const run = session.run;
  return `<div class="advp-panel advp-debug">
    <h3>Debug &amp; playtest (dev only)</h3>
    <div class="advp-debug-grid">
      <label>Seed <input id="advpDbgSeed" type="number" value="${esc(session.seed)}"></label>
      <button data-debug="reseed">Start with seed</button>
      <label>Force event
        <select id="advpDbgEvent">
          ${['iron_gate', 'ambush', 'cornered_beast', 'beast_after_pass', 'bandits_return', 'road_remembers', 'smoke_tollhouse', 'beast_kings_road', 'name_another_hand'].map(id => `<option value="${id}">${id}</option>`).join('')}
        </select>
      </label>
      <button data-debug="force">Force / replay event</button>
      <label>Strain
        <select id="advpDbgStrain">${['clear', 'spent', 'exhausted'].map(s => `<option${run.strain === s ? ' selected' : ''}>${s}</option>`).join('')}</select>
      </label>
      <button data-debug="setstrain">Set strain</button>
      <label>Status
        <select id="advpDbgStatus">${Object.keys(PILOT_STATUSES).map(s => `<option>${s}</option>`).join('')}</select>
      </label>
      <button data-debug="addstatus">Add</button>
      <button data-debug="delstatus">Remove</button>
      <label>Material
        <select id="advpDbgMat">${Object.keys(PILOT_MATERIALS).map(m => `<option>${m}</option>`).join('')}</select>
      </label>
      <button data-debug="addmat">Add material</button>
      <label>Grant
        <select id="advpDbgGrant"><option value="companion:greyfang">Greyfang</option><option value="item:healing_salve">Healing Salve</option><option value="item:soldiers_insignia">Soldier's Insignia</option><option value="item:gatekeepers_ring">Gatekeeper's Ring</option><option value="item:road_token">Road Token</option><option value="item:smoke_cloth_cloak">Smoke-Cloth Cloak</option></select>
      </label>
      <button data-debug="grant">Grant</button>
      <label>Memory
        <select id="advpDbgMem"><option value="beast.fate:loose">beast loose</option><option value="beast.fate:cursed">beast cursed</option><option value="beast.responsibility:helped">beast helped</option><option value="bandits.relation:hunting">bandits hunting</option><option value="bandits.state:divided">bandits divided</option><option value="roadOutcome:keeper">road keeper</option><option value="roadTrapEvidence:2">evidence 2</option><option value="stolenBelonging:pack">belonging lost</option><option value="fire:active">fire active</option></select>
      </label>
      <button data-debug="setmem">Set memory</button>
      <label>Thread
        <select id="advpDbgThread"><option>beast_after_pass</option><option>bandits_return</option><option>road_remembers</option><option>roadside_fire</option><option>stolen_belonging</option><option>cursed_beast</option><option>false_identity</option></select>
      </label>
      <button data-debug="addthread">Activate thread</button>
      <label>Jump
        <select id="advpDbgJump"><option value="recovery">recovery</option><option value="followup">follow-up</option><option value="convergence">convergence</option><option value="finale">finale</option></select>
      </label>
      <button data-debug="jump">Jump to</button>
      <button data-debug="inspect">Inspect last packet</button>
    </div>
    <pre class="advp-debug-out" id="advpDbgOut">${esc(JSON.stringify({ stage: run.stage, strain: run.strain, statuses: run.statuses, memories: run.memories, threads: run.threads.map(t => `${t.id}:${t.urgency}`) }, null, 1))}</pre>
  </div>`;
}

function controlsBar() {
  return `<div class="advp-controls">
    <button data-toggle="history">${session.showHistory ? 'Hide' : 'Show'} history</button>
    <button data-toggle="debug">${session.showDebug ? 'Hide' : 'Show'} debug</button>
    <button data-action="close">Exit pilot</button>
  </div>${historyPanel()}${debugPanel()}`;
}

function render() {
  const doc = document;
  const root = ensureRoot(doc);
  let inner = '';
  switch (session.phase) {
    case 'event': inner = renderEvent(); break;
    case 'choice': inner = renderChoice(); break;
    case 'result': inner = renderResult(); break;
    case 'recovery': inner = renderRecovery(); break;
    case 'finale': inner = renderFinale(); break;
    default: inner = renderEvent();
  }
  root.innerHTML = `<div class="advp-shell">${inner}</div>`;
  root.style.display = 'block';
}

// ---------------------------------------------------------------------------
// Flow control
// ---------------------------------------------------------------------------
function enterCurrent() {
  const d = session.descriptor;
  if (d.isFinale) { session.phase = 'finale'; return; }
  if (d.isRecovery) { session.phase = 'recovery'; return; }
  session.hand = [];
  session.phase = 'event';
}

function commitCard(cardId, trait) {
  const s = session;
  const event = s.descriptor.event;
  // Move the played card to the used pile (persistent card-use economy).
  s.deck = s.deck.filter(id => id !== cardId);
  if (!s.used.includes(cardId)) s.used.push(cardId);
  const packet = resolveCurrent(s.run, event, ALL_CARD_DEFINITIONS.find(c => c.id === cardId), trait);
  s.lastPacket = packet;
  s.pendingEvent = event;
  s.pendingTrait = trait;
  if (packet.pendingChoices) { s.phase = 'choice'; render(); return; }
  applyResolution(s.run, event, packet);
  s.phase = 'result';
  render();
}

function commitChoice(choiceId) {
  const s = session;
  const packet = resolveChoice(s.run, s.pendingEvent, s.pendingTrait, choiceId);
  s.lastPacket = packet;
  applyResolution(s.run, s.pendingEvent, packet);
  s.phase = 'result';
  render();
}

function continueRun() {
  const s = session;
  if (s.run.finished) { s.phase = 'finale'; render(); return; }
  s.descriptor = advanceStage(s.run);
  enterCurrent();
  render();
}

function commitRecovery(choiceId) {
  const s = session;
  const choice = (s.descriptor.recoveryChoices || []).find(c => c.id === choiceId);
  if (choice) applyRecovery(s.run, choice);
  s.descriptor = advanceStage(s.run);
  enterCurrent();
  render();
}

// ---------------------------------------------------------------------------
// Debug helpers
// ---------------------------------------------------------------------------
function handleDebug(action, root) {
  const s = session;
  const run = s.run;
  const val = id => root.querySelector(id)?.value;
  switch (action) {
    case 'reseed': start({ seed: Number(val('#advpDbgSeed')) || 1 }); return;
    case 'force': {
      const id = val('#advpDbgEvent');
      const event = getPilotEvent(id);
      if (event) { s.descriptor = { event, kind: event.kind, isRecovery: false, isFinale: false, placeholder: false }; run.currentEventId = id; s.hand = []; s.phase = 'event'; }
      break;
    }
    case 'setstrain': run.strain = val('#advpDbgStrain'); break;
    case 'addstatus': { const st = val('#advpDbgStatus'); if (!run.statuses.includes(st)) run.statuses.push(st); break; }
    case 'delstatus': { const st = val('#advpDbgStatus'); run.statuses = run.statuses.filter(x => x !== st); break; }
    case 'addmat': { const m = val('#advpDbgMat'); if (run.materials.length < 3) run.materials.push(m); break; }
    case 'grant': { const [kind, id] = val('#advpDbgGrant').split(':'); if (kind === 'companion') { if (!run.companions.includes(id)) run.companions.push(id); } else if (!run.items.includes(id)) run.items.push(id); break; }
    case 'setmem': {
      const [path, value] = val('#advpDbgMem').split(':');
      if (path.includes('.')) { const [f, k] = path.split('.'); run.memories[f] = { ...(run.memories[f] || {}), [k]: value }; }
      else run.memories[path] = path === 'roadTrapEvidence' ? Number(value) : value;
      break;
    }
    case 'addthread': { const id = val('#advpDbgThread'); if (!run.threads.some(t => t.id === id)) run.threads.push({ id, urgency: 'active', tags: ['debug'], data: {} }); break; }
    case 'jump': {
      const target = val('#advpDbgJump');
      if (target === 'finale') { run.finished = true; run.reachedDestination = true; s.phase = 'finale'; }
      else if (target === 'recovery') { s.descriptor = { event: getPilotEvent('recovery'), isRecovery: true, isFinale: false, kind: 'recovery', recoveryChoices: buildRecoveryChoices(run, 0.5) }; run.currentEventId = 'recovery'; s.phase = 'recovery'; }
      else { const map = { followup: 'beast_after_pass', convergence: 'smoke_tollhouse' }; const event = getPilotEvent(map[target]); s.descriptor = { event, kind: event.kind, isRecovery: false, isFinale: false }; run.currentEventId = event.id; s.hand = []; s.phase = 'event'; }
      break;
    }
    case 'inspect': { render(); const out = root.querySelector('#advpDbgOut'); if (out) out.textContent = JSON.stringify(s.lastPacket || { note: 'no packet yet' }, null, 1); return; }
    default: break;
  }
  render();
}

// ---------------------------------------------------------------------------
// Event delegation
// ---------------------------------------------------------------------------
function onClick(ev) {
  const root = document.getElementById(ROOT_ID);
  if (!root || root.style.display === 'none') return;
  const target = ev.target.closest('[data-card],[data-choice],[data-recovery],[data-action],[data-toggle],[data-debug]');
  if (!target || !root.contains(target)) return;
  ev.preventDefault();
  if (target.dataset.card) return commitCard(target.dataset.card, target.dataset.trait);
  if (target.dataset.choice) return commitChoice(target.dataset.choice);
  if (target.dataset.recovery) return commitRecovery(target.dataset.recovery);
  if (target.dataset.toggle === 'history') { session.showHistory = !session.showHistory; return render(); }
  if (target.dataset.toggle === 'debug') { session.showDebug = !session.showDebug; return render(); }
  if (target.dataset.debug) return handleDebug(target.dataset.debug, root);
  if (target.dataset.action === 'continue') return continueRun();
  if (target.dataset.action === 'restart') return start({ seed: (session.seed + 1) >>> 0 });
  if (target.dataset.action === 'close') return close();
}

// ---------------------------------------------------------------------------
// Public entry
// ---------------------------------------------------------------------------
export function start({ seed } = {}) {
  const chosen = Number.isFinite(seed) ? (seed >>> 0) : (Date.now() % 100000);
  session = newSession(chosen);
  enterCurrent();
  render();
}

export function close() {
  const root = document.getElementById(ROOT_ID);
  if (root) root.style.display = 'none';
  if (location.hash === '#adv-pilot') history.replaceState(null, '', location.pathname + location.search);
}

let installed = false;
export function installAdventurePilotMode(target = window) {
  if (installed) return;
  installed = true;
  document.addEventListener('click', onClick, true);
  target.__tlrAdventurePilot = { start, close };
  const maybeOpen = () => {
    if (location.hash === '#adv-pilot' && (!session || document.getElementById(ROOT_ID)?.style.display === 'none')) {
      start({ seed: undefined });
    }
  };
  window.addEventListener('hashchange', maybeOpen);
  maybeOpen();
}

const STYLES = `
#${ROOT_ID}{position:fixed;inset:0;z-index:9999;overflow:auto;background:#120d18;color:#ece6da;font-family:Georgia,'Times New Roman',serif;display:none;}
#${ROOT_ID} .advp-shell{max-width:760px;margin:0 auto;padding:28px 20px 80px;}
#${ROOT_ID} h1,#${ROOT_ID} h3{font-family:'Trajan Pro',Georgia,serif;}
#${ROOT_ID} .advp-stage{letter-spacing:.16em;text-transform:uppercase;font-size:12px;color:#b79a63;margin-bottom:6px;}
#${ROOT_ID} .advp-stage--end{color:#d98b6a;}
#${ROOT_ID} .advp-title{font-size:30px;margin:0 0 12px;color:#f2e7cf;}
#${ROOT_ID} .advp-flag{font-size:11px;letter-spacing:.1em;background:#3a2b12;color:#e7c987;padding:2px 6px;border-radius:4px;vertical-align:middle;}
#${ROOT_ID} .advp-desc{font-size:17px;line-height:1.55;color:#d8cfbe;}
#${ROOT_ID} .advp-warn{background:#3a1e1e;border:1px solid #7a3b34;border-radius:8px;padding:10px 12px;margin:12px 0;color:#f0c9b6;font-size:14px;}
#${ROOT_ID} .advp-conditions,#${ROOT_ID} .advp-inventory{margin:10px 0;font-size:14px;}
#${ROOT_ID} .advp-inv{margin:3px 0;color:#cdc3b0;}
#${ROOT_ID} .advp-inv b{color:#b79a63;font-weight:normal;letter-spacing:.05em;}
#${ROOT_ID} .advp-chip{display:inline-block;background:#26202e;border:1px solid #40364c;border-radius:12px;padding:2px 9px;margin:2px 4px 2px 0;font-size:13px;}
#${ROOT_ID} .advp-chip--danger{background:#3a1e1e;border-color:#7a3b34;color:#f0b8a6;}
#${ROOT_ID} .advp-chip--strain{background:#2a2416;border-color:#5a4a24;color:#e7c987;}
#${ROOT_ID} .advp-muted{color:#8b8375;}
#${ROOT_ID} .advp-handlabel{margin:18px 0 8px;color:#b79a63;font-size:14px;}
#${ROOT_ID} .advp-hand{display:flex;flex-wrap:wrap;gap:10px;}
#${ROOT_ID} .advp-card{flex:1 1 120px;min-width:120px;background:linear-gradient(#211a2b,#171021);border:1px solid #4a3d5c;border-radius:10px;padding:12px 8px;color:#ece6da;cursor:pointer;text-align:center;transition:.12s;}
#${ROOT_ID} .advp-card:hover{border-color:#b79a63;transform:translateY(-2px);}
#${ROOT_ID} .advp-card__glyph{display:block;font-size:24px;margin-bottom:6px;}
#${ROOT_ID} .advp-card__name{display:block;font-size:14px;}
#${ROOT_ID} .advp-card__trait{display:block;font-size:12px;color:#b79a63;letter-spacing:.05em;margin-top:2px;}
#${ROOT_ID} .advp-choices{display:flex;flex-direction:column;gap:10px;margin-top:14px;}
#${ROOT_ID} .advp-choice{background:#1b1526;border:1px solid #4a3d5c;border-radius:8px;padding:12px 14px;text-align:left;color:#ece6da;cursor:pointer;}
#${ROOT_ID} .advp-choice:hover{border-color:#b79a63;}
#${ROOT_ID} .advp-choice b{display:block;font-size:16px;margin-bottom:3px;color:#f2e7cf;}
#${ROOT_ID} .advp-choice span{font-size:13px;color:#b3a993;}
#${ROOT_ID} .advp-narrative p{font-size:18px;line-height:1.6;color:#e6ddca;}
#${ROOT_ID} .advp-consequences{list-style:none;padding:0;margin:14px 0;}
#${ROOT_ID} .advp-consequences li{padding:8px 12px;background:#1b1526;border-left:3px solid #b79a63;margin-bottom:6px;border-radius:0 6px 6px 0;font-size:15px;}
#${ROOT_ID} .advp-cause{background:#1b1526;border:1px solid #40364c;border-radius:8px;padding:10px 12px;margin:10px 0;font-size:14px;color:#cdc3b0;}
#${ROOT_ID} .advp-actions{margin:22px 0;}
#${ROOT_ID} .advp-primary{background:#b79a63;color:#1a1220;border:none;border-radius:8px;padding:12px 26px;font-size:16px;font-family:inherit;cursor:pointer;}
#${ROOT_ID} .advp-primary:hover{background:#d0b578;}
#${ROOT_ID} .advp-controls{margin-top:28px;padding-top:14px;border-top:1px solid #2c2436;display:flex;gap:8px;flex-wrap:wrap;}
#${ROOT_ID} .advp-controls button{background:#221a2e;border:1px solid #40364c;color:#b3a993;border-radius:6px;padding:7px 12px;font-size:13px;cursor:pointer;font-family:inherit;}
#${ROOT_ID} .advp-panel{margin-top:14px;background:#160f20;border:1px solid #2c2436;border-radius:8px;padding:12px 14px;}
#${ROOT_ID} .advp-panel h3{margin:0 0 8px;color:#b79a63;font-size:15px;}
#${ROOT_ID} .advp-hist-row{padding:6px 0;border-bottom:1px solid #241d31;font-size:14px;}
#${ROOT_ID} .advp-fin-banner{background:#1d2a1d;border:1px solid #3f6b3f;border-radius:8px;padding:12px;margin:12px 0;color:#bfe0bf;}
#${ROOT_ID} .advp-fin-banner--end{background:#3a1e1e;border-color:#7a3b34;color:#f0c9b6;}
#${ROOT_ID} .advp-fin-section{margin:14px 0;}
#${ROOT_ID} .advp-fin-section h3{color:#b79a63;font-size:15px;border-bottom:1px solid #2c2436;padding-bottom:4px;}
#${ROOT_ID} .advp-summary li,#${ROOT_ID} .advp-fin-section li{font-size:14px;line-height:1.5;margin:3px 0;}
#${ROOT_ID} .advp-debug-grid{display:grid;grid-template-columns:1fr auto;gap:6px 8px;align-items:center;font-size:13px;}
#${ROOT_ID} .advp-debug-grid label{display:flex;gap:6px;align-items:center;color:#b3a993;}
#${ROOT_ID} .advp-debug-grid input,#${ROOT_ID} .advp-debug-grid select{background:#0f0a17;border:1px solid #40364c;color:#ece6da;border-radius:4px;padding:3px 6px;flex:1;}
#${ROOT_ID} .advp-debug-grid button{background:#2a2136;border:1px solid #4a3d5c;color:#d0c6b2;border-radius:5px;padding:4px 8px;cursor:pointer;font-size:12px;}
#${ROOT_ID} .advp-debug-out{background:#0c0812;border:1px solid #2c2436;border-radius:6px;padding:8px;margin-top:10px;max-height:220px;overflow:auto;font-size:11px;color:#9fd0a0;white-space:pre-wrap;}
`;
