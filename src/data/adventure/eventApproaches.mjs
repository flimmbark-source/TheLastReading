import { ACTION_NODES } from './nodes.mjs';

// Standard Events each author only the approaches they understand. Success and
// Great Success prose/effects come from the matching legacy outcome in
// events.mjs; this file adds the hidden potency requirement and an
// approach-specific failure.
export const EVENT_APPROACHES = Object.freeze({
  iron_gate: Object.freeze([
    {
      node: ACTION_NODES.AGGRESSION,
      outcomeId: 'force',
      requirement: 3,
      failure: { text: 'You throw your weight against the gate until your shoulder burns. The iron does not move.', resolveChange: -1 },
    },
    {
      node: ACTION_NODES.MYSTERY,
      outcomeId: 'decipher',
      requirement: 1,
      failure: { text: 'The symbols almost become words, then slide apart again. Whatever opens this gate remains hidden.', resolveChange: -1 },
    },
    {
      node: ACTION_NODES.INVESTIGATION,
      outcomeId: 'wander',
      requirement: 2,
      failure: { text: 'You follow the wall until the light begins to fail, but every break in the stone closes into another dead end.', resolveChange: -1 },
    },
  ]),

  ambush: Object.freeze([
    {
      node: ACTION_NODES.AGGRESSION,
      outcomeId: 'fight',
      requirement: 3,
      failure: { text: 'You strike before they do, but not hard enough. The circle closes and you escape bloodied.', resolveChange: -1 },
    },
    {
      node: ACTION_NODES.COMPASSION,
      outcomeId: 'parley',
      requirement: 2,
      failure: { text: 'You offer them a way out. They hear hesitation instead, and press their advantage.', resolveChange: -1, gainStatuses: ['exposed'] },
    },
    {
      node: ACTION_NODES.DECEPTION,
      outcomeId: 'vanish',
      requirement: 2,
      failure: { text: 'You send their attention toward the wrong shadow, but one of them keeps watching you.', resolveChange: -1 },
    },
  ]),

  strange_shrine: Object.freeze([
    {
      node: ACTION_NODES.MYSTERY,
      outcomeId: 'commune',
      requirement: 1,
      failure: { text: 'You reach toward the presence behind the shrine. Something reaches back before you are ready.', resolveChange: -1, gainStatuses: ['haunted'] },
    },
    {
      node: ACTION_NODES.COMPASSION,
      outcomeId: 'honor',
      requirement: 1,
      failure: { text: 'You leave what respect you can, but the offering feels wrong the moment it leaves your hand.', resolveChange: -1 },
    },
    {
      node: ACTION_NODES.AGGRESSION,
      outcomeId: 'plunder',
      requirement: 3,
      failure: { text: 'You take from the shrine, but not quickly enough. The road behind you grows colder with every step.', resolveChange: -1, gainStatuses: ['distrusted'] },
    },
  ]),

  flooded_road: Object.freeze([
    {
      node: ACTION_NODES.PHYSICAL,
      outcomeId: 'ford',
      requirement: 2,
      failure: { text: 'You enter the current with confidence, but the river takes your footing and carries you downstream.', resolveChange: -1 },
    },
    {
      node: ACTION_NODES.ENDURANCE,
      outcomeId: 'wait',
      requirement: 1,
      failure: { text: 'You wait for the water to fall. It rises instead, and the day is lost.', resolveChange: -1 },
    },
    {
      node: ACTION_NODES.INVESTIGATION,
      outcomeId: 'crossing',
      requirement: 2,
      failure: { text: 'You search the banks for another way across and find only deeper water and failing light.', resolveChange: -1 },
    },
  ]),

  cornered_beast: Object.freeze([
    {
      node: ACTION_NODES.AGGRESSION,
      outcomeId: 'put_down',
      requirement: 3,
      failure: { text: 'You move to end the threat, but pain makes the beast faster than you expected.', resolveChange: -1 },
    },
    {
      node: ACTION_NODES.COMPASSION,
      outcomeId: 'soothe',
      requirement: 2,
      failure: { text: 'You lower your voice and approach slowly. Fear wins before trust can take hold.', resolveChange: -1 },
    },
    {
      node: ACTION_NODES.DECEPTION,
      outcomeId: 'slip_past',
      requirement: 2,
      failure: { text: 'You wait for its eyes to turn away. They never do.', resolveChange: -1 },
    },
  ]),

  traveling_merchant: Object.freeze([
    {
      node: ACTION_NODES.AUTHORITY,
      outcomeId: 'bargain',
      requirement: 2,
      failure: { text: 'You press for a fair price. The merchant smiles, agrees, and somehow leaves you poorer.', resolveChange: -1 },
    },
    {
      node: ACTION_NODES.COMPASSION,
      outcomeId: 'charm',
      requirement: 2,
      failure: { text: 'You try to make a friend of the merchant. They mistake openness for opportunity.', resolveChange: -1 },
    },
    {
      node: ACTION_NODES.AGGRESSION,
      outcomeId: 'rob',
      requirement: 3,
      failure: { text: 'You reach for what is not yours. The merchant was waiting for exactly that mistake.', resolveChange: -1, gainStatuses: ['distrusted'] },
    },
  ]),

  suspicious_villagers: Object.freeze([
    {
      node: ACTION_NODES.COMPASSION,
      outcomeId: 'reassure',
      requirement: 2,
      failure: { text: 'You meet their fear with patience, but every gentle word sounds rehearsed to them.', resolveChange: -1, gainStatuses: ['exposed'] },
    },
    {
      node: ACTION_NODES.CREATION,
      outcomeId: 'impress',
      requirement: 2,
      failure: { text: 'You try to give them something worth remembering. They remember only that you tried too hard.', resolveChange: -1 },
    },
    {
      node: ACTION_NODES.AUTHORITY,
      outcomeId: 'cow',
      requirement: 2,
      failure: { text: 'You demand room to pass. The square answers with silence, then stones.', resolveChange: -1, gainStatuses: ['distrusted'] },
    },
  ]),

  unmarked_grave: Object.freeze([
    {
      node: ACTION_NODES.COMPASSION,
      outcomeId: 'honor',
      requirement: 1,
      failure: { text: 'You offer words for the dead, but they are not the words this grave was waiting for.', resolveChange: -1 },
    },
    {
      node: ACTION_NODES.INVESTIGATION,
      outcomeId: 'investigate',
      requirement: 2,
      failure: { text: 'You study the stones and soil until the pattern almost appears. Then the trail goes cold.', resolveChange: -1 },
    },
    {
      node: ACTION_NODES.AGGRESSION,
      outcomeId: 'disturb',
      requirement: 3,
      failure: { text: 'You break the circle and dig. Something below shifts before you are ready for it.', resolveChange: -1, gainStatuses: ['haunted'] },
    },
  ]),

  beneath_the_floor: Object.freeze([
    {
      node: ACTION_NODES.AGGRESSION,
      outcomeId: 'confront',
      requirement: 3,
      failure: { text: 'You tear at the boards, but whatever waits beneath them is stronger and already moving.', resolveChange: -1, gainStatuses: ['haunted'] },
    },
    {
      node: ACTION_NODES.MYSTERY,
      outcomeId: 'commune',
      requirement: 2,
      failure: { text: 'You listen for meaning in the movement below. It learns the rhythm of your breathing instead.', resolveChange: -1, gainStatuses: ['haunted'] },
    },
    {
      node: ACTION_NODES.PROTECTION,
      outcomeId: 'seal',
      requirement: 2,
      failure: { text: 'You brace and mark the floor, but the first board splits before the seal is complete.', resolveChange: -1 },
    },
  ]),

  whispering_tree: Object.freeze([
    {
      node: ACTION_NODES.MYSTERY,
      outcomeId: 'heed',
      requirement: 1,
      failure: { text: 'You let the whispers in, but cannot separate warning from hunger.', resolveChange: -1, gainStatuses: ['haunted'] },
    },
    {
      node: ACTION_NODES.AGGRESSION,
      outcomeId: 'silence',
      requirement: 3,
      failure: { text: 'Your first blow bites into the bark. The tree says your name in your own voice.', resolveChange: -1, gainStatuses: ['haunted'] },
    },
    {
      node: ACTION_NODES.COMPASSION,
      outcomeId: 'offering',
      requirement: 2,
      failure: { text: 'You leave a gift at the roots. The tree accepts it and asks for something you cannot give.', resolveChange: -1 },
    },
  ]),
});

export function getEventApproaches(eventOrId) {
  const id = typeof eventOrId === 'string' ? eventOrId : eventOrId?.id;
  return EVENT_APPROACHES[id] || Object.freeze([]);
}
