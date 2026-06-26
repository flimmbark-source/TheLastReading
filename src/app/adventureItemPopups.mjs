import { ADVENTURE_ITEMS } from '../data/adventure/adventureContentV3.mjs';

const STYLE_ID = 'adventure-item-popup-style';
const ITEM_LIST = Object.freeze(Object.values(ADVENTURE_ITEMS));

const TIMING_TEXT = Object.freeze({
  before: 'Use before playing a card.',
  between: 'Use between Events.',
  result: 'Use after a Success.',
  reward: 'Use on a reward screen.',
});

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, character => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]
  ));
}

function ensureStyle(doc) {
  if (!doc || doc.getElementById(STYLE_ID)) return;
  const style = doc.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
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
  `;
  doc.head.appendChild(style);
}

function itemButton(doc, index) {
  return doc?.querySelectorAll('#relicRack .adv-inventory-slot')?.[index] || null;
}

function itemFromButton(button) {
  const name = button?.querySelector('.adv-inventory-icon')?.textContent?.trim();
  return name ? ITEM_LIST.find(item => item.name === name) || null : null;
}

function hasOpenOverlay(doc) {
  const summary = doc?.getElementById('summary');
  return Boolean(summary?.innerHTML?.trim());
}

function captureOverlay(doc) {
  const summary = doc?.getElementById('summary');
  return {
    html: summary?.innerHTML || '',
    className: summary?.className || '',
  };
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
  return '';
}

function activePassive(item, button) {
  if (!item || item.kind === 'consumable') return false;
  if (item.active) return true;
  return item.id === 'freed_spirit' && button?.querySelector('.adv-inventory-ready')?.textContent?.trim() === 'Ready';
}

export function installAdventureItemPopups(target = window) {
  if (!target?.document || target.__tlrAdventureItemPopupsInstalled) return;
  target.__tlrAdventureItemPopupsInstalled = true;
  ensureStyle(target.document);

  const attach = () => {
    const originalUse = target.tlrAdventureV3UseItem;
    if (typeof originalUse !== 'function' || target.__tlrAdventureItemUseWrapped) return false;

    target.__tlrAdventureItemUseWrapped = true;
    target.__tlrAdventureV3UseItemOriginal = originalUse;

    target.tlrAdventureV3UseItem = function showAdventureItem(index) {
      const doc = target.document;
      const button = itemButton(doc, index);
      const item = itemFromButton(button);
      if (!item) return false;

      const previous = captureOverlay(doc);
      target.__tlrAdventureItemPopup = { index, previous };

      const progress = button?.querySelector('.adv-inventory-ready')?.textContent?.trim() || '';
      const contextHint = contextualHint(item);
      const overlayAlreadyOpen = hasOpenOverlay(doc);
      const canUseConsumable = directConsumable(item) && !overlayAlreadyOpen;
      const canActivatePassive = activePassive(item, button) && !overlayAlreadyOpen;
      const actionLabel = item.kind === 'consumable' ? 'Use' : 'Activate';
      const action = canUseConsumable || canActivatePassive
        ? `<button class="btn-gold" onclick="tlrAdventureV3ConfirmItemUse()">${actionLabel}</button>`
        : '';
      const unavailable = (directConsumable(item) || activePassive(item, button)) && overlayAlreadyOpen
        ? 'Finish the current result or reward choice before using this item.'
        : '';
      const timing = item.timing ? TIMING_TEXT[item.timing] || '' : '';

      target.showOverlay(`<div class="result-panel pass adv-item-popup">
        <div class="rhead"><h3 class="pass">${esc(item.name)}</h3></div>
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
