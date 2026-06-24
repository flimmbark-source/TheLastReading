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

export function getEvent(id) {
  if (id === RECOVERY_EVENT.id) return RECOVERY_EVENT;
  return ADVENTURE_EVENTS.find(event => event.id === id) || null;
}
