import { ACTION_NODES } from './nodes.mjs';

// Standard Events each author only the approaches they understand. Success and
// Great Success prose/effects come from the matching legacy outcome in
// events.mjs; this file adds the hidden potency requirement and an
// approach-specific failure.
export const EVENT_APPROACHES = Object.freeze({
  iron_gate: Object.freeze([
    {
      node: ACTION_NODES.ENDURANCE,
      outcomeId: 'outlast',
      requirement: 1,
      failure: { text: 'You set yourself against the gate and wait it out. The gate, it turns out, is better at waiting than you are.', resolveChange: -1 },
    },
    {
      node: ACTION_NODES.CREATION,
      outcomeId: 'contrive',
      requirement: 2,
      failure: { text: 'You try to build a way over, but the timber is rotten and the stone betrays your weight at the worst moment.', resolveChange: -1 },
    },
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
      node: ACTION_NODES.PROTECTION,
      outcomeId: 'guard',
      requirement: 2,
      failure: { text: 'You cover up and hold, but there are too many of them, and one finds the gap your guard cannot close.', resolveChange: -1 },
    },
    {
      node: ACTION_NODES.FORTUNE,
      outcomeId: 'scatter',
      requirement: 2,
      failure: { text: 'You gamble on the chaos. The chaos sides with them, and you pay for the wager in blood.', resolveChange: -1 },
    },
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
      node: ACTION_NODES.FORTUNE,
      outcomeId: 'wager',
      requirement: 2,
      failure: { text: 'You leave your luck to the shrine. It keeps the coin and gives back nothing but a colder wind.', resolveChange: -1 },
    },
    {
      node: ACTION_NODES.TRANSFORMATION,
      outcomeId: 'transmute',
      requirement: 2,
      failure: { text: 'You reach to change what the shrine is, and it changes you instead, just slightly, just enough to notice.', resolveChange: -1, gainStatuses: ['haunted'] },
    },
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
      node: ACTION_NODES.TRANSFORMATION,
      outcomeId: 'adapt',
      requirement: 2,
      failure: { text: 'You try to give yourself to the current. It takes the gift greedily and nearly does not give you back.', resolveChange: -1 },
    },
    {
      node: ACTION_NODES.CREATION,
      outcomeId: 'raft',
      requirement: 2,
      failure: { text: 'Your raft comes apart in the first hard pull of the current, and you with it.', resolveChange: -1 },
    },
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
      node: ACTION_NODES.PROTECTION,
      outcomeId: 'brace',
      requirement: 2,
      failure: { text: 'You set yourself to weather it, but a wounded thing has nothing left to lose, and it comes through your guard.', resolveChange: -1 },
    },
    {
      node: ACTION_NODES.PHYSICAL,
      outcomeId: 'restrain',
      requirement: 2,
      failure: { text: 'You close to pin it and learn how strong fear makes a cornered animal. It throws you off, hard.', resolveChange: -1 },
    },
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
      node: ACTION_NODES.FORTUNE,
      outcomeId: 'dice',
      requirement: 2,
      failure: { text: 'You stake the bargain on a game of chance. The merchant has played this game far longer than you have.', resolveChange: -1 },
    },
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
      node: ACTION_NODES.ENDURANCE,
      outcomeId: 'abide',
      requirement: 1,
      failure: { text: 'You stay and wait for trust to grow. It does not, and every day you linger sharpens their unease.', resolveChange: -1 },
    },
    {
      node: ACTION_NODES.DECEPTION,
      outcomeId: 'blend',
      requirement: 2,
      failure: { text: 'You try to pass as one of them. A child notices what the elders missed, and says so, loudly.', resolveChange: -1, gainStatuses: ['exposed'] },
    },
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
      node: ACTION_NODES.TRANSFORMATION,
      outcomeId: 'release',
      requirement: 2,
      failure: { text: 'You try to free what lingers, but you do not understand what binds it, and it clings to you instead.', resolveChange: -1, gainStatuses: ['haunted'] },
    },
    {
      node: ACTION_NODES.AUTHORITY,
      outcomeId: 'command',
      requirement: 2,
      failure: { text: 'You order the grave to keep its dead. The dead, it seems, do not answer to you.', resolveChange: -1, gainStatuses: ['haunted'] },
    },
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
      node: ACTION_NODES.PHYSICAL,
      outcomeId: 'haul',
      requirement: 3,
      failure: { text: 'You tear at the boards to drag it up, but it is heavier than the whole house, and it pulls back.', resolveChange: -1, gainStatuses: ['haunted'] },
    },
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
