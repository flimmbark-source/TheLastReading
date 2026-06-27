// Adventure Mode V3 — visible card sigils, stratified rewards, and one shared
// carried-item inventory backed by the game's existing relic-slot capacity.

import { installGeneratedSheetAssets } from '../ui/generatedSheetAssets.mjs';
import { createInitialPersist, createInitialState } from './runtimeState.mjs';
import { ALL_CARD_DEFINITIONS } from '../data/cards.mjs';
import { getStatus } from '../data/adventure/statuses.mjs';
import { EVENT_TRAITS } from '../data/adventure/events.mjs';
import { getEventApproaches } from '../data/adventure/eventApproaches.mjs';
import { cardAdventureProfile } from '../data/adventure/cardNodes.mjs';
import { sigilForNode, sigilName } from '../data/adventure/sigils.mjs';
import {
  ADVENTURE_EVENTS_V3,
  RECOVERY_EVENT_V3,
  ADVENTURE_ITEMS,
  CONSUMABLE_LIST,
  PASSIVE_ITEM_LIST,
  getAdventureEventV3,
  getOutcomeRewardProfile,
} from '../data/adventure/adventureContentV3.mjs';
import { NODE_GRAPH } from '../data/adventure/nodes.mjs';
import { routeNode } from '../systems/adventure/nodeGraph.mjs';
import {
  EVENTS_PER_SET,
  TOTAL_SETS,
  createSingleCardRunState,
  addCardToAdventureDeck,
  removeCardFromAdventureDeck,
  recordSingleCardPlay,
  isCurrentSetComplete,
  completeCurrentSet,
  beginNextSet,
  isAdventureRunComplete,
  setEchoText,
} from '../systems/adventure/singleCardRun.mjs';
import { applyResolution, clampResolve } from '../systems/adventure/run.mjs';

const STYLE_ID = 'adventure-mode-v3-style';
const MODE_CLASS = 'mode-adventure';
const TABLE_CLASSES = ['single-player-v2', 'generated-sheet-ready', 'mode-reading'];
const CARD_BY_ID = new Map(ALL_CARD_DEFINITIONS.map(card => [card.id, card]));
const EVENT_ART_BASE = '/public/ui/single-player-v2/events/';
const EVENT_ART_IDS = new Set(ADVENTURE_EVENTS_V3.map(event => event.id));
const RESULT = Object.freeze({ FAILURE: 'failure', SUCCESS: 'success', GREAT_SUCCESS: 'great_success' });

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, ch => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]
  ));
}

function eventArtUrl(id) {
  return EVENT_ART_IDS.has(id) ? `${EVENT_ART_BASE}${id}.webp` : null;
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function ensureStyles(doc) {
  if (!doc) return;
  doc.getElementById(STYLE_ID)?.remove();
  const style = doc.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    body.mode-adventure .score-stack,
    body.mode-adventure #constellationPill{display:none!important}
    body.mode-adventure #scoringPullWrap.open{transform:translateY(calc(-1 * var(--tlr-drawer-h)))!important}

    #advApproachWeb{position:fixed;top:80px;left:10px;z-index:30;background:#16100d;border:1px solid #5f4c29;border-radius:8px;
      padding:10px 14px 12px;box-shadow:0 12px 34px rgba(0,0,0,.65);max-width:min(360px,90vw);display:none}
    body.mode-adventure #advApproachWeb{display:block}
    #advApproachWeb.hidden{display:none!important}
    .adv-web-title{font:800 10px system-ui,sans-serif;letter-spacing:.1em;text-transform:uppercase;
      color:#cdb883;margin-bottom:4px;text-align:center}
    .adv-web-approaches{margin-top:8px;display:flex;flex-direction:column;gap:4px;
      border-top:1px solid rgba(95,76,41,.4);padding-top:6px}
    .adv-web-row{display:flex;justify-content:space-between;align-items:center;padding:1px 0}
    .adv-web-sigil{color:#f3c969;font:600 12px Georgia,serif}
    .adv-web-req{font:700 9px system-ui,sans-serif;color:#9a8060;letter-spacing:.05em}
    .adv-approach-btn{background:transparent;border:1px solid rgba(228,188,111,.38);color:#cdb883;
      font:700 9px/1 system-ui,sans-serif;letter-spacing:.1em;text-transform:uppercase;padding:4px 9px;
      border-radius:4px;cursor:pointer;flex-shrink:0;margin-left:auto}
    .adv-approach-btn:hover{border-color:#f3c969;color:#f3c969}

    #advEventDeck{position:fixed;top:48px;left:50%;transform:translateX(-50%);z-index:26;
      display:none;flex-direction:column;align-items:center;gap:0;pointer-events:none;
      font-family:Georgia,serif;color:#f2dfb8}
    body.mode-adventure #advEventDeck{display:flex}
    .adv-deck{position:relative;width:128px;height:170px}
    .adv-deck__back{position:absolute;width:96px;height:150px;border-radius:8px;left:50%;top:10px;
      background:linear-gradient(160deg,#3a2a1a,#160d07);border:1px solid rgba(228,188,111,.45);box-shadow:0 4px 10px rgba(0,0,0,.5)}
    .adv-deck__top{position:absolute;left:50%;top:0;transform:translateX(-50%);width:110px;height:170px;border-radius:10px;
      overflow:hidden;box-shadow:0 8px 22px rgba(0,0,0,.6),0 0 18px rgba(243,201,105,.18)}
    .adv-deck__art{display:block;width:100%;height:100%;object-fit:cover}
    .adv-deck__top--text{background:linear-gradient(165deg,#2a1810,#140907);border:2px solid #9a7842;
      display:flex;align-items:center;justify-content:center;text-align:center;padding:8px}
    .adv-deck__title{font:800 13px Georgia,serif;line-height:1.1;color:#f2dfb8}
    .adv-event-desc{max-width:310px;text-align:center;font:500 11px Georgia,serif;line-height:1.4;color:#d8c8a6;
      background:rgba(18,12,9,.66);border-radius:8px;padding:6px 10px;margin-top:-14px}
    .adv-next-event{font:700 9px system-ui,sans-serif;color:#d19c51;opacity:.9}
    .adv-event-hero__crest{position:absolute;z-index:4;left:11px;top:39px;padding:3px 8px;border-radius:999px;
      border:1px solid rgba(116,169,213,.48);background:rgba(16,40,64,.82);color:#b9dcf4;
      font:800 8px/1.2 system-ui,sans-serif;letter-spacing:.08em;text-transform:uppercase}

    #advHud{position:fixed;top:10px;left:10px;z-index:42;display:none;flex-direction:column;gap:6px;
      color:#ead9b5;max-width:min(360px,46vw)}
    body.mode-adventure #advHud{display:flex}
    .adv-hud__main{display:flex;align-items:center;gap:11px;background:linear-gradient(180deg,rgba(30,21,13,.93),rgba(17,11,7,.92));
      border:1px solid rgba(228,188,111,.34);border-radius:12px;padding:7px 11px;
      box-shadow:0 6px 18px rgba(0,0,0,.55),inset 0 1px 0 rgba(255,225,170,.07)}
    .adv-hud__resolve{display:flex;align-items:center;gap:8px}
    .adv-hud__label{font:800 9px/1 'Cinzel',Georgia,serif;letter-spacing:.17em;text-transform:uppercase;color:#bd9c63}
    .adv-pips{display:flex;gap:3px}.adv-pip{width:10px;height:10px;border-radius:50%;border:1px solid rgba(243,201,105,.45)}
    .adv-pip--full{background:radial-gradient(circle at 38% 32%,#ffeab2,#dd9f33);border-color:#f3c969;box-shadow:0 0 6px rgba(243,201,105,.55)}
    .adv-pip--empty{background:rgba(243,201,105,.05)}
    .adv-hud__statuses{display:flex;flex-wrap:wrap;gap:5px;padding-left:2px}.adv-hud__statuses:empty{display:none}
    #advHud .adv-status{display:inline-flex;align-items:center;gap:6px;border-radius:999px;padding:3px 10px 3px 8px;
      font:700 10px/1 'Cinzel',Georgia,serif;letter-spacing:.05em;border:1px solid;background:rgba(16,11,7,.82)}
    #advHud .adv-status::before{content:'';width:7px;height:7px;border-radius:50%}
    .adv-status--blessed{color:#f6d488;border-color:rgba(243,201,105,.5)}.adv-status--blessed::before{background:#f3c969;box-shadow:0 0 6px #f3c969}
    .adv-status--haunted{color:#c7adef;border-color:rgba(169,139,214,.5)}.adv-status--haunted::before{background:#a98bd6;box-shadow:0 0 6px #a98bd6}
    .adv-status--prepared{color:#9fcdf2;border-color:rgba(127,182,224,.5)}.adv-status--prepared::before{background:#7fb6e0;box-shadow:0 0 6px #7fb6e0}
    .adv-status--distrusted{color:#e89e96;border-color:rgba(210,104,95,.5)}.adv-status--distrusted::before{background:#d2685f;box-shadow:0 0 6px #d2685f}
    .adv-status--exposed{color:#f0b078;border-color:rgba(224,154,90,.5)}.adv-status--exposed::before{background:#e09a5a;box-shadow:0 0 6px #e09a5a}

    body.mode-adventure .adv-sigil-seal{display:flex!important;position:absolute;width:19px;height:19px;top:7px;left:7px;border-radius:50%;z-index:5;
      align-items:center;justify-content:center;color:#d9edff;font:900 11px/1 Georgia,serif;
      background:radial-gradient(circle at 34% 30%,#4d9bd4 0%,#1c5f98 46%,#0a3159 76%,#061c35 100%);
      border:1px solid rgba(164,215,247,.72);box-shadow:0 1px 3px #000,inset 0 0 0 1px rgba(255,255,255,.12),0 0 5px rgba(60,142,205,.45)}
    body.mode-adventure .adv-sigil-seal::after{content:'';position:absolute;inset:2px;border:1px solid rgba(214,239,255,.19);border-radius:50%}
    .adv-card-bonus{position:absolute;left:7px;top:29px;z-index:6;padding:1px 4px;border-radius:8px;background:#1b6330;color:#d9ffe2;
      font:900 8px/1.2 system-ui,sans-serif;box-shadow:0 1px 3px #000}

    body.mode-adventure #relicRack.adv-inventory-rack{display:flex!important;gap:7px;align-items:center;justify-content:center;pointer-events:auto}
    .adv-inventory-slot{position:relative;width:44px;height:44px;border-radius:9px;border:1px solid rgba(127,182,224,.42);
      background:linear-gradient(180deg,rgba(24,44,63,.92),rgba(10,23,35,.94));box-shadow:0 4px 12px rgba(0,0,0,.5);color:#d9edff;
      display:flex;align-items:center;justify-content:center;cursor:pointer;padding:3px;text-align:center}
    .adv-inventory-slot--empty{opacity:.35;cursor:default}.adv-inventory-icon{font:900 11px/1 Georgia,serif;max-width:38px;overflow:hidden}
    .adv-inventory-kind{position:absolute;right:2px;bottom:2px;font:900 7px/1 system-ui,sans-serif;color:#80bce7;text-transform:uppercase}
    .adv-inventory-ready{position:absolute;left:-3px;top:-5px;padding:2px 4px;border-radius:8px;background:#d7a72e;color:#241606;font:900 7px/1 system-ui,sans-serif}
    .adv-inventory-armed{outline:2px solid #7fc7ff;box-shadow:0 0 12px rgba(80,173,238,.8)}

    .adv-narrative{line-height:1.5;font-size:15px;color:#e6d6b4;margin:8px 0 4px;text-align:center}
    .adv-played-card{text-align:center;color:#a99878;font:700 11px system-ui,sans-serif;letter-spacing:.04em;text-transform:uppercase}
    .adv-statuschg{font:700 12px system-ui,sans-serif;letter-spacing:.04em;text-transform:uppercase;text-align:center;margin-top:4px}
    .adv-statuschg--gain{color:#f3c969}.adv-statuschg--lose{color:#b6a07a}
    .adv-rewards{display:flex;gap:10px;flex-wrap:wrap;justify-content:center;margin:6px 0}
    .adv-reward{position:relative;flex:1 1 150px;min-width:140px;border:1px solid rgba(228,188,111,.4);border-radius:10px;padding:13px;cursor:pointer;
      background:rgba(255,255,255,.03);text-align:center;font:700 13px system-ui,sans-serif;color:#eadbb9}
    .adv-reward:hover{border-color:#f3c969}.adv-reward--picked{border-color:#9fd17f;background:rgba(159,209,127,.12)}
    .adv-reward--disabled{opacity:.35;pointer-events:none}.adv-reward__name{font-weight:900}.adv-reward__desc{margin-top:5px;color:#bfae8d;font-size:11px;line-height:1.3}
    .adv-reward-tools{display:flex;gap:6px;justify-content:center;flex-wrap:wrap;margin:8px 0}.adv-mini-btn{font-size:10px;padding:5px 8px}
    .adv-offer-tabs{display:flex;justify-content:center;gap:6px;margin:5px 0 8px}.adv-offer-tabs button[aria-pressed="true"]{border-color:#f3c969;color:#f3c969}

    @media(max-width:640px){
      #advEventDeck{top:20px}.adv-event-desc{max-width:245px;font-size:10px}#advHud{max-width:64vw}.adv-hud__main{padding:6px 9px}
      .adv-deck{transform:scale(.92);transform-origin:top center}.adv-inventory-slot{width:39px;height:39px}.adv-inventory-icon{font-size:9px}
    }
  `;
  doc.head.appendChild(style);
}

export function installAdventureModeV3(target = window) {
  if (!target || target.__tlrAdventureV3Installed) return;
  target.__tlrAdventureV3Installed = true;
  const doc = target.document;
  const rng = () => (target.__tlrAdvRng || Math.random)();
  let session = null;
  let liveBackup = null;
  let cardHtmlOriginal = null;
  let clickPreviewInstalled = false;

  function setBusy(value) {
    if (target.state) target.state.busy = value;
    if (target.tlrStore && target.tlrActions) target.tlrStore.dispatch({ type: target.tlrActions.SET_BUSY, busy: value });
  }

  function captureLiveBackupOnce() {
    if (liveBackup) return;
    liveBackup = {
      persist: target.persist,
      state: target.state,
      runtimePersist: target.tlrRuntime?.persist,
      runtimeState: target.tlrRuntime?.state,
      storePersist: target.tlrStore?.getState?.().persist || null,
      storeRun: target.tlrStore?.getState?.().run || null,
    };
  }

  function installFreshProfile() {
    target.persist = createInitialPersist();
    target.state = createInitialState();
    if (target.tlrRuntime) {
      target.tlrRuntime.persist = target.persist;
      target.tlrRuntime.state = target.state;
    }
  }

  function restoreLiveBackup() {
    if (!liveBackup) return;
    target.persist = liveBackup.persist;
    target.state = liveBackup.state;
    if (target.tlrRuntime) {
      target.tlrRuntime.persist = liveBackup.runtimePersist || liveBackup.persist;
      target.tlrRuntime.state = liveBackup.runtimeState || liveBackup.state;
    }
    if (target.tlrStore && target.tlrActions) {
      if (liveBackup.storePersist) target.tlrStore.dispatch({ type: target.tlrActions.SYNC_LEGACY_PERSIST, persist: liveBackup.storePersist });
      if (liveBackup.storeRun) target.tlrStore.dispatch({ type: target.tlrActions.SYNC_LEGACY_RUN, run: liveBackup.storeRun });
    }
    liveBackup = null;
  }

  function inventoryCapacity() {
    const slots = Number(typeof target.relicSlots === 'function' ? target.relicSlots() : 3);
    return Number.isFinite(slots) && slots > 0 ? Math.floor(slots) : 3;
  }

  function initialiseRun(run) {
    run.inventory = [];
    run.inventoryCapacity = inventoryCapacity();
    run.cardBonuses = {};
    run.sigilOverrides = {};
    run.revealedEventCount = 0;
    run.itemState = {
      usedSet: {},
      armedItem: null,
      nextCardBonus: 0,
      preventNextResolveLoss: false,
      preventNextHaunted: false,
      greyfang: 0,
      greyfangReady: false,
      freedSpirit: 0,
      freedSpiritReady: false,
      riverwatch: 0,
    };
    return run;
  }

  function itemState() {
    return session?.run?.itemState || {};
  }

  function inventory() {
    return session?.run?.inventory || [];
  }

  function hasItem(id) {
    return inventory().includes(id);
  }

  function itemAt(index) {
    const id = inventory()[index];
    return id ? ADVENTURE_ITEMS[id] : null;
  }

  function removeInventoryIndex(index) {
    if (!session || index < 0 || index >= session.run.inventory.length) return null;
    const [removed] = session.run.inventory.splice(index, 1);
    renderInventory();
    return removed || null;
  }

  function removeInventoryItem(id) {
    const index = inventory().indexOf(id);
    return index >= 0 ? removeInventoryIndex(index) : null;
  }

  function forceTable() {
    if (!doc || !session) return;
    const body = doc.body;
    body.classList.remove('mp-game-active', 'mode-attic', 'mode-to-attic', 'mode-to-table', 'mode-table-return', 'mode-return-hard-hide');
    session.addedClasses = [];
    for (const cls of [...TABLE_CLASSES, MODE_CLASS]) {
      if (!body.classList.contains(cls)) { body.classList.add(cls); session.addedClasses.push(cls); }
    }
    for (const [id, cls] of [['mpGame', 'mp-hidden'], ['loadoutScreen', 'loadout-hidden'], ['matchmakingScreen', 'mm-screen-hidden']]) {
      doc.getElementById(id)?.classList.add(cls);
    }
    doc.getElementById('atticScene')?.setAttribute('aria-hidden', 'true');
    try { if (target.Image) installGeneratedSheetAssets(target); } catch { }
  }

  function ensureChrome() {
    if (!doc) return;
    if (!doc.getElementById('advEventDeck')) {
      const deck = doc.createElement('div');
      deck.id = 'advEventDeck';
      doc.body.appendChild(deck);
    }
    if (!doc.getElementById('advHud')) {
      const hud = doc.createElement('div');
      hud.id = 'advHud';
      doc.body.appendChild(hud);
    }
  }

  function currentEvent() {
    if (!session) return null;
    return getAdventureEventV3(session.run.eventDeck[session.run.eventIndexInSet]);
  }

  function remainingEventIds() {
    if (!session) return [];
    return session.run.eventDeck.slice(session.run.eventIndexInSet + 1);
  }

  function decorateHero() {
    const deck = doc?.getElementById('advEventDeck');
    const hero = deck?.querySelector('.adv-event-hero');
    const crest = deck?.dataset.eventCrest;
    if (!hero || !crest || hero.querySelector('.adv-event-hero__crest')) return;
    const badge = doc.createElement('div');
    badge.className = 'adv-event-hero__crest';
    badge.textContent = crest;
    hero.appendChild(badge);
  }

  function updateChrome() {
    if (!doc || !session) return;
    const run = session.run;
    const event = currentEvent();
    const deck = doc.getElementById('advEventDeck');
    if (deck) {
      deck.dataset.eventId = event?.id || '';
      deck.dataset.eventCrest = event?.crest || '';
      if (!event) deck.innerHTML = '';
      else {
        const remaining = Math.max(1, EVENTS_PER_SET - run.eventIndexInSet);
        const backs = [...Array(Math.min(3, remaining)).keys()]
          .map(i => `<div class="adv-deck__back" style="transform:translate(calc(-50% + ${i * 4}px),${i * 3}px) rotate(${i * 2 - 2}deg)"></div>`)
          .join('');
        const revealCount = Math.max(run.statuses.includes('prepared') ? 1 : 0, run.revealedEventCount || 0);
        const revealed = remainingEventIds().slice(0, revealCount).map(id => getAdventureEventV3(id)?.title || id.replaceAll('_', ' '));
        const next = revealed.length ? `<div class="adv-next-event">Next: ${esc(revealed.join(' · '))}</div>` : '';
        const art = eventArtUrl(event.id);
        const top = art
          ? `<div class="adv-deck__top"><img class="adv-deck__art" src="${art}" alt="${esc(event.title)}" decoding="async"></div>`
          : `<div class="adv-deck__top adv-deck__top--text"><div class="adv-deck__title">${esc(event.title)}</div></div>`;
        deck.innerHTML = `<div class="adv-deck">${backs}${top}</div><div class="adv-event-desc">${esc(event.description)}</div>${next}`;
        setTimeout(decorateHero, 0);
      }
    }

    const hud = doc.getElementById('advHud');
    if (hud) {
      const pips = [...Array(Math.max(0, run.maxResolve)).keys()]
        .map(i => `<span class="adv-pip adv-pip--${i < run.resolve ? 'full' : 'empty'}"></span>`).join('');
      const statuses = run.statuses.map(id => `<span class="adv-status adv-status--${esc(id)}" title="${esc(getStatus(id)?.description || '')}">${esc(getStatus(id)?.name || id)}</span>`).join('');
      hud.innerHTML = `<div class="adv-hud__main"><div class="adv-hud__resolve"><span class="adv-hud__label">Resolve</span><span class="adv-pips" title="Resolve ${run.resolve} / ${run.maxResolve}">${pips}</span></div></div><div class="adv-hud__statuses">${statuses}</div>`;
    }
    renderInventory();
    setTimeout(decorateCards, 0);
    const web = doc.getElementById('advApproachWeb');
    if (web && !web.classList.contains('hidden')) web.innerHTML = renderApproachWebHTML();
  }

  function show(html) {
    if (typeof target.showOverlay === 'function') target.showOverlay(html);
    else {
      const summary = doc.getElementById('summary');
      if (summary) { summary.className = 'modal show'; summary.innerHTML = html; }
    }
  }

  function clear() {
    if (typeof target.clearOverlay === 'function') target.clearOverlay();
    else {
      const summary = doc.getElementById('summary');
      if (summary) { summary.className = ''; summary.innerHTML = ''; }
    }
  }

  function toast(message) {
    if (typeof target.showToast === 'function') target.showToast(message);
  }

  function cardWithRunChanges(definition, uid) {
    const bonus = session?.run?.cardBonuses?.[definition.id] || 0;
    const override = session?.run?.sigilOverrides?.[definition.id] || null;
    return { ...definition, points: Math.min(5, Number(definition.points || 0) + bonus), adventureNodeOverride: override, uid };
  }

  function buildAdventureDeckCards() {
    return session.run.deck.map((id, uid) => cardWithRunChanges(CARD_BY_ID.get(id), uid)).filter(card => card?.id);
  }

  function cardNode(card) {
    return card?.adventureNodeOverride || session?.run?.sigilOverrides?.[card?.id] || cardAdventureProfile(card)?.node || null;
  }

  function sigilSeal(card) {
    const sigil = sigilForNode(cardNode(card));
    if (!sigil) return '';
    return `<div class="seal tl adv-sigil-seal" title="${esc(sigil.name)} Sigil" aria-label="${esc(sigil.name)} Sigil">${esc(sigil.glyph)}</div>`;
  }

  function installCardSigilBridge() {
    if (!target.cardHTML || cardHtmlOriginal) return;
    cardHtmlOriginal = target.cardHTML;
    target.cardHTML = function adventureCardHTML(card) {
      const base = cardHtmlOriginal(card);
      if (!target.__tlrAdventureActive || base.includes('adv-sigil-seal')) return base;
      return base.replace('<div class="art">', `<div class="art">${sigilSeal(card)}`);
    };
  }

  function findRuntimeCard(uid) {
    const all = [...(target.state?.hand || []), ...(target.state?.spread || []).filter(Boolean), ...(target.state?.deck || [])];
    return all.find(card => String(card.uid) === String(uid)) || null;
  }

  const NODES = Object.freeze({
    PHYSICAL: 'physical', AGGRESSION: 'aggression', PROTECTION: 'protection', ENDURANCE: 'endurance',
    COMPASSION: 'compassion', AUTHORITY: 'authority', MYSTERY: 'mystery', DECEPTION: 'deception',
    INVESTIGATION: 'investigation', TRANSFORMATION: 'transformation', CREATION: 'creation', FORTUNE: 'fortune',
  });

  function passivePotencyBonus(card, event) {
    const node = cardNode(card);
    let bonus = 0;
    if (hasItem('broken_chain') && [NODES.PHYSICAL, NODES.AGGRESSION].includes(node)) bonus += 1;
    if (hasItem('ferrymans_boots') && event.traits?.includes(EVENT_TRAITS.OBSTACLE)) bonus += 1;
    if (hasItem('hide_mantle') && event.traits?.includes(EVENT_TRAITS.HOSTILE) && [NODES.PROTECTION, NODES.ENDURANCE].includes(node)) bonus += 1;
    if (hasItem('black_iron_seal')) {
      if (node === NODES.AUTHORITY) bonus += 1;
      if (node === NODES.COMPASSION) bonus -= 1;
    }
    if (hasItem('warded_iron_nails') && event.traits?.includes(EVENT_TRAITS.SUPERNATURAL) && [NODES.PROTECTION, NODES.CREATION].includes(node)) bonus += 1;
    if (hasItem('silver_leaf') && session.run.statuses.includes('blessed') && [NODES.COMPASSION, NODES.MYSTERY].includes(node)) bonus += 1;
    return Math.max(-1, Math.min(2, bonus));
  }

  function nextCardBonus(card, event, { preview = false } = {}) {
    let bonus = passivePotencyBonus(card, event);
    if (itemState().nextCardBonus) bonus += itemState().nextCardBonus;
    if (hasItem('greyfang') && itemState().greyfangReady) bonus += 2;
    if (!preview) {
      if (itemState().nextCardBonus) itemState().nextCardBonus = 0;
      if (hasItem('greyfang') && itemState().greyfangReady) {
        itemState().greyfangReady = false;
        itemState().greyfang = 0;
      }
    }
    return bonus;
  }

  // Clockwise from top — arranged so most graph-adjacent nodes are circle-adjacent.
  const APPROACH_WEB_NODE_ORDER = ['physical','aggression','authority','protection','compassion','creation','fortune','transformation','endurance','investigation','mystery','deception'];

  function renderApproachWebHTML() {
    const event = currentEvent();
    if (!event) return '<p style="color:#e6d29a;padding:4px">No active event.</p>';
    const approaches = getEventApproaches(event);
    if (!approaches || !approaches.length) return '';
    const accepted = new Set(approaches.map(a => a.node));

    const W = 380, H = 380, CX = 190, CY = 190, R = 120, NR = 11;
    const LABEL_R = R + NR + 13;
    const pos = {};
    APPROACH_WEB_NODE_ORDER.forEach((node, i) => {
      const angle = (i / 12) * Math.PI * 2 - Math.PI / 2;
      pos[node] = { x: +(CX + R * Math.cos(angle)).toFixed(1), y: +(CY + R * Math.sin(angle)).toFixed(1) };
    });

    const seenEdges = new Set();
    let edgeSvg = '';
    for (const [a, neighbors] of Object.entries(NODE_GRAPH)) {
      for (const b of neighbors) {
        const key = a < b ? `${a}:${b}` : `${b}:${a}`;
        if (seenEdges.has(key)) continue;
        seenEdges.add(key);
        const pa = pos[a], pb = pos[b];
        if (!pa || !pb) continue;
        const bothAcc = accepted.has(a) && accepted.has(b);
        const eitherAcc = accepted.has(a) || accepted.has(b);
        // Colors chosen to be visible on both dark (#16100d) and parchment (drawer) backgrounds.
        const stroke = bothAcc ? '#f3c969' : eitherAcc ? 'rgba(243,175,60,.82)' : 'rgba(120,90,45,.55)';
        edgeSvg += `<line x1="${pa.x}" y1="${pa.y}" x2="${pb.x}" y2="${pb.y}" stroke="${stroke}" stroke-width="${bothAcc ? 2 : eitherAcc ? 1.5 : 1}"/>`;
      }
    }

    let nodesSvg = '';
    for (const node of APPROACH_WEB_NODE_ORDER) {
      const p = pos[node];
      const sigil = sigilForNode(node);
      const isAcc = accepted.has(node);
      const angle = Math.atan2(p.y - CY, p.x - CX);
      const lx = +(CX + LABEL_R * Math.cos(angle)).toFixed(1);
      const ly = +(CY + LABEL_R * Math.sin(angle)).toFixed(1);
      const dx = p.x - CX;
      const anchor = Math.abs(dx) < 18 ? 'middle' : dx > 0 ? 'start' : 'end';
      const textFill = isAcc ? '#f3c969' : 'rgba(200,180,140,.88)';
      nodesSvg += `<g>
        <circle cx="${p.x}" cy="${p.y}" r="${NR}" fill="${isAcc ? 'rgba(36,22,8,.97)' : 'rgba(22,13,7,.95)'}" stroke="${isAcc ? '#f3c969' : 'rgba(180,150,90,.55)'}" stroke-width="${isAcc ? 1.5 : 1}"/>
        <text x="${lx}" y="${ly}" text-anchor="${anchor}" dominant-baseline="middle" fill="${textFill}" stroke="rgba(18,10,4,.8)" stroke-width="3" paint-order="stroke" font-size="10" font-weight="${isAcc ? 700 : 400}" font-family="system-ui,sans-serif">${esc(sigil?.name || node)}</text>
      </g>`;
    }

    const svg = `<svg viewBox="0 0 ${W} ${H}" style="width:${W}px;max-width:100%;height:auto;display:block;margin:0 auto" xmlns="http://www.w3.org/2000/svg">${edgeSvg}${nodesSvg}</svg>`;
    const approachRows = approaches.map(a => {
      const s = sigilForNode(a.node);
      return `<div class="adv-web-row"><span class="adv-web-sigil">${esc(s?.name || a.node)}</span><span class="adv-web-req">req ${a.requirement}</span></div>`;
    }).join('');

    return `<div class="adv-web-title">${esc(event.title)}</div>${svg}<div class="adv-web-approaches">${approachRows}</div>`;
  }

  function adventureApplyHint(el, card) {
    if (!session) return;
    const event = currentEvent();
    if (!event) return;
    const node = cardNode(card);
    if (!node) return;
    const approaches = getEventApproaches(event);
    if (!approaches || !approaches.length) return;
    const route = routeNode(node, approaches.map(a => a.node));
    if (!route) return;
    const sigil = sigilForNode(route.resolvedNode);
    el.dataset.hint = sigil ? `${sigil.glyph} ${sigil.name}` : route.resolvedNode;
  }

  function decorateCards() {
    if (!session || !target.__tlrAdventureActive) return;
    doc.querySelectorAll('.card[data-uid]').forEach(el => {
      const card = findRuntimeCard(el.dataset.uid);
      if (!card) return;
      const art = el.querySelector('.art');
      if (art && !art.querySelector('.adv-sigil-seal')) art.insertAdjacentHTML('afterbegin', sigilSeal(card));
      art?.querySelector('.adv-card-bonus')?.remove();
      const event = currentEvent();
      if (!art || !event) return;
      const visible = passivePotencyBonus(card, event) + Number(itemState().nextCardBonus || 0) + (itemState().greyfangReady ? 2 : 0);
      if (visible) art.insertAdjacentHTML('beforeend', `<span class="adv-card-bonus">${visible > 0 ? '+' : ''}${visible}</span>`);
    });
  }

  function eligibleForcedGreat(itemId, card, event) {
    const node = cardNode(card);
    if (itemId === 'gatekeepers_ring') return [NODES.MYSTERY, NODES.AUTHORITY].includes(node);
    if (itemId === 'river_stone_charm') return node === NODES.TRANSFORMATION;
    if (itemId === 'black_claw') return node === NODES.AGGRESSION && event.traits?.includes(EVENT_TRAITS.SUPERNATURAL);
    return false;
  }

  function addStatus(list, id) {
    if (id && !list.includes(id)) list.push(id);
  }

  function resolveCard(event, originalCard, { preview = false } = {}) {
    const card = { ...originalCard };
    const sourceNode = cardNode(card);
    const approaches = getEventApproaches(event);
    const route = routeNode(sourceNode, approaches.map(approach => approach.node));
    if (!route) throw new Error(`Adventure could not route card ${card.id} for ${event.id}.`);
    const approach = approaches.find(candidate => candidate.node === route.resolvedNode);
    const requirement = Math.min(5, Math.max(1, Number(approach.requirement || 1) + Number(session.run.setIndex || 0)));
    const potencyBonus = nextCardBonus(card, event, { preview });
    const potency = Number(card.points || 0) + potencyBonus;
    const armed = itemState().armedItem;
    const forcedGreat = armed && eligibleForcedGreat(armed, card, event);
    const outcome = event.outcomes.find(candidate => candidate.id === approach.outcomeId) || event.outcomes[0];
    const failure = approach.failure || event.failure || {};
    const failed = !forcedGreat && potency < requirement;
    let tier = failed ? RESULT.FAILURE : (forcedGreat || route.exact ? RESULT.GREAT_SUCCESS : RESULT.SUCCESS);
    let resolveChange = failed ? (failure.resolveChange ?? event.failure?.resolveChange ?? -1) : (outcome.resolveChange ?? 0);
    let gainStatuses = [...(failed ? (failure.gainStatuses || event.failure?.gainStatuses || []) : (outcome.gainStatuses || []))];
    let removeStatuses = [...(failed ? (failure.removeStatuses || []) : (outcome.removeStatuses || []))];
    let narrative = failed ? (failure.text || event.failure?.text || 'The attempt fails.') : (tier === RESULT.GREAT_SUCCESS && outcome.triumphText ? outcome.triumphText : outcome.text);
    const notes = [];

    if (!failed && outcome.specialConsequence === 'release_spirit') {
      if (session.run.statuses.includes('haunted')) addStatus(removeStatuses, 'haunted');
      else addStatus(gainStatuses, 'blessed');
    }

    if (failed && session.run.statuses.includes('exposed') && event.traits?.includes(EVENT_TRAITS.HOSTILE)) resolveChange -= 1;
    if (failed && hasItem('black_claw') && sourceNode === NODES.AGGRESSION && event.traits?.includes(EVENT_TRAITS.SUPERNATURAL)) resolveChange -= 1;

    if (!preview && failed && resolveChange < 0 && itemState().preventNextResolveLoss) {
      resolveChange = 0;
      itemState().preventNextResolveLoss = false;
      notes.push('Iron Ward prevented the Resolve loss.');
    }
    if (!preview && failed && resolveChange < 0 && hasItem('bandits_buckler') && event.traits?.includes(EVENT_TRAITS.HOSTILE) && !itemState().usedSet.bandits_buckler) {
      resolveChange = 0;
      itemState().usedSet.bandits_buckler = true;
      notes.push('Bandit’s Buckler absorbed the hostile failure.');
    }

    if (!failed && hasItem('smoke_cloth_cloak') && sourceNode === NODES.DECEPTION) {
      if (session.run.statuses.includes('exposed')) addStatus(removeStatuses, 'exposed');
      else if (session.run.statuses.includes('distrusted')) addStatus(removeStatuses, 'distrusted');
    }

    if (failed && hasItem('house_whisper') && sourceNode === NODES.MYSTERY) addStatus(gainStatuses, 'haunted');

    if (!preview && gainStatuses.includes('haunted') && itemState().preventNextHaunted) {
      gainStatuses = gainStatuses.filter(id => id !== 'haunted');
      itemState().preventNextHaunted = false;
      notes.push('Black Salt prevented Haunted.');
    }
    if (!preview && gainStatuses.includes('haunted') && hasItem('gravekeepers_candle') && !itemState().usedSet.gravekeepers_candle) {
      gainStatuses = gainStatuses.filter(id => id !== 'haunted');
      addStatus(gainStatuses, 'blessed');
      itemState().usedSet.gravekeepers_candle = true;
      notes.push('Gravekeeper’s Candle changed Haunted into Blessed.');
    }
    if (!preview && (gainStatuses.includes('distrusted') || gainStatuses.includes('exposed')) && hasItem('village_token') && !itemState().usedSet.village_token) {
      gainStatuses = gainStatuses.filter(id => !['distrusted', 'exposed'].includes(id));
      itemState().usedSet.village_token = true;
      notes.push('Village Token prevented the social status.');
    }

    let revealNext = 0;
    let rewardShow = failed ? 0 : tier === RESULT.GREAT_SUCCESS ? 4 : 3;
    let rewardChoose = failed ? 0 : tier === RESULT.GREAT_SUCCESS ? 2 : 1;

    if (!failed && tier === RESULT.GREAT_SUCCESS) {
      if (hasItem('prayer_beads')) resolveChange += 1;
      if (hasItem('beast_fang_knife') && event.traits?.includes(EVENT_TRAITS.HOSTILE)) resolveChange += 1;
      if (hasItem('shrine_spirit') && sourceNode === NODES.MYSTERY) addStatus(gainStatuses, 'blessed');
      if (hasItem('soldiers_insignia') && sourceNode === NODES.INVESTIGATION) revealNext = 2;
      if (hasItem('palewood_axe') && sourceNode === NODES.AGGRESSION) addStatus(gainStatuses, 'prepared');
      if (hasItem('notched_blade') && sourceNode === NODES.AGGRESSION) rewardShow += 1;
      if (hasItem('artisans_favor') && sourceNode === NODES.CREATION) rewardShow += 1;

      if (session.run.statuses.includes('distrusted') && event.traits?.includes(EVENT_TRAITS.SOCIAL)) rewardChoose = 1;
      else if (session.run.statuses.includes('blessed')) {
        rewardShow += 1;
        rewardChoose += 1;
        addStatus(removeStatuses, 'blessed');
      }
    }

    if (!preview && forcedGreat) {
      itemState().usedSet[armed] = true;
      itemState().armedItem = null;
    }

    return {
      tier, cardId: card.id, potency, potencyBonus, sourceNode, resolvedNode: route.resolvedNode, exact: route.exact,
      distance: route.distance, requirement, outcome: failed ? failure : outcome, successOutcome: outcome,
      narrative, resolveChange, gainStatuses: unique(gainStatuses), removeStatuses: unique(removeStatuses),
      rewardTier: failed ? null : tier === RESULT.GREAT_SUCCESS ? 'triumph' : 'success', rewardShow, rewardChoose, revealNext,
      flags: {}, notes,
    };
  }

  function applyResolutionAndCounters(resolution) {
    const hadPrepared = session.run.statuses.includes('prepared');
    const previousReveal = Number(session.run.revealedEventCount || 0);
    applyResolution(session.run, resolution);
    if (hadPrepared && !resolution.gainStatuses.includes('prepared')) {
      session.run.statuses = session.run.statuses.filter(id => id !== 'prepared');
    }
    session.run.revealedEventCount = Math.max(0, previousReveal - 1, Number(resolution.revealNext || 0));
    const state = itemState();
    if (hasItem('riverwatch_charm')) {
      if (resolution.resolveChange < 0) state.riverwatch = 0;
      else {
        state.riverwatch = Number(state.riverwatch || 0) + 1;
        if (state.riverwatch >= 2) {
          session.run.resolve = clampResolve(session.run.resolve + 1, session.run.maxResolve);
          state.riverwatch = 0;
          resolution.notes.push('Riverwatch Charm restored 1 Resolve.');
        }
      }
    }
    if (hasItem('greyfang') && !state.greyfangReady) {
      state.greyfang = Number(state.greyfang || 0) + 1;
      if (state.greyfang >= 3) state.greyfangReady = true;
    }
    if (hasItem('freed_spirit') && !state.freedSpiritReady) {
      state.freedSpirit = Number(state.freedSpirit || 0) + 1;
      if (state.freedSpirit >= 3) state.freedSpiritReady = true;
    }
  }

  function showOutcome(resolution, card) {
    const failed = resolution.tier === RESULT.FAILURE;
    const great = resolution.tier === RESULT.GREAT_SUCCESS;
    const label = failed ? 'Failure' : great ? 'Great Success' : 'Success';
    const statusBits = [
      ...resolution.gainStatuses.map(id => `<span class="adv-statuschg adv-statuschg--gain">+ ${esc(getStatus(id)?.name || id)}</span>`),
      ...resolution.removeStatuses.map(id => `<span class="adv-statuschg adv-statuschg--lose">− ${esc(getStatus(id)?.name || id)}</span>`),
    ].join(' ');
    const resolveBit = resolution.resolveChange
      ? `<div class="adv-statuschg ${resolution.resolveChange > 0 ? 'adv-statuschg--gain' : 'adv-statuschg--lose'}">Resolve ${resolution.resolveChange > 0 ? '+' : ''}${resolution.resolveChange}</div>` : '';
    const marked = !failed && !great && hasItem('marked_coin')
      ? `<button class="adv-mini-btn" onclick="tlrAdventureV3UseMarkedCoin()">Use Marked Coin</button>` : '';
    show(`<div class="result-panel ${failed ? 'fail' : 'pass'}"><div class="rhead"><h3 class="${failed ? 'fail' : 'pass'}">${label}</h3></div>
      <div class="adv-played-card">${esc(card.name)} · ${esc(sigilName(resolution.sourceNode))} · ${resolution.potency}${resolution.potencyBonus ? ` (${resolution.potencyBonus > 0 ? '+' : ''}${resolution.potencyBonus})` : ''}</div>
      <p class="adv-narrative">${esc(resolution.narrative)}</p>${statusBits ? `<div>${statusBits}</div>` : ''}${resolveBit}
      <div class="rbtns">${marked}<button class="btn-gold" onclick="tlrAdventureV3AfterOutcome()">Continue</button></div></div>`);
  }

  function rewardLabel(offer) {
    if (offer.type === 'ADD_SIGIL_CARD') return `Add a ${offer.nodes.map(sigilName).join(' or ')} card`;
    if (offer.type === 'UPGRADE_CARD') return offer.nodes?.length ? `Upgrade a ${offer.nodes.map(sigilName).join(' or ')} card` : 'Upgrade any card';
    if (offer.type === 'REMOVE_CARD') return 'Remove 1 card';
    if (offer.type === 'RESTORE_RESOLVE') return `Restore ${offer.amount || 1} Resolve`;
    if (offer.type === 'CHOOSE_CONSUMABLE') return 'Choose 1 of 3 Consumables';
    if (offer.type === 'CONSUMABLE' || offer.type === 'SIGNATURE_ITEM') return ADVENTURE_ITEMS[offer.itemId]?.name || offer.itemId;
    return offer.label || 'Reward';
  }

  function rewardDescription(offer) {
    if (offer.type === 'CONSUMABLE' || offer.type === 'SIGNATURE_ITEM') return ADVENTURE_ITEMS[offer.itemId]?.text || '';
    if (offer.type === 'ADD_SIGIL_CARD') return 'Choose 1 of 3 matching cards.';
    if (offer.type === 'UPGRADE_CARD') return 'Increase its printed value by 1.';
    if (offer.type === 'REMOVE_CARD') return 'Permanently remove it from this run.';
    return '';
  }

  function cloneOffer(offer) {
    return { ...offer, nodes: offer.nodes ? [...offer.nodes] : undefined };
  }

  function randomConsumableOffer(exclude = []) {
    const pool = CONSUMABLE_LIST.filter(item => !exclude.includes(item.id));
    const item = pool[Math.floor(rng() * pool.length)] || CONSUMABLE_LIST[0];
    return { type: 'CONSUMABLE', itemId: item.id };
  }

  function randomOrdinaryOffer(excludeLabels = []) {
    const choices = [
      randomConsumableOffer(),
      { type: 'RESTORE_RESOLVE', amount: 1 },
      { type: 'REMOVE_CARD' },
      { type: 'CHOOSE_CONSUMABLE' },
    ];
    const available = choices.filter(offer => !excludeLabels.includes(rewardLabel(offer)));
    return cloneOffer(available[Math.floor(rng() * available.length)] || choices[0]);
  }

  function buildRewardOffers(resolution) {
    const event = session.lastEvent;
    const outcomeId = resolution.successOutcome?.id || resolution.outcome?.id;
    const profile = getOutcomeRewardProfile(event.id, outcomeId);
    if (!profile) return [];
    const offers = profile.ordinary.map(cloneOffer);
    if (resolution.tier === RESULT.GREAT_SUCCESS) {
      const sig = cloneOffer(profile.signature);
      if (sig.itemId && hasItem(sig.itemId) && ADVENTURE_ITEMS[sig.itemId]?.kind !== 'cache') offers.push({ type: 'CHOOSE_CONSUMABLE' });
      else offers.push(sig);
    }
    while (offers.length < resolution.rewardShow) offers.push(randomOrdinaryOffer(offers.map(rewardLabel)));
    return offers.slice(0, resolution.rewardShow);
  }

  function sourceForOneReroll() {
    const state = session?.rewardState;
    if (!state) return null;
    for (const id of ['lucky_bones', 'merchants_signet']) {
      if (hasItem(id) && !state.rerollsUsed[id]) return id;
    }
    if (hasItem('lucky_token') && !state.rerollsUsed.lucky_token) return 'lucky_token';
    return null;
  }

  function showRewards() {
    const state = session.rewardState;
    const offers = state.selectedSet === 'alt' && state.altOffers ? state.altOffers : state.offers;
    const cards = offers.map((offer, index) => {
      const selected = state.picked.includes(index);
      const disabled = !selected && state.picked.length >= state.choose;
      const rerollSource = sourceForOneReroll();
      const reroll = rerollSource ? `<button class="adv-mini-btn" onclick="event.stopPropagation();tlrAdventureV3RerollOffer(${index},'${rerollSource}')">Replace</button>` : '';
      return `<div class="adv-reward${selected ? ' adv-reward--picked' : ''}${disabled ? ' adv-reward--disabled' : ''}" onclick="tlrAdventureV3PickReward(${index})">
        <div class="adv-reward__name">${esc(rewardLabel(offer))}</div><div class="adv-reward__desc">${esc(rewardDescription(offer))}</div>${reroll}</div>`;
    }).join('');
    const loaded = hasItem('loaded_dice') && !itemState().usedSet.loaded_dice && !state.altOffers
      ? `<button class="adv-mini-btn" onclick="tlrAdventureV3LoadedDice()">Use Loaded Dice</button>` : '';
    const tabs = state.altOffers ? `<div class="adv-offer-tabs"><button aria-pressed="${state.selectedSet !== 'alt'}" onclick="tlrAdventureV3OfferSet('base')">Original</button><button aria-pressed="${state.selectedSet === 'alt'}" onclick="tlrAdventureV3OfferSet('alt')">Rerolled</button></div>` : '';
    show(`<div class="result-panel pass"><div class="rhead"><h3 class="pass">Choose your reward${state.choose > 1 ? `s (${state.picked.length}/${state.choose})` : ''}</h3></div>
      ${tabs}<div class="adv-reward-tools">${loaded}</div><div class="adv-rewards">${cards}</div>
      <div class="rbtns"><button class="btn-gold" onclick="tlrAdventureV3ConfirmRewards()" ${state.picked.length === state.choose ? '' : 'disabled'}>Confirm</button></div></div>`);
  }

  function showRecovery() {
    const choices = RECOVERY_EVENT_V3.choices.map(choice => `<div class="adv-reward" onclick="tlrAdventureV3Recovery('${choice.id}')"><div class="adv-reward__name">${esc(choice.label)}</div></div>`).join('');
    show(`<div class="result-panel pass"><div class="rhead"><h3 class="pass">${esc(RECOVERY_EVENT_V3.title)}</h3></div><p class="adv-narrative">${esc(RECOVERY_EVENT_V3.description)}</p><div class="adv-rewards">${choices}</div></div>`);
  }

  function showSetRewards(profile) {
    session.pendingSetProfile = profile;
    const options = [
      { id: 'heart', name: 'Stronger Heart', text: '+1 maximum Resolve. Restore 1 Resolve.' },
      { id: 'temper', name: 'Tempered Reading', text: 'Upgrade 2 different cards by +1.' },
      { id: 'curate', name: 'Curated Deck', text: 'Remove 2 cards. Add 1 of 3 Major Arcana.' },
      { id: 'supplies', name: 'Prepared Journey', text: 'Choose 2 Consumables.' },
    ];
    session.setRewardOptions = options.sort(() => rng() - .5).slice(0, 3);
    const cards = session.setRewardOptions.map(option => `<div class="adv-reward" onclick="tlrAdventureV3SetReward('${option.id}')"><div class="adv-reward__name">${esc(option.name)}</div><div class="adv-reward__desc">${esc(option.text)}</div></div>`).join('');
    show(`<div class="result-panel pass"><div class="rhead"><h3 class="pass">The Spread Is Complete</h3></div><p class="adv-narrative">${esc(setEchoText(profile))}</p><div class="adv-rewards">${cards}</div></div>`);
  }

  function showEnd(won) {
    setBusy(true);
    show(`<div class="result-panel ${won ? 'pass' : 'fail'}"><div class="rhead"><h3 class="${won ? 'pass' : 'fail'}">${won ? 'The Road Remembers You' : 'Your Resolve Fails'}</h3></div>
      <p class="adv-narrative">${won ? 'Two completed spreads have changed the road behind you and the road ahead.' : 'The journey ends here, but the cards remember how you travelled.'}</p>
      <div class="rbtns"><button class="btn-gold" onclick="tlrAdventureV3Restart()">New Run</button><button onclick="tlrAdventureV3Leave()">Leave</button></div></div>`);
  }

  function renderInventory() {
    const rack = doc?.getElementById('relicRack');
    if (!rack || !session) return;
    rack.classList.add('adv-inventory-rack');
    const state = itemState();
    const slots = [];
    for (let i = 0; i < session.run.inventoryCapacity; i += 1) {
      const item = itemAt(i);
      if (!item) {
        slots.push('<button class="adv-inventory-slot adv-inventory-slot--empty" type="button" aria-label="Empty inventory slot"></button>');
        continue;
      }
      let ready = '';
      if (item.id === 'greyfang') ready = state.greyfangReady ? 'Ready' : `${state.greyfang || 0}/3`;
      if (item.id === 'freed_spirit') ready = state.freedSpiritReady ? 'Ready' : `${state.freedSpirit || 0}/3`;
      const armed = state.armedItem === item.id ? ' adv-inventory-armed' : '';
      slots.push(`<button class="adv-inventory-slot${armed}" type="button" onclick="tlrAdventureV3UseItem(${i})" title="${esc(item.name)} — ${esc(item.text)}">
        ${ready ? `<span class="adv-inventory-ready">${esc(ready)}</span>` : ''}<span class="adv-inventory-icon">${esc(item.name)}</span><span class="adv-inventory-kind">${esc(item.kind)}</span></button>`);
    }
    rack.innerHTML = slots.join('');
  }

  function acquireInventoryItem(itemId, done = () => {}) {
    const item = ADVENTURE_ITEMS[itemId];
    if (!item) { done(); return; }
    if (item.kind === 'cache') { openStrongbox(done); return; }
    if (item.kind !== 'consumable' && hasItem(itemId)) { toast(`${item.name} is already carried.`); done(); return; }
    if (session.run.inventory.length < session.run.inventoryCapacity) {
      session.run.inventory.push(itemId);
      renderInventory();
      done();
      return;
    }
    const current = inventory().map((id, index) => {
      const held = ADVENTURE_ITEMS[id];
      return `<div class="adv-reward" onclick="tlrAdventureV3ReplaceItem(${index},'${itemId}')"><div class="adv-reward__name">Replace ${esc(held?.name || id)}</div><div class="adv-reward__desc">${esc(held?.text || '')}</div></div>`;
    }).join('');
    session.pendingInventoryDone = done;
    show(`<div class="result-panel pass"><div class="rhead"><h3 class="pass">Inventory Full</h3></div><p class="adv-narrative">Passive items and Consumables use the same carried-item slots.</p>
      <div class="adv-rewards">${current}</div><div class="rbtns"><button onclick="tlrAdventureV3DeclineItem()">Leave ${esc(item.name)}</button></div></div>`);
  }

  function replaceInventoryItem(index, itemId) {
    session.run.inventory.splice(index, 1, itemId);
    const done = session.pendingInventoryDone || (() => {});
    session.pendingInventoryDone = null;
    renderInventory();
    done();
  }

  function declineInventoryItem() {
    const done = session.pendingInventoryDone || (() => {});
    session.pendingInventoryDone = null;
    done();
  }

  function chooseStatus(title, allowed, done) {
    const choices = session.run.statuses.filter(id => !allowed || allowed.includes(id));
    if (!choices.length) { done(null); return; }
    const cards = choices.map(id => `<div class="adv-reward" onclick="tlrAdventureV3ChooseStatus('${id}')"><div class="adv-reward__name">${esc(getStatus(id)?.name || id)}</div></div>`).join('');
    session.statusChoiceDone = done;
    show(`<div class="result-panel pass"><div class="rhead"><h3 class="pass">${esc(title)}</h3></div><div class="adv-rewards">${cards}</div></div>`);
  }

  function chooseStatusResult(id) {
    const done = session.statusChoiceDone;
    session.statusChoiceDone = null;
    if (typeof done === 'function') done(id);
  }

  function addPool(nodes = [], size = 3) {
    const pool = [];
    const used = new Set();
    let guard = 0;
    const eligible = ALL_CARD_DEFINITIONS.filter(card => !nodes.length || nodes.includes(session.run.sigilOverrides[card.id] || cardAdventureProfile(card)?.node));
    while (pool.length < size && guard < 100 && eligible.length) {
      guard += 1;
      const definition = eligible[Math.floor(rng() * eligible.length)];
      if (!definition || used.has(definition.id)) continue;
      used.add(definition.id);
      pool.push(cardWithRunChanges(definition, 9000 + pool.length));
    }
    return pool;
  }

  function pickCard(title, prompt, cards, done) {
    if (typeof target.choice !== 'function' || !cards.length) { done(null); return; }
    const ordered = typeof target.sortCards === 'function' ? target.sortCards(cards) : cards;
    clear();
    target.choice(title, prompt, ordered, picked => done(picked));
  }

  function pickCardToAdd(nodes, done) {
    pickCard('Add a Card', 'Choose a card to add to your deck.', addPool(nodes), picked => {
      if (picked) addCardToAdventureDeck(session.run, picked.id);
      updateChrome(); done();
    });
  }

  function pickCardToRemove(done) {
    pickCard('Remove a Card', 'Choose a card to remove from your deck.', buildAdventureDeckCards(), picked => {
      if (picked) removeCardFromAdventureDeck(session.run, picked.id);
      updateChrome(); done();
    });
  }

  function pickCardToUpgrade(nodes, done) {
    const cards = buildAdventureDeckCards().filter(card => (!nodes?.length || nodes.includes(cardNode(card))) && card.points < 5);
    pickCard('Upgrade a Card', 'Increase one card’s value by 1.', cards, picked => {
      if (picked) session.run.cardBonuses[picked.id] = Number(session.run.cardBonuses[picked.id] || 0) + 1;
      updateChrome(); done();
    });
  }

  function pickCardSigilOverride(done) {
    pickCard('Transmutation Dust', 'Choose a card to give the Serpent sigil.', buildAdventureDeckCards(), picked => {
      if (picked) session.run.sigilOverrides[picked.id] = NODES.TRANSFORMATION;
      updateChrome(); done();
    });
  }

  function chooseConsumable(count, done) {
    const pool = [...CONSUMABLE_LIST].sort(() => rng() - .5).slice(0, count);
    const cards = pool.map(item => `<div class="adv-reward" onclick="tlrAdventureV3TakeConsumable('${item.id}')"><div class="adv-reward__name">${esc(item.name)}</div><div class="adv-reward__desc">${esc(item.text)}</div></div>`).join('');
    session.consumableChoiceDone = done;
    show(`<div class="result-panel pass"><div class="rhead"><h3 class="pass">Choose a Consumable</h3></div><div class="adv-rewards">${cards}</div></div>`);
  }

  function takeConsumable(itemId) {
    const done = session.consumableChoiceDone || (() => {});
    session.consumableChoiceDone = null;
    acquireInventoryItem(itemId, done);
  }

  function openStrongbox(done) {
    const pool = PASSIVE_ITEM_LIST.filter(item => !hasItem(item.id)).sort(() => rng() - .5).slice(0, 3);
    const cards = pool.map(item => `<div class="adv-reward" onclick="tlrAdventureV3TakeStrongbox('${item.id}')"><div class="adv-reward__name">${esc(item.name)}</div><div class="adv-reward__desc">${esc(item.text)}</div></div>`).join('');
    session.strongboxDone = done;
    show(`<div class="result-panel pass"><div class="rhead"><h3 class="pass">Stolen Strongbox</h3></div><div class="adv-rewards">${cards}</div></div>`);
  }

  function takeStrongbox(itemId) {
    const done = session.strongboxDone || (() => {});
    session.strongboxDone = null;
    acquireInventoryItem(itemId, done);
  }

  function applyRewardOffer(offer, done) {
    if (offer.type === 'ADD_SIGIL_CARD') { pickCardToAdd(offer.nodes || [], done); return; }
    if (offer.type === 'REMOVE_CARD') { pickCardToRemove(done); return; }
    if (offer.type === 'UPGRADE_CARD') { pickCardToUpgrade(offer.nodes || [], done); return; }
    if (offer.type === 'RESTORE_RESOLVE') {
      session.run.resolve = clampResolve(session.run.resolve + (offer.amount || 1), session.run.maxResolve);
      updateChrome(); done(); return;
    }
    if (offer.type === 'CONSUMABLE' || offer.type === 'SIGNATURE_ITEM') { acquireInventoryItem(offer.itemId, done); return; }
    if (offer.type === 'CHOOSE_CONSUMABLE') { chooseConsumable(3, done); return; }
    done();
  }

  function applyRewardsSequentially(rewards, index) {
    if (index >= rewards.length) { session.rewardState = null; advanceAfterResolution(); return; }
    applyRewardOffer(rewards[index], () => applyRewardsSequentially(rewards, index + 1));
  }

  function afterOutcome() {
    const resolution = session?.lastResolution;
    if (!resolution) return;
    if (resolution.rewardTier && resolution.rewardShow > 0) {
      session.rewardState = {
        offers: buildRewardOffers(resolution), altOffers: null, selectedSet: 'base',
        choose: Math.min(resolution.rewardChoose, resolution.rewardShow), picked: [], rerollsUsed: {},
      };
      showRewards();
      return;
    }
    advanceAfterResolution();
  }

  function pickReward(index) {
    const state = session?.rewardState;
    if (!state) return;
    const at = state.picked.indexOf(index);
    if (at >= 0) state.picked.splice(at, 1);
    else if (state.picked.length < state.choose) state.picked.push(index);
    showRewards();
  }

  function confirmRewards() {
    const state = session?.rewardState;
    if (!state || state.picked.length !== state.choose) return;
    const offers = state.selectedSet === 'alt' && state.altOffers ? state.altOffers : state.offers;
    applyRewardsSequentially(state.picked.map(index => offers[index]), 0);
  }

  function rerollOffer(index, sourceId) {
    const state = session?.rewardState;
    if (!state || state.rerollsUsed[sourceId]) return;
    const offers = state.selectedSet === 'alt' && state.altOffers ? state.altOffers : state.offers;
    offers[index] = randomOrdinaryOffer(offers.map(rewardLabel));
    state.rerollsUsed[sourceId] = true;
    if (sourceId === 'lucky_token') removeInventoryItem('lucky_token');
    state.picked = state.picked.filter(picked => picked !== index);
    showRewards();
  }

  function useLoadedDice() {
    const state = session?.rewardState;
    if (!state || state.altOffers || itemState().usedSet.loaded_dice) return;
    state.altOffers = state.offers.map(() => randomOrdinaryOffer());
    state.selectedSet = 'alt';
    state.picked = [];
    itemState().usedSet.loaded_dice = true;
    showRewards();
  }

  function selectOfferSet(which) {
    const state = session?.rewardState;
    if (!state || (which === 'alt' && !state.altOffers)) return;
    state.selectedSet = which;
    state.picked = [];
    showRewards();
  }

  function useMarkedCoin() {
    if (!session?.lastResolution || session.lastResolution.tier !== RESULT.SUCCESS || !hasItem('marked_coin')) return;
    removeInventoryItem('marked_coin');
    const resolution = session.lastResolution;
    resolution.tier = RESULT.GREAT_SUCCESS;
    resolution.rewardTier = 'triumph';
    resolution.rewardShow = 4;
    resolution.rewardChoose = 2;
    resolution.narrative = resolution.successOutcome?.triumphText || resolution.narrative;
    if (hasItem('prayer_beads')) session.run.resolve = clampResolve(session.run.resolve + 1, session.run.maxResolve);
    if (hasItem('beast_fang_knife') && session.lastEvent.traits?.includes(EVENT_TRAITS.HOSTILE)) session.run.resolve = clampResolve(session.run.resolve + 1, session.run.maxResolve);
    if (hasItem('shrine_spirit') && resolution.sourceNode === NODES.MYSTERY && !session.run.statuses.includes('blessed')) session.run.statuses.push('blessed');
    if (hasItem('soldiers_insignia') && resolution.sourceNode === NODES.INVESTIGATION) session.run.revealedEventCount = Math.max(session.run.revealedEventCount || 0, 2);
    if (hasItem('palewood_axe') && resolution.sourceNode === NODES.AGGRESSION && !session.run.statuses.includes('prepared')) session.run.statuses.push('prepared');
    if (hasItem('notched_blade') && resolution.sourceNode === NODES.AGGRESSION) resolution.rewardShow += 1;
    if (hasItem('artisans_favor') && resolution.sourceNode === NODES.CREATION) resolution.rewardShow += 1;
    updateChrome();
    showOutcome(resolution, session.lastCard);
  }

  function advanceAfterResolution() {
    if (!session) return;
    if (session.run.lost || session.run.resolve <= 0) { showEnd(false); return; }
    if (isCurrentSetComplete(session.run)) {
      const profile = completeCurrentSet(session.run);
      if (isAdventureRunComplete(session.run)) { showEnd(true); return; }
      showSetRewards(profile);
      return;
    }
    session.awaitingOutcome = false;
    session.lastResolution = null;
    clear(); updateChrome(); setBusy(false);
    if (typeof target.startReading === 'function') target.startReading();
  }

  function chooseRecovery(choiceId) {
    if (!session?.pendingSetProfile) return;
    if (choiceId === 'rest') session.run.resolve = clampResolve(session.run.resolve + 2, session.run.maxResolve);
    if (choiceId === 'cleanse') {
      chooseStatus('Remove a Status', null, id => {
        if (id) session.run.statuses = session.run.statuses.filter(status => status !== id);
        finishRecovery();
      });
      return;
    }
    if (choiceId === 'search') {
      chooseConsumable(3, finishRecovery);
      return;
    }
    finishRecovery();
  }

  function finishRecovery() {
    const profile = session.pendingSetProfile;
    session.pendingSetProfile = null;
    beginNextSet(session.run, profile, rng);
    itemState().usedSet = {};
    itemState().armedItem = null;
    session.run.revealedEventCount = 0;
    session.awaitingOutcome = false;
    clear(); updateChrome(); setBusy(false);
    if (typeof target.startReading === 'function') target.startReading();
  }

  function chooseSetReward(id) {
    if (!session?.pendingSetProfile) return;
    if (id === 'heart') {
      session.run.maxResolve += 1;
      session.run.resolve = clampResolve(session.run.resolve + 1, session.run.maxResolve);
      showRecovery();
      return;
    }
    if (id === 'temper') {
      pickCardToUpgrade([], () => pickCardToUpgrade([], showRecovery));
      return;
    }
    if (id === 'curate') {
      pickCardToRemove(() => pickCardToRemove(() => {
        const majors = ALL_CARD_DEFINITIONS.filter(card => card.type === 'major').sort(() => rng() - .5).slice(0, 3).map((card, i) => cardWithRunChanges(card, 9900 + i));
        pickCard('Choose a Major Arcana', 'Add one Major Arcana to your deck.', majors, picked => {
          if (picked) addCardToAdventureDeck(session.run, picked.id);
          showRecovery();
        });
      }));
      return;
    }
    if (id === 'supplies') {
      chooseConsumable(3, () => chooseConsumable(3, showRecovery));
      return;
    }
    showRecovery();
  }

  function skipCurrentEvent(sourceId, trackUse = true) {
    if (!session || session.awaitingOutcome || (trackUse && itemState().usedSet[sourceId])) return false;
    const index = session.run.eventIndexInSet;
    if (index >= session.run.eventDeck.length - 1) { toast('There is no later Event in this set.'); return false; }
    const [id] = session.run.eventDeck.splice(index, 1);
    session.run.eventDeck.push(id);
    if (trackUse) itemState().usedSet[sourceId] = true;
    updateChrome();
    if (typeof target.startReading === 'function') target.startReading();
    return true;
  }

  function reorderNextEvents() {
    const state = itemState();
    if (state.usedSet.whispering_leaf || session.awaitingOutcome) return;
    const start = session.run.eventIndexInSet + 1;
    const ids = session.run.eventDeck.slice(start, start + 2);
    if (ids.length < 2) { toast('Fewer than 2 Events remain.'); return; }
    const a = getAdventureEventV3(ids[0]);
    const b = getAdventureEventV3(ids[1]);
    show(`<div class="result-panel pass"><div class="rhead"><h3 class="pass">Whispering Leaf</h3></div><p class="adv-narrative">Choose their order.</p><div class="adv-rewards">
      <div class="adv-reward" onclick="tlrAdventureV3OrderEvents(false)"><div class="adv-reward__name">${esc(a.title)} → ${esc(b.title)}</div></div>
      <div class="adv-reward" onclick="tlrAdventureV3OrderEvents(true)"><div class="adv-reward__name">${esc(b.title)} → ${esc(a.title)}</div></div></div></div>`);
  }

  function orderEvents(swap) {
    const start = session.run.eventIndexInSet + 1;
    if (swap) [session.run.eventDeck[start], session.run.eventDeck[start + 1]] = [session.run.eventDeck[start + 1], session.run.eventDeck[start]];
    itemState().usedSet.whispering_leaf = true;
    session.run.revealedEventCount = Math.max(session.run.revealedEventCount || 0, 2);
    clear(); updateChrome();
  }

  function useInventoryItem(index) {
    if (!session) return;
    const item = itemAt(index);
    if (!item) return;
    const state = itemState();

    if (item.id === 'freed_spirit' && state.freedSpiritReady) {
      chooseStatus('Freed Spirit', null, id => {
        if (id) {
          session.run.statuses = session.run.statuses.filter(status => status !== id);
          state.freedSpiritReady = false; state.freedSpirit = 0;
        }
        clear(); updateChrome();
      });
      return;
    }

    if (item.kind !== 'consumable') {
      if (item.active === 'skip_event') { if (skipCurrentEvent(item.id)) renderInventory(); return; }
      if (['great_moon_crown', 'great_serpent', 'great_blade_supernatural'].includes(item.active)) {
        if (state.usedSet[item.id]) { toast(`${item.name} has been used this set.`); return; }
        state.armedItem = state.armedItem === item.id ? null : item.id;
        renderInventory(); decorateCards(); return;
      }
      if (item.active === 'reorder_events') { reorderNextEvents(); return; }
      toast(`${item.name}: ${item.text}`);
      return;
    }

    if (item.id === 'marked_coin') { toast('Use Marked Coin after a Success.'); return; }
    if (item.id === 'lucky_token') { toast('Use Lucky Token on a reward screen.'); return; }
    if (item.id === 'healing_draught') {
      session.run.resolve = clampResolve(session.run.resolve + 2, session.run.maxResolve); removeInventoryIndex(index); updateChrome(); return;
    }
    if (item.id === 'whetstone') { state.nextCardBonus = Number(state.nextCardBonus || 0) + 3; removeInventoryIndex(index); updateChrome(); return; }
    if (item.id === 'iron_ward') { state.preventNextResolveLoss = true; removeInventoryIndex(index); updateChrome(); return; }
    if (item.id === 'black_salt') { state.preventNextHaunted = true; removeInventoryIndex(index); updateChrome(); return; }
    if (item.id === 'smoke_bomb') { if (skipCurrentEvent('smoke_bomb_consumable', false)) removeInventoryIndex(index); return; }
    if (item.id === 'spyglass') { session.run.revealedEventCount = Math.max(session.run.revealedEventCount || 0, 2); removeInventoryIndex(index); updateChrome(); return; }
    if (item.id === 'blessed_oil') { if (!session.run.statuses.includes('blessed')) session.run.statuses.push('blessed'); removeInventoryIndex(index); updateChrome(); return; }
    if (item.id === 'purifying_water') {
      chooseStatus('Purifying Water', null, id => {
        if (id) session.run.statuses = session.run.statuses.filter(status => status !== id);
        removeInventoryItem('purifying_water'); clear(); updateChrome();
      }); return;
    }
    if (item.id === 'disguise_kit') {
      chooseStatus('Disguise Kit', ['distrusted', 'exposed'], id => {
        if (id) session.run.statuses = session.run.statuses.filter(status => status !== id);
        removeInventoryItem('disguise_kit'); clear(); updateChrome();
      }); return;
    }
    if (item.id === 'transmutation_dust') {
      removeInventoryIndex(index);
      pickCardSigilOverride(() => { clear(); updateChrome(); });
    }
  }

  function installPreviewListener() {
    if (clickPreviewInstalled || !doc) return;
    clickPreviewInstalled = true;
    doc.addEventListener('click', event => {
      if (!target.__tlrAdventureActive || !session || !hasItem('house_whisper') || session.awaitingOutcome) return;
      const el = event.target.closest?.('.card[data-uid]');
      if (!el) return;
      const card = findRuntimeCard(el.dataset.uid);
      if (!card || cardNode(card) !== NODES.MYSTERY) return;
      try {
        const resolution = resolveCard(currentEvent(), card, { preview: true });
        toast(`House Whisper: ${resolution.tier === RESULT.GREAT_SUCCESS ? 'Great Success' : resolution.tier === RESULT.SUCCESS ? 'Success' : 'Failure'}`);
      } catch { }
    }, true);
  }

  function onCardPlaced(card, slotIndex) {
    if (!session || session.awaitingOutcome || !card) return false;
    const event = currentEvent();
    if (!event) return false;
    session.awaitingOutcome = true;
    setBusy(true);
    const liveCard = cardWithRunChanges(CARD_BY_ID.get(card.id) || card, card.uid);
    const resolution = resolveCard(event, liveCard);
    applyResolutionAndCounters(resolution);
    recordSingleCardPlay(session.run, event, liveCard, resolution);
    session.lastEvent = event;
    session.lastResolution = resolution;
    session.lastCard = liveCard;
    session.lastSlotIndex = slotIndex;
    updateChrome();
    showOutcome(resolution, liveCard);
    return true;
  }

  function newSession() {
    return {
      run: initialiseRun(createSingleCardRunState(rng)),
      lastEvent: null, lastResolution: null, lastCard: null, rewardState: null,
      pendingSetProfile: null, awaitingOutcome: false, addedClasses: [],
    };
  }

  function wrapReturnToMenuOnce() {
    if (target.__tlrAdventureV3ReturnWrapped || typeof target.tlrReturnToMenu !== 'function') return;
    target.__tlrAdventureV3ReturnWrapped = true;
    const original = target.tlrReturnToMenu;
    target.__tlrAdventureV3ReturnOriginal = original;
    target.tlrReturnToMenu = function (...args) { cleanupAdventure(); return original.apply(this, args); };
  }

  function ensureApproachWebEl() {
    if (!doc || doc.getElementById('advApproachWeb')) return;
    const el = doc.createElement('div');
    el.id = 'advApproachWeb';
    el.className = 'hidden';
    doc.body.appendChild(el);
    doc.addEventListener('click', e => {
      if (!target.__tlrAdventureActive) return;
      const web = doc.getElementById('advApproachWeb');
      if (!web || web.classList.contains('hidden')) return;
      if (web.contains(e.target)) return;
      web.classList.add('hidden');
    });
  }

  function toggleApproachRef(e) {
    if (e) e.stopPropagation();
    const el = doc.getElementById('advApproachWeb');
    if (!el) return;
    if (!el.classList.contains('hidden')) { el.classList.add('hidden'); return; }
    el.innerHTML = renderApproachWebHTML();
    const hud = doc.getElementById('advHud');
    if (hud) {
      const r = hud.getBoundingClientRect();
      el.style.top = (r.bottom + 6) + 'px';
      el.style.left = Math.max(8, r.left) + 'px';
    }
    el.classList.remove('hidden');
  }

  function installApproachWebControls() {
    ensureApproachWebEl();
    target.tlrAdvToggleApproach = toggleApproachRef;
    if (!target.__tlrAdvOrigTogglePullTab && typeof target.tlrTogglePullTab === 'function') {
      target.__tlrAdvOrigTogglePullTab = target.tlrTogglePullTab;
    }
    target.tlrTogglePullTab = function(id) {
      if (id === 'scoring' && target.__tlrAdventureActive) { toggleApproachRef(); return; }
      if (target.__tlrAdvOrigTogglePullTab) target.__tlrAdvOrigTogglePullTab(id);
    };
    const tab = doc?.getElementById('scoringPullTab');
    if (tab) tab.innerHTML = '&#9660; Approach';
  }

  function startRun() {
    captureLiveBackupOnce();
    wrapReturnToMenuOnce();
    target.__tlrAdventureActive = true;
    target.__tlrAdventureApplyHint = adventureApplyHint;
    installFreshProfile();
    session = newSession();
    ensureStyles(doc); ensureChrome(); forceTable(); installCardSigilBridge(); installPreviewListener();
    installApproachWebControls();
    updateChrome(); clear(); setBusy(false);
    if (typeof target.startReading === 'function') target.startReading();
  }

  function restartRun() {
    if (!target.__tlrAdventureActive) { startRun(); return; }
    target.__tlrAdventureApplyHint = adventureApplyHint;
    installFreshProfile();
    session = newSession();
    ensureChrome(); forceTable(); installCardSigilBridge();
    installApproachWebControls();
    updateChrome(); clear(); setBusy(false);
    if (typeof target.startReading === 'function') target.startReading();
  }

  function cleanupAdventure() {
    if (!target.__tlrAdventureActive) return;
    target.__tlrAdventureActive = false;
    delete target.__tlrAdventureApplyHint;
    delete target.tlrAdvToggleApproach;
    if (target.__tlrAdvOrigTogglePullTab) {
      target.tlrTogglePullTab = target.__tlrAdvOrigTogglePullTab;
      delete target.__tlrAdvOrigTogglePullTab;
    }
    const scoringTab = doc?.getElementById('scoringPullTab');
    if (scoringTab) scoringTab.innerHTML = '&#9660; Scoring';
    doc?.getElementById('advApproachWeb')?.remove();
    restoreLiveBackup();
    if (doc) {
      doc.body.classList.remove(MODE_CLASS);
      for (const cls of session?.addedClasses || []) if (cls !== MODE_CLASS) doc.body.classList.remove(cls);
      doc.getElementById('advEventDeck')?.remove();
      doc.getElementById('advHud')?.remove();
      const rack = doc.getElementById('relicRack');
      if (rack) { rack.classList.remove('adv-inventory-rack'); rack.innerHTML = ''; }
    }
    session = null; clear();
    if (typeof target.renderRelicRack === 'function') target.renderRelicRack();
  }

  function leave() {
    cleanupAdventure();
    const navigate = target.__tlrAdventureV3ReturnOriginal || target.tlrReturnToMenu || target.tlrShowMainMenu;
    if (typeof navigate === 'function') navigate();
  }

  target.tlrStartAdventure = startRun;
  target.tlrAdventureBuildDeck = () => (session ? buildAdventureDeckCards() : null);
  target.tlrAdventureOnCardPlaced = onCardPlaced;
  target.tlrAdventureResolveReading = () => {};
  target.tlrAdventureV3AfterOutcome = afterOutcome;
  target.tlrAdventureV3PickReward = pickReward;
  target.tlrAdventureV3ConfirmRewards = confirmRewards;
  target.tlrAdventureV3RerollOffer = rerollOffer;
  target.tlrAdventureV3LoadedDice = useLoadedDice;
  target.tlrAdventureV3OfferSet = selectOfferSet;
  target.tlrAdventureV3UseMarkedCoin = useMarkedCoin;
  target.tlrAdventureV3Recovery = chooseRecovery;
  target.tlrAdventureV3SetReward = chooseSetReward;
  target.tlrAdventureV3UseItem = useInventoryItem;
  target.tlrAdventureV3ReplaceItem = replaceInventoryItem;
  target.tlrAdventureV3DeclineItem = declineInventoryItem;
  target.tlrAdventureV3ChooseStatus = chooseStatusResult;
  target.tlrAdventureV3TakeConsumable = takeConsumable;
  target.tlrAdventureV3TakeStrongbox = takeStrongbox;
  target.tlrAdventureV3OrderEvents = orderEvents;
  target.tlrAdventureV3Restart = restartRun;
  target.tlrAdventureV3Leave = leave;
  target.tlrAdventureRestart = restartRun;
  target.tlrAdventureLeave = leave;
}

if (typeof window !== 'undefined') installAdventureModeV3(window);
