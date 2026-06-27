const STYLE_ID = 'adventure-item-reward-cleanup-style';

export function installAdventureItemRewardCleanup(target = window) {
  const doc = target?.document;
  if (!doc || doc.getElementById(STYLE_ID)) return;
  const style = doc.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    body.mode-adventure .adv-reward > .adv-item-art{display:none!important}
  `;
  doc.head.appendChild(style);
}

if (typeof window !== 'undefined') installAdventureItemRewardCleanup(window);
