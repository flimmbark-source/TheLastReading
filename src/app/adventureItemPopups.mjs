import { ADVENTURE_ITEMS } from '../data/adventure/adventureContentV3.mjs';

const STYLE_ID = 'adventure-item-popup-style';
const ITEM_LIST = Object.freeze(Object.values(ADVENTURE_ITEMS));
const DIRECT_ACTIVE_EFFECTS = new Set([
  'skip_event',
  'great_moon_crown',
  'great_serpent',
  'great_blade_supernatural',
  'reorder_events',
]);

const TIMING_TEXT = Object.freeze({
  before: 'Use before playing a card.',
  between: 'Use between Events.',
  result: 'Use after a Success.',
  reward: 'Use on a reward screen.',
});

const ITEM_VISUALS = Object.freeze({
  healing_draught: { glyph: '🧪', tone: 'potion' },
  whetstone: { glyph: '▰', tone: 'iron' },
  iron_ward: { glyph: '◆', tone: 'iron' },
  black_salt: { glyph: '✦', tone: 'shadow' },
  smoke_bomb: { glyph: '●', tone: 'shadow' },
  purifying_water: { glyph: '💧', tone: 'water' },
  marked_coin: { glyph: '◉', tone: 'gold' },
  spyglass: { glyph: '⌕', tone: 'brass' },
  disguise_kit: { glyph: '◐', tone: 'shadow' },
  blessed_oil: { glyph: '♨', tone: 'gold' },
  lucky_token: { glyph: '✥', tone: 'gold' },
  transmutation_dust: { glyph: '∿', tone: 'mystic' },
  old_road_map: { glyph: '⌁', tone: 'parchment' },
  gatekeepers_ring: { glyph: '◌', tone: 'mystic' },
  broken_chain: { glyph: '⛓', tone: 'iron' },
  bandits_buckler: { glyph: '◆', tone: 'iron' },
  smoke_cloth_cloak: { glyph: '◒', tone: 'shadow' },
  notched_blade: { glyph: '†', tone: 'blood' },
  shrine_spirit: { glyph: '✧', tone: 'spirit' },
  prayer_beads: { glyph: '⁙', tone: 'gold' },
  lucky_bones: { glyph: '⚄', tone: 'bone' },
  riverwatch_charm: { glyph: '◉', tone: 'water' },
  river_stone_charm: { glyph: '●', tone: 'nature' },
  ferrymans_boots: { glyph: '⌑', tone: 'leather' },
  greyfang: { glyph: '⋀', tone: 'bone' },
  hide_mantle: { glyph: '⌇', tone: 'leather' },
  beast_fang_knife: { glyph: '⟋', tone: 'bone' },
  merchants_signet: { glyph: '◌', tone: 'brass' },
  loaded_dice: { glyph: '⚄', tone: 'gold' },
  stolen_strongbox: { glyph: '▣', tone: 'brass' },
  village_token: { glyph: '◉', tone: 'brass' },
  artisans_favor: { glyph: '✚', tone: 'forge' },
  black_iron_seal: { glyph: '⬟', tone: 'shadow' },
  gravekeepers_candle: { glyph: '♨', tone: 'spirit' },
  soldiers_insignia: { glyph: '★', tone: 'brass' },
  freed_spirit: { glyph: '♧', tone: 'spirit' },
  house_whisper: { glyph: '⌂', tone: 'shadow' },
  warded_iron_nails: { glyph: '‡', tone: 'iron' },
  black_claw: { glyph: 'Ψ', tone: 'blood' },
  whispering_leaf: { glyph: '❧', tone: 'nature' },
  silver_leaf: { glyph: '❧', tone: 'silver' },
  palewood_axe: { glyph: '⌁', tone: 'bone' },
});

const DEFAULT_VISUALS = Object.freeze({
  consumable: { glyph: '✦', tone: 'potion' },
  companion: { glyph: '♧', tone: 'spirit' },
  pact: { glyph: '⬟', tone: 'shadow' },
  cache: { glyph: '▣', tone: 'brass' },
  passive: { glyph: '◆', tone: 'iron' },
});

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, character => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]
  ));
}

function visualForItem(item) {
  return ITEM_VISUALS[item?.id] || DEFAULT_VISUALS[item?.kind] || DEFAULT_VISUALS.passive;
}

function itemArtMarkup(item, size = 'reward') {
  const visual = visualForItem(item);
  return `<div class="adv-item-art adv-item-art--${size}" data-tone="${esc(visual.tone)}" aria-hidden="true"><span class="adv-item-art__glyph">${esc(visual.glyph)}</span></div>`;
}

function itemByVisibleName(value) {
  const raw = String(value || '').trim();
  const name = raw.startsWith('Replace ') ? raw.slice(8).trim() : raw;
  return ITEM_LIST.find(item => item.name === name) || null;
}

function ensureStyle(doc) {
  if (!doc || doc.getElementById(STYLE_ID)) return;
  const style = doc.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    .adv-item-art{--art-a:#24435b;--art-b:#0c1822;--art-glow:rgba(105,188,237,.36);position:relative;overflow:hidden;
      display:flex;align-items:center;justify-content:center;border:1px solid rgba(225,236,240,.58);
      background:radial-gradient(circle at 34% 26%,var(--art-glow),transparent 43%),linear-gradient(145deg,var(--art-a),var(--art-b));
      box-shadow:inset 0 0 18px rgba(0,0,0,.42),0 4px 12px rgba(0,0,0,.38)}
    .adv-item-art::before{content:'';position:absolute;inset:5px;border:1px solid rgba(255,255,255,.14);border-radius:inherit}
    .adv-item-art::after{content:'';position:absolute;inset:0;opacity:.16;background:repeating-linear-gradient(118deg,transparent 0 8px,rgba(255,255,255,.12) 9px,transparent 10px)}
    .adv-item-art__glyph{position:relative;z-index:2;color:#f5ead0;text-shadow:0 2px 2px #000,-1px 0 #000,1px 0 #000,0 -1px #000;filter:drop-shadow(0 0 4px var(--art-glow));line-height:1}
    .adv-item-art[data-tone="potion"]{--art-a:#375e58;--art-b:#101f21;--art-glow:rgba(100,224,194,.42)}
    .adv-item-art[data-tone="iron"]{--art-a:#586671;--art-b:#171d22;--art-glow:rgba(192,219,234,.3)}
    .adv-item-art[data-tone="shadow"]{--art-a:#493d58;--art-b:#130f19;--art-glow:rgba(172,130,216,.38)}
    .adv-item-art[data-tone="water"]{--art-a:#2a6b83;--art-b:#0b2633;--art-glow:rgba(98,205,246,.48)}
    .adv-item-art[data-tone="gold"]{--art-a:#806526;--art-b:#281c08;--art-glow:rgba(245,201,84,.48)}
    .adv-item-art[data-tone="brass"]{--art-a:#72552f;--art-b:#24170b;--art-glow:rgba(228,173,86,.4)}
    .adv-item-art[data-tone="mystic"]{--art-a:#554d8b;--art-b:#18142c;--art-glow:rgba(164,144,247,.48)}
    .adv-item-art[data-tone="parchment"]{--art-a:#8a744e;--art-b:#352814;--art-glow:rgba(231,202,139,.38)}
    .adv-item-art[data-tone="blood"]{--art-a:#843c3b;--art-b:#260d0d;--art-glow:rgba(231,91,84,.4)}
    .adv-item-art[data-tone="spirit"]{--art-a:#557487;--art-b:#17242e;--art-glow:rgba(171,225,250,.5)}
    .adv-item-art[data-tone="bone"]{--art-a:#827860;--art-b:#2e2a20;--art-glow:rgba(235,222,182,.36)}
    .adv-item-art[data-tone="nature"]{--art-a:#4e713e;--art-b:#142510;--art-glow:rgba(134,215,102,.38)}
    .adv-item-art[data-tone="leather"]{--art-a:#715039;--art-b:#25140c;--art-glow:rgba(205,142,88,.32)}
    .adv-item-art[data-tone="forge"]{--art-a:#934b25;--art-b:#2d1007;--art-glow:rgba(250,132,59,.45)}
    .adv-item-art[data-tone="silver"]{--art-a:#687884;--art-b:#202a31;--art-glow:rgba(211,232,242,.44)}
    .adv-item-art--compact{width:32px;height:32px;border-radius:7px}.adv-item-art--compact .adv-item-art__glyph{font:900 20px/1 Arial,sans-serif}
    .adv-item-art--reward{width:82px;height:62px;border-radius:9px;margin:0 auto 9px}.adv-item-art--reward .adv-item-art__glyph{font:900 38px/1 Arial,sans-serif}
    .adv-item-art--popup{width:min(210px,64vw);height:128px;border-radius:12px;margin:2px auto 12px}.adv-item-art--popup .adv-item-art__glyph{font:900 66px/1 Arial,sans-serif}
    .adv-inventory-icon{display:flex!important;align-items:center;justify-content:center;max-width:none!important;overflow:visible!important;font-size:0!important}
    #relicRack.adv-inventory-rack .adv-inventory-kind{display:none!important}
    .adv-inventory-slot .adv-item-art{pointer-events:none}
    .adv-reward>.adv-item-art{flex:none}
    .adv-item-popup{max-width:430px;margin:0 auto;text-align:center}
    .adv-item-popup__kind{display:inline-block;margin:0 0 9px;padding:4px 10px;border-radius:999px;
      border:1px solid rgba(127,182,224,.46);background:rgba(22,54,79,.72);color:#a9d5f2;
      font:800 9px/1 system-ui,sans-serif;letter-spacing:.13em;text-transform:uppercase}
    .adv-item-popup__effect{margin:12px auto 8px;max-width:350px;color:#f0dfbb;font:700 16px/1.45 Georgia,serif}
    .adv-item-popup__timing{margin:7px auto 0;color:#b5a483;font:700 11px/1.4 system-ui,sans-serif}
    .adv-item-popup__state{display:inline-block;margin-top:10px;padding:5px 9px;border-radius:8px;
      background:rgba(215,167,46,.14);border:1px solid rgba(215,167,46,.4);color:#e6c56a;
      font:900 10px/1 system-ui,sans-serif;letter-spacing:.06em;text-transform:uppercase}
    .adv-item-popup__hint{margin:10px auto 0;max-width:340px;color:#c4ad84;font:600 11px/1.45 system-ui,sans-serif}
    @media(max-width:640px){
      .adv-item-art--compact{width:29px;height:29px}.adv-item-art--compact .adv-item-art__glyph{font-size:18px}
      .adv-item-art--reward{width:72px;height:54px}.adv-item-art--reward .adv-item-art__glyph{font-size:32px}
      .adv-item-art--popup{height:108px}.adv-item-art--popup .adv-item-art__glyph{font-size:54px}
    }
  `;
  doc.head.appendChild(style);
}

function itemButton(doc, index) {
  return doc?.querySelectorAll('#relicRack .adv-inventory-slot')?.[index] || null;
}

function itemFromButton(button) {
  const id = button?.dataset?.itemId;
  if (id && ADVENTURE_ITEMS[id]) return ADVENTURE_ITEMS[id];
  const icon = button?.querySelector('.adv-inventory-icon');
  const name = icon?.dataset?.itemName || icon?.textContent?.trim();
  return itemByVisibleName(name);
}

function decorateInventory(doc) {
  doc?.querySelectorAll('#relicRack .adv-inventory-slot:not(.adv-inventory-slot--empty)').forEach(button => {
    const icon = button.querySelector('.adv-inventory-icon');
    if (!icon) return;
    const item = itemFromButton(button);
    if (!item) return;
    button.dataset.itemId = item.id;
    button.setAttribute('aria-label', `${item.name}. ${item.text}`);
    button.querySelector('.adv-inventory-kind')?.remove();
    icon.dataset.itemName = item.name;
    if (!icon.querySelector('.adv-item-art')) icon.innerHTML = itemArtMarkup(item, 'compact');
  });
}

function decorateRewardItems(doc) {
  doc?.querySelectorAll('.adv-reward').forEach(card => {
    if (card.querySelector(':scope > .adv-item-art')) return;
    const nameElement = card.querySelector('.adv-reward__name');
    const item = itemByVisibleName(nameElement?.textContent);
    if (!item || !nameElement) return;
    nameElement.insertAdjacentHTML('beforebegin', itemArtMarkup(item, 'reward'));
  });
}

function hasOpenOverlay(doc) {
  const summary = doc?.getElementById('summary');
  return Boolean(summary?.innerHTML?.trim());
}

function captureOverlay(doc) {
  const summary = doc?.getElementById('summary');
  return { html: summary?.innerHTML || '' };
}

function restoreOverlay(target, snapshot) {
  if (snapshot?.html && typeof target.showOverlay === 'function') {
    target.showOverlay(snapshot.html);
    return;
  }
  if (typeof target.clearOverlay === 'function') target.clearOverlay();
}

function directConsumable(item) {
  return item?.kind === 'consumable' && !['marked_coin', 'lucky_token'].includes(item.id);
}

function contextualHint(item) {
  if (item?.id === 'marked_coin') return 'After a Success, use the Marked Coin button on the result screen.';
  if (item?.id === 'lucky_token') return 'On a reward screen, press Replace beneath the offer you want to reroll.';
  if (['lucky_bones', 'merchants_signet'].includes(item?.id)) return 'On a reward screen, press Replace beneath the offer you want to reroll.';
  if (item?.id === 'loaded_dice') return 'Use the Loaded Dice button on a reward screen.';
  return '';
}

function activePassive(item, button) {
  if (!item || item.kind === 'consumable') return false;
  if (DIRECT_ACTIVE_EFFECTS.has(item.active)) return true;
  return item.id === 'freed_spirit' && button?.querySelector('.adv-inventory-ready')?.textContent?.trim() === 'Ready';
}

function canUseAtCurrentState(target, item) {
  if (target.state?.busy) return false;
  const doc = target.document;
  if (item.id === 'purifying_water' && !doc.querySelector('#advHud .adv-status')) return false;
  if (item.id === 'disguise_kit' && !doc.querySelector('#advHud .adv-status--distrusted, #advHud .adv-status--exposed')) return false;
  if (item.id === 'blessed_oil' && doc.querySelector('#advHud .adv-status--blessed')) return false;
  return true;
}

function unavailableReason(target, item, overlayAlreadyOpen, hasDirectAction) {
  if (!hasDirectAction) return '';
  if (overlayAlreadyOpen) return 'Finish the current result or reward choice before using this item.';
  if (target.state?.busy) return 'Wait for the current action to finish.';
  if (item.id === 'purifying_water') return 'You have no Status to remove.';
  if (item.id === 'disguise_kit') return 'You are not Distrusted or Exposed.';
  if (item.id === 'blessed_oil') return 'You are already Blessed.';
  return '';
}

export function installAdventureItemPopups(target = window) {
  if (!target?.document || target.__tlrAdventureItemPopupsInstalled) return;
  target.__tlrAdventureItemPopupsInstalled = true;
  const doc = target.document;
  ensureStyle(doc);

  let decorationFrame = 0;
  const decorate = () => {
    if (decorationFrame) return;
    decorationFrame = target.requestAnimationFrame(() => {
      decorationFrame = 0;
      decorateInventory(doc);
      decorateRewardItems(doc);
    });
  };
  new target.MutationObserver(decorate).observe(doc.body, { childList: true, subtree: true });
  decorate();

  const attach = () => {
    const originalUse = target.tlrAdventureV3UseItem;
    if (typeof originalUse !== 'function' || target.__tlrAdventureItemUseWrapped) return false;

    target.__tlrAdventureItemUseWrapped = true;
    target.__tlrAdventureV3UseItemOriginal = originalUse;

    target.tlrAdventureV3UseItem = function showAdventureItem(index) {
      const button = itemButton(doc, index);
      const item = itemFromButton(button);
      if (!item) return false;

      const previous = captureOverlay(doc);
      target.__tlrAdventureItemPopup = { index, previous };

      const progress = button?.querySelector('.adv-inventory-ready')?.textContent?.trim() || '';
      const contextHint = contextualHint(item);
      const overlayAlreadyOpen = hasOpenOverlay(doc);
      const hasDirectAction = directConsumable(item) || activePassive(item, button);
      const allowedNow = hasDirectAction && !overlayAlreadyOpen && canUseAtCurrentState(target, item);
      const actionLabel = item.kind === 'consumable' || item.id === 'freed_spirit' ? 'Use' : 'Activate';
      const action = allowedNow
        ? `<button class="btn-gold" onclick="tlrAdventureV3ConfirmItemUse()">${actionLabel}</button>`
        : '';
      const unavailable = unavailableReason(target, item, overlayAlreadyOpen, hasDirectAction);
      const timing = item.timing ? TIMING_TEXT[item.timing] || '' : '';

      target.showOverlay(`<div class="result-panel pass adv-item-popup">
        <div class="rhead"><h3 class="pass">${esc(item.name)}</h3></div>
        ${itemArtMarkup(item, 'popup')}
        <div class="adv-item-popup__kind">${esc(item.kind)}</div>
        <p class="adv-item-popup__effect">${esc(item.text)}</p>
        ${timing ? `<p class="adv-item-popup__timing">${esc(timing)}</p>` : ''}
        ${progress ? `<div class="adv-item-popup__state">${esc(progress)}</div>` : ''}
        ${contextHint ? `<p class="adv-item-popup__hint">${esc(contextHint)}</p>` : ''}
        ${unavailable ? `<p class="adv-item-popup__hint">${esc(unavailable)}</p>` : ''}
        <div class="rbtns"><button onclick="tlrAdventureV3CloseItemPopup()">Close</button>${action}</div>
      </div>`);
      return true;
    };

    target.tlrAdventureV3CloseItemPopup = function closeAdventureItemPopup() {
      const popup = target.__tlrAdventureItemPopup;
      target.__tlrAdventureItemPopup = null;
      restoreOverlay(target, popup?.previous);
    };

    target.tlrAdventureV3ConfirmItemUse = function confirmAdventureItemUse() {
      const popup = target.__tlrAdventureItemPopup;
      if (!popup) return;
      target.__tlrAdventureItemPopup = null;
      if (typeof target.clearOverlay === 'function') target.clearOverlay();
      originalUse(popup.index);
    };

    return true;
  };

  if (!attach()) {
    const timer = target.setInterval(() => {
      if (attach()) target.clearInterval(timer);
    }, 50);
  }
}

if (typeof window !== 'undefined') installAdventureItemPopups(window);
