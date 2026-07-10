import { EVENT_TRAITS } from './events.mjs';
import { ACTION_NODES } from './nodes.mjs';

const N = ACTION_NODES;

export const ADVENTURE_EVENTS_V3 = Object.freeze([
  Object.freeze({
    id: 'iron_gate', title: 'The Iron Gate', crest: 'Obstacle', traits: [EVENT_TRAITS.OBSTACLE],
    description: 'The king’s road ends at a black iron gate set between two crumbling pillars. Strange words cover the lock, the hinges are badly rusted, and part of the wall has begun to collapse.',
    outcomes: Object.freeze([
      Object.freeze({ id: 'wander', text: 'You follow the wall until fallen stones offer a difficult but passable route over it.', triumphText: 'Beyond the break, an old patrol path still survives. A weathered road map hangs inside the ruined guard post.', gainStatuses: ['prepared'] }),
      Object.freeze({ id: 'decipher', text: 'The carvings form an old command of passage. Spoken aloud, it releases the lock.', triumphText: 'You uncover the gatekeeper’s true word. The lock opens, and a blue-black ring drops from its center.', gainStatuses: ['haunted'] }),
      Object.freeze({ id: 'force', text: 'You strike the weakest hinge until rusted iron tears free.', triumphText: 'The gate crashes from its frame. A length of its broken chain remains intact in the road.' }),
    ]),
    failure: Object.freeze({ text: 'The gate defeats every attempt. The long detour drains what strength remains.', resolveChange: -1 }),
  }),
  Object.freeze({
    id: 'ambush', title: 'Ambush', crest: 'Hostile', traits: [EVENT_TRAITS.HOSTILE],
    description: 'Bandits rise from the ditches and close around the road. Their leader demands your pack, but their formation is loose, their horses are restless, and not every blade is held steadily.',
    outcomes: Object.freeze([
      Object.freeze({ id: 'guard', text: 'Every rush meets a steady guard. Their nerve fails before your strength does.', triumphText: 'They exhaust themselves without landing a blow. Their leader’s buckler lies abandoned in the road.' }),
      Object.freeze({ id: 'vanish', text: 'You draw their attention toward the wrong shadow and slip through the weakest point in their line.', triumphText: 'The ambush closes around an empty road. A smoke-dark cloak snags on a branch as you pass.' }),
      Object.freeze({ id: 'fight', text: 'You strike before the circle closes. The survivors retreat into the brush.', triumphText: 'Their formation breaks at once. Their leader falls, leaving a notched blade in the dust.', gainStatuses: ['distrusted'] }),
    ]),
    failure: Object.freeze({ text: 'The bandits drive you from the road. You escape wounded and badly shaken.', resolveChange: -1 }),
  }),
  Object.freeze({
    id: 'strange_shrine', title: 'Strange Shrine', crest: 'Mystery', traits: [EVENT_TRAITS.MYSTERY],
    description: 'A shrine to an unknown god stands at the crossroads, surrounded by fresh offerings. Its bronze figure holds one hand open and the other closed, as though waiting for you to choose between them.',
    outcomes: Object.freeze([
      Object.freeze({ id: 'commune', text: 'You kneel before the bronze figure. Something answers and leaves a cold mark beneath your skin.', triumphText: 'The presence answers clearly. A small blue light rises from the altar and follows at your shoulder.', gainStatuses: ['haunted'] }),
      Object.freeze({ id: 'honor', text: 'You place a respectful offering in the open hand. Warmth settles over the road ahead.', triumphText: 'The statue closes its hand around the offering. Prayer beads appear across its bronze wrist.', gainStatuses: ['blessed'] }),
      Object.freeze({ id: 'wager', text: 'You place a coin on the altar and cast the shrine’s bones. They fall in your favor.', triumphText: 'The bones land in an impossible pattern and remain warm in your palm.', gainStatuses: ['blessed'] }),
    ]),
    failure: Object.freeze({ text: 'The offering blackens in your hand. The bronze head turns, and something unseen fixes its attention upon you.', resolveChange: -1, gainStatuses: ['haunted'] }),
  }),
  Object.freeze({
    id: 'flooded_road', title: 'The Flooded Road', crest: 'Obstacle', traits: [EVENT_TRAITS.OBSTACLE],
    description: 'The river has swallowed the road and torn away the bridge. A frayed guide rope crosses the current, driftwood gathers along the bank, and old stonework is visible farther downstream.',
    outcomes: Object.freeze([
      Object.freeze({ id: 'wait', text: 'You watch the debris and learn the flood’s rhythm. By dusk, the water has fallen enough to pass.', triumphText: 'The river falls sooner than expected, revealing a copper charm wedged between the stones.', gainStatuses: ['prepared'] }),
      Object.freeze({ id: 'adapt', text: 'You stop resisting the current and let it carry you toward calmer water.', triumphText: 'Every turn of the river carries you closer to the road. A smooth green stone pulses in your hand when you step ashore.' }),
      Object.freeze({ id: 'ford', text: 'You enter at the shallowest point and fight the current step by step.', triumphText: 'You cross before the river can rise around you. A ferryman’s boots hang dry from a surviving post.' }),
    ]),
    failure: Object.freeze({ text: 'The current takes your feet. You crawl ashore downstream, bruised and exhausted.', resolveChange: -1 }),
  }),
  Object.freeze({
    id: 'cornered_beast', title: 'Cornered Beast', crest: 'Hostile', traits: [EVENT_TRAITS.HOSTILE],
    description: 'A wounded beast blocks the narrow pass, an iron trap still clamped around its leg. It snaps whenever you approach, though exhaustion weighs on it more heavily than rage.',
    outcomes: Object.freeze([
      Object.freeze({ id: 'soothe', text: 'You lower your weapon and speak softly until the beast allows you to approach.', triumphText: 'You free its leg and bind the wound. The beast follows you from the pass and does not turn back.', gainStatuses: ['blessed'] }),
      Object.freeze({ id: 'brace', text: 'You withstand each desperate lunge until exhaustion forces the beast to retreat.', triumphText: 'The beast spends itself against your defense. A strip of hide remains caught on the broken trap.' }),
      Object.freeze({ id: 'put_down', text: 'You wait for the beast’s lunge and end its suffering with one clean stroke.', triumphText: 'The blow is swift and certain. A single unbroken fang remains beside the body.' }),
    ]),
    failure: Object.freeze({ text: 'The beast strikes in blind terror. You escape the pass carrying deep wounds.', resolveChange: -1 }),
  }),
  Object.freeze({
    id: 'traveling_merchant', title: 'The Traveling Merchant', crest: 'Social', traits: [EVENT_TRAITS.SOCIAL],
    description: 'A brightly painted wagon waits beside the road. Its merchant greets you warmly, names an ambitious price, and keeps a pair of dice beside the scales in case bargaining becomes dull.',
    outcomes: Object.freeze([
      Object.freeze({ id: 'bargain', text: 'You challenge every weight and price until the merchant finally offers fair terms.', triumphText: 'You catch every trick before it begins. Laughing, the merchant presses a signet into your palm.' }),
      Object.freeze({ id: 'dice', text: 'You wager the price on the merchant’s dice and win.', triumphText: 'The merchant changes dice twice and still loses. At last, the loaded pair becomes yours.' }),
      Object.freeze({ id: 'rob', text: 'You draw steel and take what you need. The merchant survives to spread the story.', triumphText: 'The robbery is swift. You leave with the merchant’s locked strongbox beneath your arm.', gainStatuses: ['distrusted'] }),
    ]),
    failure: Object.freeze({ text: 'The merchant reads your eagerness and leads you into a poor bargain. You leave angry and embarrassed.', resolveChange: -1 }),
  }),
  Object.freeze({
    id: 'suspicious_villagers', title: 'Suspicious Villagers', crest: 'Social', traits: [EVENT_TRAITS.SOCIAL],
    description: 'The village falls silent when you enter. Its elders gather in the square and demand to know your business, while the others watch from doorways to see what sort of stranger you are.',
    outcomes: Object.freeze([
      Object.freeze({ id: 'reassure', text: 'You answer every question plainly until the crowd begins to disperse.', triumphText: 'Your honesty wins the elders completely. They press a stamped village token into your hand.', removeStatuses: ['distrusted'] }),
      Object.freeze({ id: 'impress', text: 'A skillful display replaces suspicion with curiosity.', triumphText: 'The square erupts in applause. The village artisan marks your work and promises their favor.', gainStatuses: ['prepared'] }),
      Object.freeze({ id: 'cow', text: 'You make the cost of opposing you unmistakably clear. The elders step aside.', triumphText: 'The square empties at a single threat. The elder leaves a black iron seal on the stones rather than challenge you.', gainStatuses: ['distrusted'] }),
    ]),
    failure: Object.freeze({ text: 'Every answer sounds wrong. The villagers drive you out and make certain others know your face.', resolveChange: -1, gainStatuses: ['exposed'] }),
  }),
  Object.freeze({
    id: 'unmarked_grave', title: 'The Unmarked Grave', crest: 'Mystery', traits: [EVENT_TRAITS.MYSTERY],
    description: 'A fresh grave lies beside the road, ringed with pale stones but marked with no name. A faded soldier’s crest has been scratched into one stone, and the earth remains strangely cold.',
    outcomes: Object.freeze([
      Object.freeze({ id: 'honor', text: 'You reset the stones and speak the rites you know. The cold around the grave lifts.', triumphText: 'The dead accept your courtesy. A grave candle lights itself beside the mound.', gainStatuses: ['blessed'] }),
      Object.freeze({ id: 'investigate', text: 'The crest, soil, and stones reveal that the burial was hurried and deliberately hidden.', triumphText: 'You identify the buried soldier. Their insignia lies beneath the final stone.', gainStatuses: ['prepared'] }),
      Object.freeze({ id: 'release', text: 'You loosen the bindings holding the spirit to the mound. The presence departs.', triumphText: 'The spirit steps free of the grave and waits beside you, no longer bound to the earth.', specialConsequence: 'release_spirit' }),
    ]),
    failure: Object.freeze({ text: 'The stones crack and the earth turns cold beneath your feet. Something in the grave learns your name.', resolveChange: -1, gainStatuses: ['haunted'] }),
  }),
  Object.freeze({
    id: 'beneath_the_floor', title: 'Beneath the Floor', crest: 'Supernatural', traits: [EVENT_TRAITS.SUPERNATURAL],
    description: 'The abandoned house still holds warm ashes and dishes set for a meal. Beneath the floorboards, something large moves whenever you move and becomes perfectly still whenever you stop.',
    outcomes: Object.freeze([
      Object.freeze({ id: 'commune', text: 'You press your hand to the boards and listen. The thing answers in borrowed memories.', triumphText: 'It shares one true secret. One whisper remains in the house, and another settles inside you.', gainStatuses: ['haunted'] }),
      Object.freeze({ id: 'seal', text: 'You reinforce the boards and mark every threshold. The movement beneath the house stops.', triumphText: 'The final mark closes. A handful of black iron nails rises warm from the boards.' }),
      Object.freeze({ id: 'confront', text: 'You tear open the boards and face the creature in its hiding place. It retreats beneath the foundations.', triumphText: 'You drag the creature into daylight. It flees, leaving one black claw behind.', gainStatuses: ['haunted'] }),
    ]),
    failure: Object.freeze({ text: 'The floor erupts beneath you. You escape, but the thing below has caught your scent.', resolveChange: -1, gainStatuses: ['haunted'] }),
  }),
  Object.freeze({
    id: 'whispering_tree', title: 'The Whispering Tree', crest: 'Supernatural', traits: [EVENT_TRAITS.SUPERNATURAL],
    description: 'A lone tree grows in a field where nothing else survives. Charms and old offerings hang from its branches, while its leaves whisper your name despite the absence of wind.',
    outcomes: Object.freeze([
      Object.freeze({ id: 'heed', text: 'You sit beneath the branches until the whispers become words. They warn of danger ahead.', triumphText: 'One voice rises above the rest. A leaf detaches and whispers the shape of the road ahead.', gainStatuses: ['haunted'] }),
      Object.freeze({ id: 'offering', text: 'You place a gift among the roots. The voices soften and speak your name with favor.', triumphText: 'The roots accept your offering. A single silver leaf falls into your hand.', gainStatuses: ['blessed'] }),
      Object.freeze({ id: 'silence', text: 'Your axe bites into the pale trunk. The whispers rise into a scream and stop.', triumphText: 'The tree falls in one clean stroke. Its pale wood remains hard enough to hold an edge.', gainStatuses: ['haunted'] }),
    ]),
    failure: Object.freeze({ text: 'The whispers uncover memories you meant to keep hidden. They follow you from the field in familiar voices.', resolveChange: -1, gainStatuses: ['haunted'] }),
  }),
]);

export const RECOVERY_EVENT_V3 = Object.freeze({
  id: 'recovery_camp', title: 'A Moment to Breathe',
  description: 'The road opens onto an abandoned hunter’s camp beneath the pines. Embers remain in the fire, a clear spring runs nearby, and an old traveler’s pack rests beneath the shelter.',
  choices: Object.freeze([
    Object.freeze({ id: 'rest', label: 'Rest — Restore 2 [[resolve]]' }),
    Object.freeze({ id: 'cleanse', label: 'Cleanse — Remove 1 [[status]]' }),
    Object.freeze({ id: 'search', label: 'Search the Pack — Choose 1 of 3 Consumables' }),
  ]),
});

export const CONSUMABLES = Object.freeze({
  healing_draught: Object.freeze({ id: 'healing_draught', name: 'Healing Draught', kind: 'consumable', text: 'Restore 2 [[resolve]].', timing: 'between' }),
  whetstone: Object.freeze({ id: 'whetstone', name: 'Whetstone', kind: 'consumable', text: 'Your next card gains +3.', timing: 'before' }),
  iron_ward: Object.freeze({ id: 'iron_ward', name: 'Iron Ward', kind: 'consumable', text: 'Prevent the next [[resolve]] loss.', timing: 'before' }),
  black_salt: Object.freeze({ id: 'black_salt', name: 'Black Salt', kind: 'consumable', text: 'Prevent the next Haunted.', timing: 'before' }),
  smoke_bomb: Object.freeze({ id: 'smoke_bomb', name: 'Smoke Bomb', kind: 'consumable', text: 'Move the current [[event]] to the end of the Set.', timing: 'before' }),
  purifying_water: Object.freeze({ id: 'purifying_water', name: 'Purifying Water', kind: 'consumable', text: 'Remove 1 [[status]].', timing: 'between' }),
  marked_coin: Object.freeze({ id: 'marked_coin', name: 'Marked Coin', kind: 'consumable', text: 'Turn a Success into a Great Success.', timing: 'result' }),
  spyglass: Object.freeze({ id: 'spyglass', name: 'Spyglass', kind: 'consumable', text: '[[reveal]] the next 2 [[event|Events]].', timing: 'between' }),
  disguise_kit: Object.freeze({ id: 'disguise_kit', name: 'Disguise Kit', kind: 'consumable', text: 'Remove Distrusted or Exposed.', timing: 'between' }),
  blessed_oil: Object.freeze({ id: 'blessed_oil', name: 'Blessed Oil', kind: 'consumable', text: 'Gain Blessed.', timing: 'between' }),
  lucky_token: Object.freeze({ id: 'lucky_token', name: 'Lucky Token', kind: 'consumable', text: 'Reroll 1 reward offer.', timing: 'reward' }),
  transmutation_dust: Object.freeze({ id: 'transmutation_dust', name: 'Transmutation Dust', kind: 'consumable', text: 'Change 1 card’s sigil to Serpent.', timing: 'between' }),
});

export const SIGNATURE_ITEMS = Object.freeze({
  old_road_map: Object.freeze({ id: 'old_road_map', name: 'Old Road Map', kind: 'passive', text: 'Once per Set, move the current [[event]] to the end of the Set.', active: 'skip_event' }),
  gatekeepers_ring: Object.freeze({ id: 'gatekeepers_ring', name: 'Gatekeeper’s Ring', kind: 'passive', text: 'Once per set, make an Omen or Crown card a Great Success.', active: 'great_moon_crown' }),
  broken_chain: Object.freeze({ id: 'broken_chain', name: 'Broken Chain', kind: 'passive', text: 'Might and Blade cards gain +1.' }),
  bandits_buckler: Object.freeze({ id: 'bandits_buckler', name: 'Bandit’s Buckler', kind: 'passive', text: 'The first Hostile Failure each Set costs 0 [[resolve]].' }),
  smoke_cloth_cloak: Object.freeze({ id: 'smoke_cloth_cloak', name: 'Smoke-Cloth Cloak', kind: 'passive', text: 'After a Mask Success, remove Exposed or Distrusted.' }),
  notched_blade: Object.freeze({ id: 'notched_blade', name: 'Notched Blade', kind: 'passive', text: 'Blade Great Successes show +1 reward offer.' }),
  shrine_spirit: Object.freeze({ id: 'shrine_spirit', name: 'Shrine Spirit', kind: 'companion', text: 'After an Omen Great Success, gain Blessed.' }),
  prayer_beads: Object.freeze({ id: 'prayer_beads', name: 'Prayer Beads', kind: 'passive', text: 'Great Success restores 1 [[resolve]].' }),
  lucky_bones: Object.freeze({ id: 'lucky_bones', name: 'Lucky Bones', kind: 'passive', text: 'Once per reward screen, reroll 1 offer within its lane.', active: 'reroll_one' }),
  riverwatch_charm: Object.freeze({ id: 'riverwatch_charm', name: 'Riverwatch Charm', kind: 'passive', text: 'After 2 [[event|Events]] without losing [[resolve]], restore 1 [[resolve]].' }),
  river_stone_charm: Object.freeze({ id: 'river_stone_charm', name: 'River-Stone Charm', kind: 'passive', text: 'Once per set, make a Serpent card a Great Success.', active: 'great_serpent' }),
  ferrymans_boots: Object.freeze({ id: 'ferrymans_boots', name: 'Ferryman’s Boots', kind: 'passive', text: 'Cards gain +1 Potency on Obstacle [[event|Events]].' }),
  greyfang: Object.freeze({ id: 'greyfang', name: 'Greyfang', kind: 'companion', text: 'Every 3 Events, your next card gains +2.' }),
  hide_mantle: Object.freeze({ id: 'hide_mantle', name: 'Hide Mantle', kind: 'passive', text: 'Shield and Mountain cards gain +1 on Hostile Events.' }),
  beast_fang_knife: Object.freeze({ id: 'beast_fang_knife', name: 'Beast-Fang Knife', kind: 'passive', text: 'Hostile Great Successes restore 1 [[resolve]].' }),
  merchants_signet: Object.freeze({ id: 'merchants_signet', name: 'Merchant’s Signet', kind: 'passive', text: 'Once per reward screen, replace 1 non-Trophy offer with a reward from another lane.', active: 'reroll_one' }),
  loaded_dice: Object.freeze({ id: 'loaded_dice', name: 'Loaded Dice', kind: 'passive', text: 'Once per set, reroll all reward offers within their lanes. Keep either set.', active: 'reroll_all' }),
  stolen_strongbox: Object.freeze({ id: 'stolen_strongbox', name: 'Stolen Strongbox', kind: 'cache', text: 'Choose 1 of 3 passive items.' }),
  village_token: Object.freeze({ id: 'village_token', name: 'Village Token', kind: 'passive', text: 'Once per set, prevent Distrusted or Exposed.' }),
  artisans_favor: Object.freeze({ id: 'artisans_favor', name: 'Artisan’s Favor', kind: 'passive', text: 'Forge Great Successes show +1 card offer.' }),
  black_iron_seal: Object.freeze({ id: 'black_iron_seal', name: 'Black Iron Seal', kind: 'pact', text: 'Crown cards gain +1. Heart cards lose 1.' }),
  gravekeepers_candle: Object.freeze({ id: 'gravekeepers_candle', name: 'Gravekeeper’s Candle', kind: 'passive', text: 'The first Haunted gained each set becomes Blessed.' }),
  soldiers_insignia: Object.freeze({ id: 'soldiers_insignia', name: 'Soldier’s Insignia', kind: 'passive', text: 'Eye Great Successes [[reveal]] the next 2 [[event|Events]].' }),
  freed_spirit: Object.freeze({ id: 'freed_spirit', name: 'Freed Spirit', kind: 'companion', text: 'Every 3 Events, choose 1 Status to remove.' }),
  house_whisper: Object.freeze({ id: 'house_whisper', name: 'House Whisper', kind: 'pact', text: 'Preview Omen card results. Omen Failures gain Haunted.' }),
  warded_iron_nails: Object.freeze({ id: 'warded_iron_nails', name: 'Warded Iron Nails', kind: 'passive', text: 'Shield and Forge cards gain +1 Potency on Supernatural [[event|Events]].' }),
  black_claw: Object.freeze({ id: 'black_claw', name: 'Black Claw', kind: 'pact', text: 'Once per set, make a Blade card a Great Success on a Supernatural Event. Blade Failures on Supernatural Events cost +1 Resolve.', active: 'great_blade_supernatural' }),
  whispering_leaf: Object.freeze({ id: 'whispering_leaf', name: 'Whispering Leaf', kind: 'passive', text: 'Once per Set, [[reveal]] the next 2 [[event|Events]] and [[choose]] their order.', active: 'reorder_events' }),
  silver_leaf: Object.freeze({ id: 'silver_leaf', name: 'Silver Leaf', kind: 'passive', text: 'While Blessed, Heart and Omen cards gain +1.' }),
  palewood_axe: Object.freeze({ id: 'palewood_axe', name: 'Palewood Axe', kind: 'passive', text: 'Blade Great Successes gain Prepared.' }),
});

export const ADVENTURE_ITEMS = Object.freeze({ ...CONSUMABLES, ...SIGNATURE_ITEMS });
export const CONSUMABLE_LIST = Object.freeze(Object.values(CONSUMABLES));
export const PASSIVE_ITEM_LIST = Object.freeze(Object.values(SIGNATURE_ITEMS).filter(item => item.kind !== 'cache'));

const add = (...nodes) => Object.freeze({ type: 'ADD_SIGIL_CARD', nodes });
const upgrade = (...nodes) => Object.freeze({ type: 'UPGRADE_CARD', nodes });
const consume = id => Object.freeze({ type: 'CONSUMABLE', itemId: id });
const banishTwo = Object.freeze({ type: 'BANISH_TWO' });
const chooseConsumable = Object.freeze({ type: 'CHOOSE_CONSUMABLE' });
const signature = itemId => Object.freeze({ type: 'SIGNATURE_ITEM', itemId });

export const OUTCOME_REWARDS = Object.freeze({
  'iron_gate:wander':              Object.freeze({ reinforce: add(N.INVESTIGATION),               provision: consume('spyglass'),           crossroads: upgrade(N.FORTUNE, N.MYSTERY),          signature: signature('old_road_map') }),
  'iron_gate:decipher':            Object.freeze({ reinforce: add(N.MYSTERY),                     provision: consume('black_salt'),          crossroads: upgrade(N.AUTHORITY),                   signature: signature('gatekeepers_ring') }),
  'iron_gate:force':               Object.freeze({ reinforce: add(N.PHYSICAL, N.AGGRESSION),      provision: consume('whetstone'),           crossroads: upgrade(N.INVESTIGATION, N.ENDURANCE),  signature: signature('broken_chain') }),
  'ambush:guard':                  Object.freeze({ reinforce: add(N.PROTECTION),                  provision: consume('iron_ward'),           crossroads: upgrade(N.ENDURANCE),                   signature: signature('bandits_buckler') }),
  'ambush:vanish':                 Object.freeze({ reinforce: upgrade(N.DECEPTION),               provision: consume('smoke_bomb'),          crossroads: banishTwo,                             signature: signature('smoke_cloth_cloak') }),
  'ambush:fight':                  Object.freeze({ reinforce: add(N.AGGRESSION),                  provision: consume('whetstone'),           crossroads: upgrade(N.PROTECTION, N.INVESTIGATION), signature: signature('notched_blade') }),
  'strange_shrine:commune':        Object.freeze({ reinforce: add(N.MYSTERY),                     provision: consume('black_salt'),          crossroads: banishTwo,                             signature: signature('shrine_spirit') }),
  'strange_shrine:honor':          Object.freeze({ reinforce: add(N.COMPASSION),                  provision: consume('blessed_oil'),         crossroads: consume('purifying_water'),             signature: signature('prayer_beads') }),
  'strange_shrine:wager':          Object.freeze({ reinforce: add(N.FORTUNE),                     provision: consume('marked_coin'),         crossroads: upgrade(N.MYSTERY),                    signature: signature('lucky_bones') }),
  'flooded_road:wait':             Object.freeze({ reinforce: add(N.ENDURANCE),                   provision: consume('healing_draught'),     crossroads: consume('spyglass'),                    signature: signature('riverwatch_charm') }),
  'flooded_road:adapt':            Object.freeze({ reinforce: upgrade(N.TRANSFORMATION),          provision: consume('transmutation_dust'),  crossroads: banishTwo,                             signature: signature('river_stone_charm') }),
  'flooded_road:ford':             Object.freeze({ reinforce: add(N.PHYSICAL),                    provision: consume('whetstone'),           crossroads: upgrade(N.ENDURANCE),                  signature: signature('ferrymans_boots') }),
  'cornered_beast:soothe':         Object.freeze({ reinforce: add(N.COMPASSION),                  provision: consume('purifying_water'),     crossroads: banishTwo,                             signature: signature('greyfang') }),
  'cornered_beast:brace':          Object.freeze({ reinforce: add(N.PROTECTION),                  provision: consume('iron_ward'),           crossroads: upgrade(N.AGGRESSION),                 signature: signature('hide_mantle') }),
  'cornered_beast:put_down':       Object.freeze({ reinforce: add(N.AGGRESSION),                  provision: consume('whetstone'),           crossroads: banishTwo,                             signature: signature('beast_fang_knife') }),
  'traveling_merchant:bargain':    Object.freeze({ reinforce: upgrade(N.AUTHORITY),               provision: consume('lucky_token'),         crossroads: banishTwo,                             signature: signature('merchants_signet') }),
  'traveling_merchant:dice':       Object.freeze({ reinforce: add(N.FORTUNE),                     provision: consume('marked_coin'),         crossroads: upgrade(N.DECEPTION),                  signature: signature('loaded_dice') }),
  'traveling_merchant:rob':        Object.freeze({ reinforce: add(N.AGGRESSION, N.DECEPTION),     provision: consume('whetstone'),           crossroads: chooseConsumable,                       signature: signature('stolen_strongbox') }),
  'suspicious_villagers:reassure': Object.freeze({ reinforce: add(N.COMPASSION),                  provision: consume('purifying_water'),     crossroads: upgrade(N.AUTHORITY, N.INVESTIGATION),  signature: signature('village_token') }),
  'suspicious_villagers:impress':  Object.freeze({ reinforce: add(N.CREATION),                    provision: consume('disguise_kit'),        crossroads: upgrade(N.AUTHORITY),                   signature: signature('artisans_favor') }),
  'suspicious_villagers:cow':      Object.freeze({ reinforce: add(N.AUTHORITY, N.AGGRESSION),     provision: consume('whetstone'),           crossroads: banishTwo,                             signature: signature('black_iron_seal') }),
  'unmarked_grave:honor':          Object.freeze({ reinforce: add(N.COMPASSION),                  provision: consume('blessed_oil'),         crossroads: consume('purifying_water'),             signature: signature('gravekeepers_candle') }),
  'unmarked_grave:investigate':    Object.freeze({ reinforce: add(N.INVESTIGATION),               provision: consume('spyglass'),            crossroads: upgrade(N.COMPASSION, N.MYSTERY),       signature: signature('soldiers_insignia') }),
  'unmarked_grave:release':        Object.freeze({ reinforce: add(N.TRANSFORMATION, N.COMPASSION),provision: consume('purifying_water'),     crossroads: consume('black_salt'),                  signature: signature('freed_spirit') }),
  'beneath_the_floor:commune':     Object.freeze({ reinforce: add(N.MYSTERY),                     provision: consume('black_salt'),          crossroads: consume('spyglass'),                    signature: signature('house_whisper') }),
  'beneath_the_floor:seal':        Object.freeze({ reinforce: add(N.PROTECTION, N.CREATION),      provision: consume('iron_ward'),           crossroads: banishTwo,                             signature: signature('warded_iron_nails') }),
  'beneath_the_floor:confront':    Object.freeze({ reinforce: add(N.AGGRESSION),                  provision: consume('whetstone'),           crossroads: banishTwo,                             signature: signature('black_claw') }),
  'whispering_tree:heed':          Object.freeze({ reinforce: add(N.MYSTERY, N.INVESTIGATION),    provision: consume('spyglass'),            crossroads: consume('black_salt'),                  signature: signature('whispering_leaf') }),
  'whispering_tree:offering':      Object.freeze({ reinforce: add(N.COMPASSION),                  provision: consume('blessed_oil'),         crossroads: consume('purifying_water'),             signature: signature('silver_leaf') }),
  'whispering_tree:silence':       Object.freeze({ reinforce: add(N.AGGRESSION, N.CREATION),      provision: consume('whetstone'),           crossroads: banishTwo,                             signature: signature('palewood_axe') }),
});

export function getAdventureEventV3(id) {
  return ADVENTURE_EVENTS_V3.find(event => event.id === id) || null;
}

export function getOutcomeRewardProfile(eventId, outcomeId) {
  return OUTCOME_REWARDS[`${eventId}:${outcomeId}`] || null;
}
