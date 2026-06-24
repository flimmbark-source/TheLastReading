// Adventure Mode — front-end controller and self-contained play screen.
//
// Reuses the real systems (computeScore, the deck definitions, the hidden
// interpretation + run systems) AND the real Single-Player V2 look: the screen
// mirrors the V2 table — same background, reading circle, angled spread slots,
// hand dock and card art — by reusing the V2 stylesheet classes under
// body.single-player-v2.generated-sheet-ready. The only deliberate departure
// from the V2 table is that the score/threshold HUD is removed and an event
// deck (a pile of cards with the top one revealed) takes its place, top-centre.
//
// It stays isolated in its own overlay and hides the live table chrome behind
// it, so Score Mode's reading/scoring flow is never touched.

import { ALL_CARD_DEFINITIONS, MAJOR_GLYPHS, SUIT_GLYPHS, ABILITY_LABELS } from '../data/cards.mjs';
import { displayTitle } from '../systems/deck.mjs';
import { applyCardPhoto, CARD_SHEET } from '../ui/renderCard.mjs';
import { installGeneratedSheetAssets } from '../ui/generatedSheetAssets.mjs';
import {
  createAdventureRunState,
  currentEvent,
  resolveEvent,
  applyResolution,
  generateRewardOffers,
  applyReward,
  advanceEvent,
  isRunLost,
  isRecoveryDue,
  applyRecoveryChoice,
  randomUnownedRelic,
  ADVENTURE_RESULTS,
} from '../systems/adventure/run.mjs';
import { RECOVERY_EVENT } from '../data/adventure/events.mjs';
import { REWARD_TYPES } from '../data/adventure/rewards.mjs';
import { getStatus } from '../data/adventure/statuses.mjs';
import { buildDebugPanelHtml, isAdventureDebugEnabled } from '../ui/adventure/adventureHud.mjs';

const HAND_SIZE = 5;
const SPREAD_SIZE = 5;
const STYLE_ID = 'adventure-mode-style';
const OVERLAY_ID = 'adventureMode';
// V2 body classes Adventure rides on, plus its own mode flag.
const V2_CLASSES = ['single-player-v2', 'generated-sheet-ready'];
const MODE_CLASS = 'mode-adventure';

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, ch => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]
  ));
}

function shuffle(arr, rng = Math.random) {
  const next = [...arr];
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
}

// Adventure-only chrome: positions the event deck where the score-stack lived,
// hides the live table chrome behind the overlay, and styles the result/reward
// panels. Everything else (spread arc, slots, hand fan, card art, background)
// comes from the reused V2 stylesheets.
function ensureStyles(doc) {
  if (!doc || doc.getElementById(STYLE_ID)) return;
  const style = doc.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    /* Hide the live Score-Mode table chrome while Adventure is open. These are
       all direct children of <body>; the Adventure overlay's own copies live
       inside #adventureMode so they are untouched. */
    body.mode-adventure > .score-stack,
    body.mode-adventure > .spread-wrap,
    body.mode-adventure > .handDock,
    body.mode-adventure > .bar,
    body.mode-adventure > .refs-layer,
    body.mode-adventure > #relicRack,
    body.mode-adventure > #constellationPill,
    body.mode-adventure > #titleWrap,
    body.mode-adventure > .tlr-pull-wrap,
    body.mode-adventure > #invWrap,
    body.mode-adventure > #handSwipeZone,
    body.mode-adventure > #abilityPrompt,
    body.mode-adventure > #purgePrompt,
    body.mode-adventure > #tutTip,
    body.mode-adventure > #summary,
    body.mode-adventure > #modal,
    body.mode-adventure > #sophiaVeil { display:none !important; }

    #adventureMode{position:fixed;inset:0;z-index:38;display:none}
    #adventureMode.adv-open{display:block}

    /* Top-left run strip: Resolve + Statuses + Leave. */
    .adv-strip{position:fixed;top:8px;left:10px;z-index:42;display:flex;gap:8px;align-items:center;flex-wrap:wrap;
      font:700 12px system-ui,sans-serif;color:#ead9b5;pointer-events:auto}
    .adv-strip__resolve{background:rgba(18,12,9,.8);border:1px solid rgba(228,188,111,.5);border-radius:999px;padding:5px 12px}
    .adv-strip__resolve b{color:#f3c969}
    .adv-strip__status{background:rgba(228,188,111,.1);border:1px solid rgba(228,188,111,.5);border-radius:999px;padding:3px 9px;font-size:11px}
    .adv-leave{margin-left:4px;border:1px solid rgba(228,188,111,.5);background:rgba(18,12,9,.8);color:#e7c07c;border-radius:999px;
      padding:5px 12px;cursor:pointer;font:700 11px system-ui,sans-serif}

    /* Event deck: a pile of card backs with the top card revealed, sitting
       where the score/threshold stack used to be (top-centre). */
    .adv-event-deck{position:fixed;top:10px;left:50%;transform:translateX(-50%);z-index:41;
      display:flex;flex-direction:column;align-items:center;gap:6px;pointer-events:none}
    .adv-deck{position:relative;width:128px;height:120px}
    .adv-deck__back{position:absolute;width:84px;height:118px;border-radius:8px;left:50%;top:0;
      background:#1c1410 var(--spv2-card-back-art,linear-gradient(160deg,#3a2a1a,#160d07)) center/cover;
      border:1px solid rgba(228,188,111,.45);box-shadow:0 4px 10px rgba(0,0,0,.5)}
    .adv-deck__top{position:absolute;left:50%;top:-2px;transform:translateX(-50%);width:96px;height:122px;border-radius:9px;
      background:linear-gradient(165deg,#2a1810,#140907);border:2px solid #9a7842;box-shadow:0 8px 20px rgba(0,0,0,.6),0 0 18px rgba(243,201,105,.2);
      display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:8px;color:#f2dfb8}
    .adv-deck__trait{font:800 8px system-ui,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:#d19c51}
    .adv-deck__title{font:800 13px Georgia,serif;line-height:1.1;margin-top:4px}
    .adv-deck__scores{font:700 10px system-ui,sans-serif;color:#c9b890;margin-top:6px}
    .adv-event-desc{max-width:300px;text-align:center;font:500 11px Georgia,serif;line-height:1.4;color:#d8c8a6;
      background:rgba(18,12,9,.66);border-radius:8px;padding:6px 10px}

    /* The cast action floats just above the hand dock, centred. */
    .adv-cast-wrap{position:fixed;left:0;right:0;bottom:268px;z-index:42;display:flex;justify-content:center;pointer-events:none}
    .adv-cast{pointer-events:auto;border:1px solid #f3c969;background:linear-gradient(180deg,#3a2a1a,#241810);color:#f2dfb8;
      border-radius:999px;padding:11px 26px;cursor:pointer;font:800 15px Georgia,serif;letter-spacing:.04em;box-shadow:0 0 18px rgba(243,201,105,.28)}
    .adv-cast:disabled{opacity:.4;cursor:not-allowed;box-shadow:none}

    /* Discard + Remove action medallions, up top (as in Single-Player V2). */
    .adv-action-bar{position:fixed;top:176px;left:50%;transform:translateX(-50%);z-index:43;display:flex;gap:22px;align-items:flex-start;pointer-events:auto}
    /* Bottom row of four utility medallions: Menu · Archive · Scoring · Abilities. */
    .adv-util-bar{position:fixed;bottom:204px;left:50%;transform:translateX(-50%);z-index:43;display:flex;gap:18px;align-items:flex-start;pointer-events:auto}
    .adv-medallion{position:relative;width:54px;height:54px;border:0;border-radius:50%;cursor:pointer;
      background-color:#181009;background-position:center;background-repeat:no-repeat;background-size:contain;
      filter:drop-shadow(0 5px 7px rgba(0,0,0,.78)) drop-shadow(0 2px 2px rgba(0,0,0,.6));
      transition:transform .08s ease,filter .08s ease,opacity .12s ease}
    .adv-medallion:active{transform:translateY(1px) scale(.94)}
    .adv-medallion:disabled{opacity:.35;cursor:not-allowed;filter:grayscale(.6) drop-shadow(0 3px 4px rgba(0,0,0,.6))}
    .adv-medallion__label{position:absolute;left:50%;bottom:-13px;transform:translateX(-50%);font:700 9px system-ui,sans-serif;
      letter-spacing:.04em;color:#cdb47a;white-space:nowrap;text-shadow:0 1px 2px #000;pointer-events:none}
    .adv-medallion__badge{position:absolute;top:-5px;right:-5px;min-width:16px;height:16px;border-radius:999px;background:#3a2a1a;
      border:1px solid #f3c969;color:#f3c969;font:800 10px system-ui,sans-serif;display:flex;align-items:center;justify-content:center;padding:0 3px}
    .adv-ref{display:flex;flex-direction:column;gap:7px;font:500 13px/1.4 Georgia,serif;color:#e0cfa8}
    .adv-ref b{color:#f3c969}
    .adv-ref-table{width:100%;border-collapse:collapse;font:500 12px/1.35 system-ui,sans-serif;color:#e0cfa8}
    .adv-ref-table td{padding:3px 6px;border-bottom:1px solid rgba(255,255,255,.06);vertical-align:top}
    .adv-ref-table td:first-child{color:#f3c969;font-weight:700;white-space:nowrap}
    .adv-hint{font:600 11px system-ui,sans-serif;color:#b89a63;text-align:center}

    /* Result / reward / recovery / end panels (modal over the table). */
    .adv-modal{position:fixed;inset:0;z-index:9000;display:flex;align-items:center;justify-content:center;padding:18px;
      background:rgba(0,0,0,.55)}
    .adv-panel{width:min(92vw,520px);max-height:88vh;overflow:auto;border:1px solid rgba(228,188,111,.5);border-radius:16px;
      background:linear-gradient(180deg,rgba(38,28,21,.98),rgba(15,12,11,.99));padding:22px;color:#eadbb9;
      font-family:Georgia,serif;display:flex;flex-direction:column;gap:14px;box-shadow:0 24px 64px rgba(0,0,0,.7)}
    .adv-result{font:800 24px Georgia,serif;letter-spacing:.04em}
    .adv-result--success{color:#9fd17f}.adv-result--triumph{color:#f3c969}.adv-result--failure{color:#d98c7f}
    .adv-result__score{font:700 14px system-ui,sans-serif;color:#c9b890;margin-left:10px}
    .adv-narrative{line-height:1.55;font-size:16px;color:#e6d6b4}
    .adv-statuschg{font:700 12px system-ui,sans-serif;letter-spacing:.04em;text-transform:uppercase}
    .adv-statuschg--gain{color:#f3c969}.adv-statuschg--lose{color:#b6a07a}
    .adv-actions{display:flex;gap:10px;flex-wrap:wrap;align-items:center}
    .adv-btn{border:1px solid rgba(228,188,111,.6);background:linear-gradient(180deg,#3a2a1a,#241810);color:#f2dfb8;
      border-radius:9px;padding:10px 18px;cursor:pointer;font:800 14px system-ui,sans-serif}
    .adv-btn:disabled{opacity:.4;cursor:not-allowed}
    .adv-btn--primary{border-color:#f3c969;box-shadow:0 0 16px rgba(243,201,105,.25)}
    .adv-rewards{display:flex;gap:10px;flex-wrap:wrap}
    .adv-reward{flex:1 1 150px;border:1px solid rgba(228,188,111,.4);border-radius:10px;padding:14px;cursor:pointer;
      background:rgba(255,255,255,.03);text-align:center;font:700 14px system-ui,sans-serif}
    .adv-reward:hover{border-color:#f3c969}
    .adv-reward--picked{border-color:#9fd17f;background:rgba(159,209,127,.12)}
    .adv-reward--disabled{opacity:.35;pointer-events:none}
    .adv-debug{margin-top:6px;border:1px dashed rgba(120,200,255,.5);border-radius:10px;padding:10px 12px;
      background:rgba(40,60,90,.18);font:600 12px ui-monospace,monospace;color:#bcd6f0}
    .adv-debug__title{font-weight:800;color:#8fc2ff;margin-bottom:6px}
    .adv-debug__row{display:flex;justify-content:space-between;gap:18px}
    .adv-debug__outcome{margin-top:6px;color:#8fc2ff}
    .adv-bigmsg{font:800 30px Georgia,serif;text-align:center}
  `;
  doc.head.appendChild(style);
}

export function installAdventureMode(target = window) {
  if (!target || target.__tlrAdventureInstalled) return;
  target.__tlrAdventureInstalled = true;
  const doc = target.document;
  const rng = () => (target.__tlrAdvRng || Math.random)();

  let session = null;

  function overlay() {
    let el = doc.getElementById(OVERLAY_ID);
    if (!el) {
      el = doc.createElement('div');
      el.id = OVERLAY_ID;
      doc.body.appendChild(el);
    }
    return el;
  }

  // --- Card markup (mirrors renderCard.cardHTML, but without the legacy card
  // globals so it stays self-contained and testable). ---
  function cardSymbol(card) {
    if (card.type === 'major') return MAJOR_GLYPHS[card.number] || '✦';
    return SUIT_GLYPHS[card.suit] || '';
  }
  function cardEl(card, { where, extraClass = '', style = '' } = {}) {
    const cls = `card${card.type === 'major' ? ' major' : ''}${CARD_SHEET[card.id] ? ' photo' : ''}${extraClass ? ` ${extraClass}` : ''}`;
    const plaque = ABILITY_LABELS[card.ability] || '';
    return `<div class="${cls}"${style ? ` style="${style}"` : ''} data-uid="${card.uid}"${where ? ` data-where="${where}"` : ''}>`
      + `<div class="title">${esc(displayTitle(card))}</div>`
      + `<div class="art"><div class="sym">${esc(cardSymbol(card))}</div>`
      + `<div class="plaque">${esc(plaque)}</div>`
      + `<div class="seal tr">${esc(card.points)}</div></div></div>`;
  }

  // A V2-style utility/action medallion. Art comes from the reused V2 CSS vars
  // (set by generatedSheetAssets); a background colour keeps it visible if the
  // art has not loaded, and the label identifies it regardless.
  function medallion(act, art, label, { disabled = false, badge = null } = {}) {
    return `<button class="adv-medallion" type="button" data-act="${act}"${disabled ? ' disabled' : ''}`
      + ` style="background-image:${art}" aria-label="${esc(label)}">`
      + (badge != null ? `<span class="adv-medallion__badge">${esc(badge)}</span>` : '')
      + `<span class="adv-medallion__label">${esc(label)}</span></button>`;
  }

  function paintPhotos(root) {
    root.querySelectorAll('.card.photo').forEach(el => {
      const uid = Number(el.getAttribute('data-uid'));
      const card = session.byUid.get(uid);
      if (card) applyCardPhoto(el, card);
    });
  }

  // --- Top chrome: run strip + event deck ---
  function stripHtml() {
    const statuses = (session.run.statuses || [])
      .map(id => `<span class="adv-strip__status">${esc(getStatus(id)?.name || id)}</span>`)
      .join('');
    return `<div class="adv-strip">`
      + `<span class="adv-strip__resolve">Resolve <b>${session.run.resolve}</b> / ${session.run.maxResolve}</span>`
      + statuses
      + `<button class="adv-leave" type="button" data-act="leave">Leave</button>`
      + `</div>`;
  }

  function eventDeckHtml(event) {
    const remaining = Math.max(0, session.run.events.length - session.run.currentEventIndex);
    const backs = [...Array(Math.min(3, Math.max(1, remaining))).keys()]
      .map(i => `<div class="adv-deck__back" style="transform:translate(calc(-50% + ${i * 4}px),${i * 3}px) rotate(${i * 2 - 2}deg)"></div>`)
      .join('');
    return `<div class="adv-event-deck">
        <div class="adv-deck">
          ${backs}
          <div class="adv-deck__top">
            <div class="adv-deck__trait">${esc((event.traits || []).join(' · '))}</div>
            <div class="adv-deck__title">${esc(event.title)}</div>
            <div class="adv-deck__scores">▲ ${event.targetScore} · ★ ${event.triumphScore}</div>
          </div>
        </div>
        <div class="adv-event-desc">${esc(event.description)}</div>
      </div>`;
  }

  // Discard + Remove medallions (top), matching Single-Player V2's action pair.
  function actionBarHtml() {
    const canAct = session.selectedUid != null;
    return `<div class="adv-action-bar">`
      + medallion('discard', 'url("/public/ui/single-player-v2/elements/Discard.png")', 'Discard',
        { disabled: !canAct || session.discards < 1, badge: session.discards })
      + medallion('purge', 'var(--spv2-action-center-art)', 'Remove',
        { disabled: !canAct || session.purges < 1, badge: session.purges })
      + `</div>`;
  }

  // The four bottom utility medallions, matching Single-Player V2.
  function utilityBarHtml() {
    return `<div class="adv-util-bar">`
      + medallion('menu', 'var(--spv2-option-menu-art)', 'Menu')
      + medallion('archive', 'var(--spv2-option-archive-art)', 'Archive')
      + medallion('scoring', 'var(--spv2-option-scoring-art)', 'Scoring')
      + medallion('abilities', 'var(--spv2-option-abilities-art)', 'Abilities')
      + `</div>`;
  }

  // --- Event (spread-building) screen ---
  function renderEvent() {
    const event = currentEvent(session.run);
    const el = overlay();
    const filled = session.spread.filter(Boolean).length;

    const slots = session.spread.map((card, i) => (
      card
        ? `<div class="slot" data-slot="${i}">${cardEl(card, { where: 'spread' })}</div>`
        : `<div class="slot empty" data-slot="${i}"><span class="num">${i + 1}</span></div>`
    )).join('');

    const n = session.hand.length;
    const hand = session.hand.map((card, i) => {
      const angle = n > 1 ? (i - (n - 1) / 2) * 6 : 0;
      const selected = card.uid === session.selectedUid;
      return cardEl(card, { extraClass: selected ? 'sel' : '', style: `--a:${angle.toFixed(1)}deg` });
    }).join('');

    const hint = session.selectedUid != null
      ? 'Tap a slot to lay the card · Discard or Remove it · or tap it again to deselect'
      : 'Tap a card to pick it up';

    el.innerHTML = `
      ${stripHtml()}
      ${eventDeckHtml(event)}
      ${actionBarHtml()}
      <div class="spread-wrap"><div class="spread">${slots}</div></div>
      <div class="adv-cast-wrap">
        <button class="adv-cast" type="button" data-act="cast" ${filled === SPREAD_SIZE ? '' : 'disabled'}>
          ${filled === SPREAD_SIZE ? 'Cast the Reading' : `Lay ${SPREAD_SIZE - filled} more`}
        </button>
      </div>
      ${utilityBarHtml()}
      <div class="handDock"><div class="hand">${hand}</div></div>
      <div class="adv-hint" style="position:fixed;bottom:190px;left:0;right:0;z-index:42;pointer-events:none">${hint}</div>`;
    paintPhotos(el);
  }

  // --- Utility panels (Menu / Archive / Scoring / Abilities) ---
  function infoPanel(title, body, extraButtons = '') {
    overlay().innerHTML = `${stripHtml()}<div class="adv-modal"><div class="adv-panel">`
      + `<div class="adv-result" style="font-size:20px">${esc(title)}</div>${body}`
      + `<div class="adv-actions">${extraButtons}<button class="adv-btn adv-btn--primary" type="button" data-act="closePanel">Close</button></div>`
      + `</div></div>`;
  }

  function openScoring() {
    infoPanel('Scoring Patterns', `<div class="adv-ref">
      <p><b>Three / Four of a Kind</b> — matching court ranks across suits.</p>
      <p><b>Full Court</b> — three or more distinct court ranks.</p>
      <p><b>Royal Court</b> — three or more court ranks in one suit.</p>
      <p><b>Sequence</b> — three or more consecutive Major Arcana.</p>
      <p><b>Path of the Magi</b> — the Fool, the Magician and the World together.</p>
      <p><b>Balanced Reading</b> — at least one Major and one Minor card.</p>
      <p><b>Elemental Harmony</b> — all four suits present in the spread.</p>
    </div>`);
  }

  function openAbilities() {
    infoPanel('Abilities', `<table class="adv-ref-table">
      <tr><td>Draw</td><td>Draw that many cards.</td></tr>
      <tr><td>Peek</td><td>Look at that many cards. Take 1, the rest go to the bottom.</td></tr>
      <tr><td>Search</td><td>Take any card from the deck, then shuffle.</td></tr>
      <tr><td>Reshuffle</td><td>Shuffle discard, hand and deck, then draw a full hand.</td></tr>
      <tr><td>Neighbor</td><td>Reveal 2 adjacent deck cards. Take 1.</td></tr>
      <tr><td>Kin</td><td>Reveal 2 cards of the same Arcana. Take 1.</td></tr>
      <tr><td>Mirror</td><td>Take the opposite card across the Arcana centerline.</td></tr>
      <tr><td>Between</td><td>Choose 2 cards. Reveal 2 between them. Take 1.</td></tr>
    </table>`);
  }

  function openArchive() {
    const relics = session.run.relics.length
      ? session.run.relics.map(id => `<p><b>◈</b> ${esc(id.replace(/_/g, ' '))}</p>`).join('')
      : '<p>No relics gathered yet.</p>';
    const statuses = session.run.statuses.length
      ? session.run.statuses.map(id => `<p><b>✦</b> ${esc(getStatus(id)?.name || id)} — ${esc(getStatus(id)?.description || '')}</p>`).join('')
      : '<p>No lingering statuses.</p>';
    infoPanel('Your Journal', `<div class="adv-ref"><div><b>Relics</b></div>${relics}<div style="margin-top:8px"><b>Statuses</b></div>${statuses}</div>`);
  }

  function openMenu() {
    infoPanel('Menu',
      `<div class="adv-ref"><p>Read your way through each event. A reading that meets the <b>Target</b> succeeds; beating the <b>Triumph</b> score earns more. Lose all your <b>Resolve</b> and the journey ends.</p></div>`,
      `<button class="adv-btn" type="button" data-act="leave">Leave Adventure</button>`);
  }

  function modal(inner) {
    overlay().innerHTML = `${stripHtml()}<div class="adv-modal"><div class="adv-panel">${inner}</div></div>`;
  }

  // --- Outcome ---
  function renderOutcome(resolution) {
    const event = session.lastEvent;
    const label =
      resolution.tier === ADVENTURE_RESULTS.TRIUMPH ? 'Triumph'
      : resolution.tier === ADVENTURE_RESULTS.SUCCESS ? 'Success' : 'Failure';
    const statusBits = [
      ...resolution.gainStatuses.map(id => `<span class="adv-statuschg adv-statuschg--gain">+ ${esc(getStatus(id)?.name || id)}</span>`),
      ...resolution.removeStatuses.map(id => `<span class="adv-statuschg adv-statuschg--lose">– ${esc(getStatus(id)?.name || id)}</span>`),
    ].join(' ');
    const resolveBit = resolution.resolveChange
      ? `<div class="adv-statuschg ${resolution.resolveChange > 0 ? 'adv-statuschg--gain' : 'adv-statuschg--lose'}">Resolve ${resolution.resolveChange > 0 ? '+' : ''}${resolution.resolveChange}</div>`
      : '';
    const debug = isAdventureDebugEnabled(target)
      ? buildDebugPanelHtml({ meanings: resolution.meanings, outcome: resolution.outcome })
      : '';
    modal(`
      <div><span class="adv-result adv-result--${resolution.tier}">${label}</span><span class="adv-result__score">${resolution.score} / ${event.targetScore}</span></div>
      <div class="adv-narrative">${esc(resolution.narrative)}</div>
      ${statusBits ? `<div>${statusBits}</div>` : ''}
      ${resolveBit}
      <div class="adv-actions"><button class="adv-btn adv-btn--primary" type="button" data-act="afterOutcome">Continue</button></div>
      ${debug}`);
  }

  // --- Rewards ---
  function renderRewards() {
    const { offers, choose, picked } = session.rewardState;
    const cards = offers.map((offer, i) => {
      const isPicked = picked.includes(i);
      const disabled = !isPicked && picked.length >= choose;
      return `<div class="adv-reward${isPicked ? ' adv-reward--picked' : ''}${disabled ? ' adv-reward--disabled' : ''}" data-reward="${i}">${esc(offer.label)}</div>`;
    }).join('');
    modal(`
      <div class="adv-result adv-result--success">Choose your reward${choose > 1 ? `s (${picked.length}/${choose})` : ''}</div>
      <div class="adv-rewards">${cards}</div>
      <div class="adv-actions"><button class="adv-btn adv-btn--primary" type="button" data-act="confirmRewards" ${picked.length === choose ? '' : 'disabled'}>Confirm</button></div>`);
  }

  // --- Recovery ---
  function renderRecovery() {
    const choices = RECOVERY_EVENT.choices
      .map(choice => `<div class="adv-reward" data-recovery="${choice.id}">${esc(choice.label)}</div>`)
      .join('');
    modal(`
      <div class="adv-result adv-result--triumph">${esc(RECOVERY_EVENT.title)}</div>
      <div class="adv-narrative">${esc(RECOVERY_EVENT.description)}</div>
      <div class="adv-rewards">${choices}</div>`);
  }

  function renderEnd(won) {
    modal(`
      <div class="adv-bigmsg">${won ? 'The road is yours.' : 'Your Resolve fails.'}</div>
      <div class="adv-narrative" style="text-align:center">${won
        ? 'You read your way through every trial set before you.'
        : 'The journey ends here — but the cards remember.'}</div>
      <div class="adv-actions" style="justify-content:center">
        <button class="adv-btn adv-btn--primary" type="button" data-act="restart">New Run</button>
        <button class="adv-btn" type="button" data-act="leave">Leave</button>
      </div>`);
  }

  // --- Flow ---
  function dealHand() {
    const pile = shuffle(session.deckCards, rng);
    session.spread = Array(SPREAD_SIZE).fill(null);
    session.hand = pile.slice(0, HAND_SIZE);
    session.drawPile = pile.slice(HAND_SIZE);
    session.discardPile = [];
    session.discards = 3;
    session.purges = 1;
    session.selectedUid = null;
  }

  function nextStep() {
    const run = session.run;
    if (isRunLost(run)) { renderEnd(false); return; }
    if (isRecoveryDue(run)) { renderRecovery(); return; }
    if (run.currentEventIndex >= run.events.length) { renderEnd(true); return; }
    dealHand();
    renderEvent();
  }

  function startRun() {
    const run = createAdventureRunState();
    const deckCards = ALL_CARD_DEFINITIONS.map((card, uid) => ({ ...card, uid }));
    session = {
      run,
      deckCards,
      byUid: new Map(deckCards.map(c => [c.uid, c])),
      hand: [],
      spread: Array(SPREAD_SIZE).fill(null),
      lastEvent: null,
      lastResolution: null,
      rewardState: null,
    };
    dealHand();
    renderEvent();
  }

  // --- Interaction (tap a hand card to pick it up, then tap a slot / Discard /
  // Remove; tap a laid card to take it back) ---
  function selectHandCard(uid) {
    session.selectedUid = session.selectedUid === uid ? null : uid;
    renderEvent();
  }

  function placeSelected(slotIndex) {
    if (session.selectedUid == null || session.spread[slotIndex]) return;
    const idx = session.hand.findIndex(c => c.uid === session.selectedUid);
    if (idx < 0) return;
    session.spread[slotIndex] = session.hand[idx];
    session.hand.splice(idx, 1);
    session.selectedUid = null;
    renderEvent();
  }

  function returnToHand(uid) {
    const slot = session.spread.findIndex(c => c && c.uid === uid);
    if (slot < 0) return;
    session.hand.push(session.spread[slot]);
    session.spread[slot] = null;
    renderEvent();
  }

  // Discard the selected hand card and draw a replacement (limited charges).
  function discardSelected() {
    if (session.selectedUid == null || session.discards < 1) return;
    const idx = session.hand.findIndex(c => c.uid === session.selectedUid);
    if (idx < 0) return;
    const [card] = session.hand.splice(idx, 1);
    session.discardPile.push(card);
    if (session.drawPile.length) session.hand.push(session.drawPile.shift());
    session.discards -= 1;
    session.selectedUid = null;
    renderEvent();
  }

  // Remove the selected card from the run's deck permanently (deck thinning).
  function purgeSelected() {
    if (session.selectedUid == null || session.purges < 1) return;
    const idx = session.hand.findIndex(c => c.uid === session.selectedUid);
    if (idx < 0) return;
    const [card] = session.hand.splice(idx, 1);
    const di = session.deckCards.findIndex(c => c.uid === card.uid);
    if (di >= 0) session.deckCards.splice(di, 1);
    session.byUid.delete(card.uid);
    session.purges -= 1;
    session.selectedUid = null;
    renderEvent();
  }

  function cast() {
    const event = currentEvent(session.run);
    session.lastEvent = event;
    const resolution = resolveEvent({ event, spread: session.spread, run: session.run });
    applyResolution(session.run, resolution);
    session.lastResolution = resolution;
    renderOutcome(resolution);
  }

  function afterOutcome() {
    const resolution = session.lastResolution;
    if (resolution.rewardTier) {
      const offers = generateRewardOffers(session.run, resolution.rewardShow, rng);
      session.rewardState = { offers, choose: Math.min(resolution.rewardChoose, offers.length), picked: [] };
      renderRewards();
    } else {
      advanceAndContinue();
    }
  }

  function confirmRewards() {
    const { offers, picked } = session.rewardState;
    for (const i of picked) {
      applyReward(session.run, offers[i], {
        relicId: randomUnownedRelic(session.run, rng),
        onDeckReward: r => applyDeckReward(r),
      }, rng);
    }
    session.rewardState = null;
    advanceAndContinue();
  }

  function applyDeckReward(reward) {
    if (reward.type === REWARD_TYPES.ADD_CARD) {
      const base = ALL_CARD_DEFINITIONS[Math.floor(rng() * ALL_CARD_DEFINITIONS.length)];
      const uid = session.deckCards.length ? Math.max(...session.deckCards.map(c => c.uid)) + 1 : 0;
      const card = { ...base, uid };
      session.deckCards.push(card);
      session.byUid.set(uid, card);
    } else if (reward.type === REWARD_TYPES.REMOVE_CARD && session.deckCards.length > SPREAD_SIZE) {
      const removed = session.deckCards.pop();
      if (removed) session.byUid.delete(removed.uid);
    }
  }

  function advanceAndContinue() {
    advanceEvent(session.run, session.lastEvent?.id);
    nextStep();
  }

  function chooseRecovery(choiceId) {
    applyRecoveryChoice(session.run, choiceId, rng);
    nextStep();
  }

  function applyBodyClasses() {
    const body = doc.body;
    session.addedClasses = [];
    for (const cls of [...V2_CLASSES, MODE_CLASS]) {
      if (!body.classList.contains(cls)) { body.classList.add(cls); session.addedClasses.push(cls); }
    }
    // Best-effort: warm the V2 art so the reused skin matches the live table.
    try { if (target.Image) installGeneratedSheetAssets(target); } catch { /* ignore */ }
  }

  function leave() {
    const el = overlay();
    el.classList.remove('adv-open');
    el.innerHTML = '';
    // Always drop our mode flag; only drop V2 classes we added ourselves.
    doc.body.classList.remove(MODE_CLASS);
    for (const cls of session?.addedClasses || []) {
      if (cls !== MODE_CLASS) doc.body.classList.remove(cls);
    }
    session = null;
    if (typeof target.tlrReturnToMenu === 'function') target.tlrReturnToMenu();
    else if (typeof target.tlrShowMainMenu === 'function') target.tlrShowMainMenu();
  }

  function onClick(ev) {
    const t = ev.target.closest('[data-act],[data-reward],[data-recovery],[data-slot],.card[data-uid]');
    if (!t) return;
    if (t.dataset.act) {
      switch (t.dataset.act) {
        case 'cast': cast(); return;
        case 'discard': discardSelected(); return;
        case 'purge': purgeSelected(); return;
        case 'menu': openMenu(); return;
        case 'archive': openArchive(); return;
        case 'scoring': openScoring(); return;
        case 'abilities': openAbilities(); return;
        case 'closePanel': renderEvent(); return;
        case 'afterOutcome': afterOutcome(); return;
        case 'confirmRewards': confirmRewards(); return;
        case 'restart': startRun(); return;
        case 'leave': leave(); return;
        default: return;
      }
    }
    if (t.dataset.reward != null) {
      const i = Number(t.dataset.reward);
      const state = session.rewardState;
      const at = state.picked.indexOf(i);
      if (at >= 0) state.picked.splice(at, 1);
      else if (state.picked.length < state.choose) state.picked.push(i);
      renderRewards();
      return;
    }
    if (t.dataset.recovery) { chooseRecovery(t.dataset.recovery); return; }
    if (t.classList.contains('card')) {
      const uid = Number(t.getAttribute('data-uid'));
      if (t.getAttribute('data-where') === 'spread') returnToHand(uid);
      else selectHandCard(uid);
      return;
    }
    if (t.dataset.slot != null && t.classList.contains('empty')) {
      placeSelected(Number(t.dataset.slot));
    }
  }

  target.tlrStartAdventure = function () {
    ensureStyles(doc);
    const el = overlay();
    if (!el.__advBound) { el.addEventListener('click', onClick); el.__advBound = true; }
    el.classList.add('adv-open');
    startRun();
    applyBodyClasses();
  };
}

if (typeof window !== 'undefined') installAdventureMode(window);
