// Adventure Mode — event pool (vertical-slice subset).
//
// The full prototype targets 10 standard events + a recovery + the Woman In
// The Well boss. This slice ships three standard events and the recovery to
// prove the loop end-to-end; the schema below is exactly what the remaining
// content will fill in.

export const EVENT_TRAITS = Object.freeze({
  HOSTILE: 'HOSTILE',
  SOCIAL: 'SOCIAL',
  OBSTACLE: 'OBSTACLE',
  TRAVEL: 'TRAVEL',
  MYSTERY: 'MYSTERY',
  SUPERNATURAL: 'SUPERNATURAL',
});

export const EVENT_KINDS = Object.freeze({
  STANDARD: 'standard',
  RECOVERY: 'recovery',
  BOSS: 'boss',
});

/**
 * @typedef {Object} AdventureOutcome
 * @property {string} id
 * @property {string[]} triggerMeanings   meaning tags that vote for this outcome
 * @property {string} text                narrative shown on success
 * @property {string} [triumphText]       replaces text on triumph
 * @property {string[]} [gainStatuses]
 * @property {string[]} [removeStatuses]
 * @property {number} [resolveChange]
 */

/**
 * @typedef {Object} AdventureEvent
 * @property {string} id
 * @property {string} title
 * @property {string} description
 * @property {number} targetScore
 * @property {number} triumphScore
 * @property {string[]} traits
 * @property {AdventureOutcome[]} outcomes
 * @property {AdventureOutcome} failure
 */

/** @type {AdventureEvent[]} */
export const ADVENTURE_EVENTS = Object.freeze([
  {
    id: 'iron_gate',
    kind: EVENT_KINDS.STANDARD,
    title: 'The Iron Gate',
    description:
      'A black iron gate bars the road, older than the kingdom and carved with symbols no one living can read. Lay a reading against it.',
    traits: [EVENT_TRAITS.OBSTACLE],
    targetScore: 22,
    triumphScore: 38,
    outcomes: [
      {
        id: 'force',
        triggerMeanings: ['violence', 'courage', 'persistence'],
        text: 'You set your shoulder to the iron and the old hinges scream. The gate gives way.',
        triumphText: 'The gate tears from its frame entirely. Nothing here will bar your way again.',
      },
      {
        id: 'decipher',
        triggerMeanings: ['intuition', 'secrets', 'authority'],
        text: 'The carvings resolve into meaning as you read. You speak the word, and the gate swings wide on its own.',
        triumphText: 'You read more than the lock — you read its maker. The gate opens, and you keep the word.',
        gainStatuses: ['haunted'],
      },
      {
        id: 'wander',
        triggerMeanings: ['curiosity', 'change', 'compassion'],
        text: 'You follow the wall instead of fighting it and find a gap where the stone has slumped.',
        triumphText: 'The detour reveals a sheltered hollow with supplies left by an earlier traveler.',
      },
    ],
    failure: {
      id: 'iron_gate_fail',
      triggerMeanings: [],
      text: 'The iron does not care for your reading. You lose the day searching for another road.',
      resolveChange: -1,
    },
  },
  {
    id: 'ambush',
    kind: EVENT_KINDS.STANDARD,
    title: 'Ambush',
    description:
      'Figures rise from the ditch on either side of the path, blades already drawn. There is no time to run.',
    traits: [EVENT_TRAITS.HOSTILE],
    targetScore: 24,
    triumphScore: 40,
    outcomes: [
      {
        id: 'fight',
        triggerMeanings: ['violence', 'courage'],
        text: 'You meet them head on. It is brief and ugly, and you are the one left standing.',
        triumphText: 'You break them so thoroughly the survivors flee and spread your name as a warning.',
      },
      {
        id: 'parley',
        triggerMeanings: ['compassion', 'authority', 'intuition'],
        text: 'You read the fear under their bravado and offer them a way out. They take it.',
        triumphText: 'You turn the ambush into a bargain — they leave you a guide as tribute.',
        gainStatuses: ['exposed'],
      },
      {
        id: 'vanish',
        triggerMeanings: ['secrets', 'fear', 'change'],
        text: 'You let the dusk and their nerves do your work, slipping away before the trap fully closes.',
        triumphText: 'Not one of them is sure you were ever real. You leave them arguing in the dark.',
      },
    ],
    failure: {
      id: 'ambush_fail',
      triggerMeanings: [],
      text: 'The reading falters and the blades do not. You escape, but barely, and bleeding.',
      resolveChange: -1,
    },
  },
  {
    id: 'strange_shrine',
    kind: EVENT_KINDS.STANDARD,
    title: 'Strange Shrine',
    description:
      'A shrine to no god you recognise stands at the crossroads, offerings fresh despite the empty country around it.',
    traits: [EVENT_TRAITS.MYSTERY],
    targetScore: 22,
    triumphScore: 38,
    outcomes: [
      {
        id: 'commune',
        triggerMeanings: ['intuition', 'secrets', 'fear'],
        text: 'You kneel and read. Something old reads you back, and leaves a mark of its attention.',
        triumphText: 'The presence is pleased. It whispers a true thing before it withdraws.',
        gainStatuses: ['haunted'],
      },
      {
        id: 'honor',
        triggerMeanings: ['compassion', 'persistence', 'authority'],
        text: 'You leave a respectful offering and move on. The road ahead feels lighter.',
        triumphText: 'Your offering is answered with a blessing you feel settle over you like warm light.',
        gainStatuses: ['blessed'],
      },
      {
        id: 'plunder',
        triggerMeanings: ['violence', 'curiosity', 'change'],
        text: 'You take what is useful and leave. Practical, if perhaps unwise.',
        triumphText: 'You strip the shrine clean and nothing strikes you down. Maybe nothing was watching.',
        gainStatuses: ['distrusted'],
      },
    ],
    failure: {
      id: 'strange_shrine_fail',
      triggerMeanings: [],
      text: 'The shrine gives you nothing but a cold certainty that you have been noticed.',
      resolveChange: -1,
      gainStatuses: ['haunted'],
    },
  },
  {
    id: 'flooded_road',
    kind: EVENT_KINDS.STANDARD,
    title: 'The Flooded Road',
    description: 'The river has burst its banks and swallowed the road. Brown water churns where the path should be.',
    traits: [EVENT_TRAITS.OBSTACLE],
    targetScore: 22,
    triumphScore: 38,
    outcomes: [
      {
        id: 'ford',
        triggerMeanings: ['courage', 'persistence', 'change'],
        text: 'You wade in and fight the current step by step until your boots find the far bank.',
        triumphText: 'You cross as if the river had agreed to part for you, and reach the other side dry above the knee.',
      },
      {
        id: 'wait',
        triggerMeanings: ['persistence', 'intuition', 'compassion'],
        text: 'You read the water and wait. By dusk it has dropped enough to pass.',
        triumphText: 'Your patience is rewarded twice — the flood reveals a cache of goods it tore from somewhere upstream.',
      },
      {
        id: 'crossing',
        triggerMeanings: ['curiosity', 'authority', 'secrets'],
        text: 'You follow the bank until an old half-sunk bridge offers a way over.',
        triumphText: 'The forgotten bridge leads somewhere better than the road ever would have.',
      },
    ],
    failure: {
      id: 'flooded_road_fail',
      triggerMeanings: [],
      text: 'The current takes your feet and drags you downstream. You crawl out far from where you meant to be.',
      resolveChange: -1,
    },
  },
  {
    id: 'cornered_beast',
    kind: EVENT_KINDS.STANDARD,
    title: 'Cornered Beast',
    description: 'Something large and wounded blocks the way, hackles up, too hurt to flee and too afraid to let you pass.',
    traits: [EVENT_TRAITS.HOSTILE],
    targetScore: 24,
    triumphScore: 40,
    outcomes: [
      {
        id: 'put_down',
        triggerMeanings: ['violence', 'courage'],
        text: 'You end it cleanly. It is the kindest thing you have to offer.',
        triumphText: 'You end it with one sure stroke, and the road respects you a little for it.',
      },
      {
        id: 'soothe',
        triggerMeanings: ['compassion', 'intuition', 'persistence'],
        text: 'You speak low and slow until the fear leaves its eyes, and it limps aside to let you pass.',
        triumphText: 'It follows you a while, and its company keeps lesser things at bay.',
        gainStatuses: ['blessed'],
      },
      {
        id: 'slip_past',
        triggerMeanings: ['fear', 'secrets', 'change'],
        text: 'You wait for its attention to waver and slip past while it watches the wrong shadow.',
        triumphText: 'You move like you were never there at all.',
      },
    ],
    failure: {
      id: 'cornered_beast_fail',
      triggerMeanings: [],
      text: 'It comes at you in a panic of teeth and weight. You drive it off, but not unmarked.',
      resolveChange: -1,
    },
  },
  {
    id: 'traveling_merchant',
    kind: EVENT_KINDS.STANDARD,
    title: 'The Traveling Merchant',
    description: 'A laden cart waits at the roadside. Its keeper smiles too easily and watches your hands.',
    traits: [EVENT_TRAITS.SOCIAL],
    targetScore: 22,
    triumphScore: 38,
    outcomes: [
      {
        id: 'bargain',
        triggerMeanings: ['authority', 'persistence', 'curiosity'],
        text: 'You haggle hard and fair, and walk away with the better end of the deal.',
        triumphText: 'You read the merchant so well they throw in a trinket just to end the conversation.',
      },
      {
        id: 'charm',
        triggerMeanings: ['compassion', 'courage', 'change'],
        text: 'You win them over with warmth, and the price softens with the mood.',
        triumphText: 'By the end they count you a friend, and friends get the friend price.',
      },
      {
        id: 'rob',
        triggerMeanings: ['violence', 'secrets', 'fear'],
        text: 'You take what you want. The merchant does not argue with a drawn blade.',
        triumphText: 'You leave clean and unseen — but a story like that travels faster than you do.',
        gainStatuses: ['distrusted'],
      },
    ],
    failure: {
      id: 'traveling_merchant_fail',
      triggerMeanings: [],
      text: 'The merchant reads YOU, and you leave lighter of coin than you arrived.',
      resolveChange: -1,
    },
  },
  {
    id: 'suspicious_villagers',
    kind: EVENT_KINDS.STANDARD,
    title: 'Suspicious Villagers',
    description: 'The village goes quiet as you enter. Doors close. A knot of folk gathers in the square, watching.',
    traits: [EVENT_TRAITS.SOCIAL],
    targetScore: 24,
    triumphScore: 40,
    outcomes: [
      {
        id: 'reassure',
        triggerMeanings: ['compassion', 'authority', 'persistence'],
        text: 'You meet their fear with calm, and one by one the doors open again.',
        triumphText: 'By nightfall you are a guest at their table, and they share what the road did not.',
      },
      {
        id: 'impress',
        triggerMeanings: ['courage', 'curiosity', 'change'],
        text: 'You give them a reading they will talk about for a season, and suspicion turns to wonder.',
        triumphText: 'They send you off with gifts and a name that will open the next door for you.',
      },
      {
        id: 'cow',
        triggerMeanings: ['violence', 'fear', 'authority'],
        text: 'You make it plain that crossing you would cost more than it is worth. They stand aside.',
        triumphText: 'No one will meet your eye, and no one will stop you. It works. It always works, for a while.',
        gainStatuses: ['distrusted'],
      },
    ],
    failure: {
      id: 'suspicious_villagers_fail',
      triggerMeanings: [],
      text: 'Whatever you say lands wrong. Stones follow you out past the last house.',
      resolveChange: -1,
      gainStatuses: ['exposed'],
    },
  },
  {
    id: 'unmarked_grave',
    kind: EVENT_KINDS.STANDARD,
    title: 'The Unmarked Grave',
    description: 'A fresh mound of earth lies just off the path, with no name and no marker, only a circle of pale stones.',
    traits: [EVENT_TRAITS.MYSTERY],
    targetScore: 22,
    triumphScore: 38,
    outcomes: [
      {
        id: 'honor',
        triggerMeanings: ['compassion', 'persistence', 'intuition'],
        text: 'You say the words you remember for the dead, and the air around the mound grows still and kind.',
        triumphText: 'Whoever lies here is grateful. You feel it settle over you like a hand on the shoulder.',
        gainStatuses: ['blessed'],
      },
      {
        id: 'investigate',
        triggerMeanings: ['curiosity', 'secrets', 'authority'],
        text: 'You read the stones and the soil and learn more than the burier meant to leave behind.',
        triumphText: 'The truth of this grave is a key. You do not know yet which door it opens.',
      },
      {
        id: 'disturb',
        triggerMeanings: ['violence', 'change', 'fear'],
        text: 'You dig. Whatever was buried here did not want to be, and now it is loose.',
        triumphText: 'You take what was buried and leave before the consequences arrive.',
        gainStatuses: ['haunted'],
      },
    ],
    failure: {
      id: 'unmarked_grave_fail',
      triggerMeanings: [],
      text: 'The reading sours. Something here has marked you for the disturbance.',
      resolveChange: -1,
      gainStatuses: ['haunted'],
    },
  },
  {
    id: 'beneath_the_floor',
    kind: EVENT_KINDS.STANDARD,
    title: 'Beneath the Floor',
    description: 'In the abandoned house, something shifts under the boards — slow, deliberate, and far too large.',
    traits: [EVENT_TRAITS.SUPERNATURAL],
    targetScore: 24,
    triumphScore: 40,
    outcomes: [
      {
        id: 'confront',
        triggerMeanings: ['courage', 'violence', 'authority'],
        text: 'You tear up the boards and face what waits below before it can choose the moment.',
        triumphText: 'You face it down so completely that it sinks back into the dark and does not rise again.',
      },
      {
        id: 'commune',
        triggerMeanings: ['intuition', 'secrets', 'fear'],
        text: 'You lay a reading on the floor and listen. What answers is patient, and old, and not unkind.',
        triumphText: 'It tells you a true thing in exchange for your courage, and lets you go.',
        gainStatuses: ['haunted'],
      },
      {
        id: 'seal',
        triggerMeanings: ['persistence', 'compassion', 'change'],
        text: 'You work until the boards are nailed fast and the signs are drawn, and the shifting goes quiet.',
        triumphText: 'You seal it so well that the house itself seems to sigh in relief.',
      },
    ],
    failure: {
      id: 'beneath_the_floor_fail',
      triggerMeanings: [],
      text: 'The boards splinter upward. You get out, but it knows your scent now.',
      resolveChange: -1,
      gainStatuses: ['haunted'],
    },
  },
  {
    id: 'whispering_tree',
    kind: EVENT_KINDS.STANDARD,
    title: 'The Whispering Tree',
    description: 'A lone tree stands where no tree should grow, and its leaves murmur your name when the wind dies.',
    traits: [EVENT_TRAITS.SUPERNATURAL],
    targetScore: 22,
    triumphScore: 38,
    outcomes: [
      {
        id: 'heed',
        triggerMeanings: ['intuition', 'curiosity', 'change'],
        text: 'You sit beneath it and let the whispers in. What they tell you reshapes the road ahead.',
        triumphText: 'The tree gives you a secret worth more than the journey to reach it.',
      },
      {
        id: 'silence',
        triggerMeanings: ['violence', 'courage', 'authority'],
        text: 'You take an axe to it. The whispers rise to a scream, then nothing.',
        triumphText: 'You fell it clean, and the silence afterward is the sweetest sound on the road.',
      },
      {
        id: 'offering',
        triggerMeanings: ['compassion', 'persistence', 'secrets'],
        text: 'You leave an offering at its roots, and the whispers turn gentle and bless your name instead.',
        triumphText: 'The tree takes your gift and gives back its favor, light as a falling leaf.',
        gainStatuses: ['blessed'],
      },
    ],
    failure: {
      id: 'whispering_tree_fail',
      triggerMeanings: [],
      text: 'The whispers find the cracks in you and pour in. You stumble on with them still murmuring.',
      resolveChange: -1,
      gainStatuses: ['haunted'],
    },
  },
]);

// The recovery event interrupts the run once (after event 3) and requires no
// spread. The player picks exactly one effect.
export const RECOVERY_EVENT = Object.freeze({
  id: 'recovery_camp',
  kind: EVENT_KINDS.RECOVERY,
  title: 'A Moment to Breathe',
  description: 'The road widens into a sheltered camp. There is time, for once, to set something right.',
  choices: [
    { id: 'rest', label: 'Restore 1 Resolve', effect: { resolveChange: 1 } },
    { id: 'cleanse', label: 'Remove 1 Status', effect: { removeOneStatus: true } },
    { id: 'fortune', label: 'Gain a Random Relic', effect: { gainRandomRelic: true } },
  ],
});

// The boss: a three-phase encounter. Each phase is graded by the live engine
// like any reading; the run silently records the dominant meaning of each
// phase, and the final outcome is chosen from those accumulated tendencies.
export const ADVENTURE_BOSS = Object.freeze({
  id: 'woman_in_the_well',
  kind: EVENT_KINDS.BOSS,
  title: 'The Woman in the Well',
  description: 'At the heart of the dead village waits a well, and at the bottom of the well waits a woman who has been waiting a very long time. She would like you to come down. She would like you to stay.',
  phases: [
    {
      id: 'phase_descent',
      label: 'The Descent',
      description: 'Her voice rises from the dark, and the rope you came down is already gone.',
      targetScore: 24,
      triumphScore: 38,
      text: 'You hold your reading steady against her pull and keep your feet under you.',
      triumphText: 'You descend on your own terms, and for a moment she is the one who looks uncertain.',
      failureText: 'The dark closes in and her voice gets inside your chest. It costs you to climb back from it.',
    },
    {
      id: 'phase_bargain',
      label: 'The Bargain',
      description: 'She offers you things. Some of them you want. Some of them you did not know you wanted until now.',
      targetScore: 30,
      triumphScore: 46,
      text: 'You read past the gift to the hook inside it, and refuse without insulting her.',
      triumphText: 'You turn her own bargain back on her, and she laughs — a real laugh, surprised.',
      failureText: 'You almost take it. Pulling your hand back leaves a mark that aches.',
    },
    {
      id: 'phase_reckoning',
      label: 'The Reckoning',
      description: 'No more talk. The water rises, and so does she.',
      targetScore: 36,
      triumphScore: 54,
      text: 'You lay the last reading down between you and hold the line until the water stills.',
      triumphText: 'Your final reading is perfect, and she goes quiet the way a held breath goes quiet.',
      failureText: 'The water takes you to your chest before you wrench the reckoning back under control.',
    },
  ],
  // The final outcome is selected by the run's accumulated dominant meanings.
  finals: [
    {
      id: 'final_mercy',
      triggerMeanings: ['compassion', 'intuition', 'persistence'],
      text: 'You give her the one thing the well never could: someone who stayed long enough to listen. The water lowers, and what climbs out beside you is only a tired woman, free at last. She walks with you to the road\'s edge, and then she is gone, lighter than air.',
    },
    {
      id: 'final_force',
      triggerMeanings: ['violence', 'courage', 'authority'],
      text: 'You break her hold the way you have broken everything else on this road — head on, and without flinching. The well caves in behind you as you climb. Whatever she was, she is rubble and silence now, and the village can finally forget her.',
    },
    {
      id: 'final_secrets',
      triggerMeanings: ['secrets', 'fear', 'change', 'curiosity'],
      text: 'You learned her name on the way down, and her true name on the way back up. You speak it once into the dark, and the curse that bound her to the water comes undone like a knot. What she does with her freedom is no longer your concern. You have your answer, and your road.',
    },
  ],
});

export function getEvent(id) {
  if (id === RECOVERY_EVENT.id) return RECOVERY_EVENT;
  if (id === ADVENTURE_BOSS.id) return ADVENTURE_BOSS;
  return ADVENTURE_EVENTS.find(event => event.id === id) || null;
}
