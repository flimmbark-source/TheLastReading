import { RELIC_LIST } from './relics.mjs';

export const SHOP_ITEM_TYPES = Object.freeze({
  UPGRADE: 'upgrade',
  RELIC: 'relic',
  PACK: 'pack',
});

export const SHOP_UPGRADES = Object.freeze([
  {
    id: 'upgrade_discards',
    type: SHOP_ITEM_TYPES.UPGRADE,
    upgradeKey: 'discards',
    name: 'Extra Discard',
    description: 'Gain [[discard|+1 Discard]] each [[reading]].',
    cost: 18,
    maxLevel: 4,
  },
  {
    id: 'upgrade_hand',
    type: SHOP_ITEM_TYPES.UPGRADE,
    upgradeKey: 'hand',
    name: 'Larger Hand',
    description: 'Gain +1 Hand Size each [[reading]].',
    cost: 28,
    maxLevel: 3,
  },
  {
    id: 'upgrade_rank',
    type: SHOP_ITEM_TYPES.UPGRADE,
    upgradeKey: 'rank',
    name: 'Rank Bonus',
    description: 'Three/Four of a Kind gain [[chips|+5 Chips]].',
    cost: 18,
    maxLevel: 5,
  },
  {
    id: 'upgrade_rank_mult',
    type: SHOP_ITEM_TYPES.UPGRADE,
    upgradeKey: 'rank_mult',
    name: 'Rank Mult',
    description: 'Three/Four of a Kind gain [[mult|+0.25 Mult]].',
    cost: 24,
    maxLevel: 5,
  },
  {
    id: 'upgrade_sequence',
    type: SHOP_ITEM_TYPES.UPGRADE,
    upgradeKey: 'sequence',
    name: 'Sequence Bonus',
    description: 'Sequences gain [[chips|+5 Chips]].',
    cost: 18,
    maxLevel: 5,
  },
  {
    id: 'upgrade_seq_mult',
    type: SHOP_ITEM_TYPES.UPGRADE,
    upgradeKey: 'seq_mult',
    name: 'Sequence Mult',
    description: 'Sequences gain [[mult|+0.5 Mult]].',
    cost: 26,
    maxLevel: 4,
  },
  {
    id: 'upgrade_court_chips',
    type: SHOP_ITEM_TYPES.UPGRADE,
    upgradeKey: 'court_chips',
    name: 'Court Bonus',
    description: 'Full/Royal Court gain [[chips|+8 Chips]].',
    cost: 20,
    maxLevel: 5,
  },
  {
    id: 'upgrade_court_mult',
    type: SHOP_ITEM_TYPES.UPGRADE,
    upgradeKey: 'court_mult',
    name: 'Court Mult',
    description: 'Full/Royal Court gain [[mult|+0.25 Mult]].',
    cost: 26,
    maxLevel: 4,
  },
  {
    id: 'upgrade_path_chips',
    type: SHOP_ITEM_TYPES.UPGRADE,
    upgradeKey: 'path_chips',
    name: 'Path Bonus',
    description: 'Path of the Magi gains [[chips|+15 Chips]].',
    cost: 22,
    maxLevel: 4,
  },
  {
    id: 'upgrade_path_mult',
    type: SHOP_ITEM_TYPES.UPGRADE,
    upgradeKey: 'path_mult',
    name: 'Path Mult',
    description: 'Path of the Magi gains [[mult|+0.5 Mult]].',
    cost: 30,
    maxLevel: 3,
  },
]);

export const SHOP_RELICS = Object.freeze(
  RELIC_LIST.map(relic => ({
    id: `relic_${relic.id}`,
    type: SHOP_ITEM_TYPES.RELIC,
    relicId: relic.id,
    name: relic.name,
    icon: relic.icon,
    description: relic.description,
    cost: 30,
    maxLevel: 1,
  }))
);

export const SHOP_ITEMS = Object.freeze([...SHOP_UPGRADES, ...SHOP_RELICS]);

export function getShopItem(id) {
  return SHOP_ITEMS.find(item => item.id === id) || null;
}
