import { ACTION_NODES } from './nodes.mjs';

// Each Event authors exactly three solutions, one per difficulty tier:
//
//   Easy   (requirement 1)   — the Event's natural vulnerability / intended read
//   Medium (requirement 2-3) — a workable alternative
//   Hard   (requirement 4-5) — possible but demanding (usually force)
//
// These three nodes are the Event's only accepted "destinations". A played card
// starts at its own node and routes through the global graph (nodeGraph.mjs) to
// the nearest of the three; an exact landing is a Great Success, a routed one a
// Success, and either fails if the card's potency is below that tier's
// requirement. Success/Great-Success prose comes from the matching outcome in
// events.mjs; the requirement and an approach-specific failure live here.
export const EVENT_APPROACHES = Object.freeze({
  // An iron gate is mechanical and cryptic: searching it out is easiest,
  // reading its symbols is harder, breaking it is hardest.
  iron_gate: Object.freeze([
    {
      node: ACTION_NODES.INVESTIGATION,
      outcomeId: 'wander',
      requirement: 1,
      failure: { text: 'You follow the wall until the light begins to fail, but every break in the stone closes into another dead end.', resolveChange: -1 },
    },
    {
      node: ACTION_NODES.MYSTERY,
      outcomeId: 'decipher',
      requirement: 2,
      failure: { text: 'The symbols almost become words, then slide apart again. Whatever opens this gate remains hidden.', resolveChange: -1 },
    },
    {
      node: ACTION_NODES.AGGRESSION,
      outcomeId: 'force',
      requirement: 5,
      failure: { text: 'You throw your weight against the gate until your shoulder burns. The iron does not move.', resolveChange: -1 },
    },
  ]),

  // An ambush rewards preparation: a solid guard is the natural answer, a
  // vanishing act is trickier, and standing to fight is the hardest road.
  ambush: Object.freeze([
    {
      node: ACTION_NODES.PROTECTION,
      outcomeId: 'guard',
      requirement: 1,
      failure: { text: 'You cover up and hold, but there are too many of them, and one finds the gap your guard cannot close.', resolveChange: -1 },
    },
    {
      node: ACTION_NODES.DECEPTION,
      outcomeId: 'vanish',
      requirement: 3,
      failure: { text: 'You send their attention toward the wrong shadow, but one of them keeps watching you.', resolveChange: -1 },
    },
    {
      node: ACTION_NODES.AGGRESSION,
      outcomeId: 'fight',
      requirement: 5,
      failure: { text: 'You strike before they do, but not hard enough. The circle closes and you escape bloodied.', resolveChange: -1 },
    },
  ]),

  // The shrine is strange and watched: communing with it is natural, honoring
  // it works, and gambling with it is a risky long shot.
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
      requirement: 2,
      failure: { text: 'You leave what respect you can, but the offering feels wrong the moment it leaves your hand.', resolveChange: -1 },
    },
    {
      node: ACTION_NODES.FORTUNE,
      outcomeId: 'wager',
      requirement: 4,
      failure: { text: 'You leave your luck to the shrine. It keeps the coin and gives back nothing but a colder wind.', resolveChange: -1 },
    },
  ]),

  // A flooded road yields to patience first, to adaptation next, and only to
  // brute fording at real risk.
  flooded_road: Object.freeze([
    {
      node: ACTION_NODES.ENDURANCE,
      outcomeId: 'wait',
      requirement: 1,
      failure: { text: 'You wait for the water to fall. It rises instead, and the day is lost.', resolveChange: -1 },
    },
    {
      node: ACTION_NODES.TRANSFORMATION,
      outcomeId: 'adapt',
      requirement: 3,
      failure: { text: 'You try to give yourself to the current. It takes the gift greedily and nearly does not give you back.', resolveChange: -1 },
    },
    {
      node: ACTION_NODES.PHYSICAL,
      outcomeId: 'ford',
      requirement: 4,
      failure: { text: 'You enter the current with confidence, but the river takes your footing and carries you downstream.', resolveChange: -1 },
    },
  ]),

  // The frightened beast is soothed easily, contained with more effort, and
  // put down only by real force.
  cornered_beast: Object.freeze([
    {
      node: ACTION_NODES.COMPASSION,
      outcomeId: 'soothe',
      requirement: 1,
      failure: { text: 'You lower your voice and approach slowly. Fear wins before trust can take hold.', resolveChange: -1 },
    },
    {
      node: ACTION_NODES.PROTECTION,
      outcomeId: 'brace',
      requirement: 3,
      failure: { text: 'You set yourself to weather it, but a wounded thing has nothing left to lose, and it comes through your guard.', resolveChange: -1 },
    },
    {
      node: ACTION_NODES.AGGRESSION,
      outcomeId: 'put_down',
      requirement: 5,
      failure: { text: 'You move to end the threat, but pain makes the beast faster than you expected.', resolveChange: -1 },
    },
  ]),

  // The merchant expects a bargain; a game of chance is dicier; robbery is the
  // hard, costly road.
  traveling_merchant: Object.freeze([
    {
      node: ACTION_NODES.AUTHORITY,
      outcomeId: 'bargain',
      requirement: 1,
      failure: { text: 'You press for a fair price. The merchant smiles, agrees, and somehow leaves you poorer.', resolveChange: -1 },
    },
    {
      node: ACTION_NODES.FORTUNE,
      outcomeId: 'dice',
      requirement: 3,
      failure: { text: 'You stake the bargain on a game of chance. The merchant has played this game far longer than you have.', resolveChange: -1 },
    },
    {
      node: ACTION_NODES.AGGRESSION,
      outcomeId: 'rob',
      requirement: 5,
      failure: { text: 'You reach for what is not yours. The merchant was waiting for exactly that mistake.', resolveChange: -1, gainStatuses: ['distrusted'] },
    },
  ]),

  // Suspicious villagers want reassurance; a memorable gesture works; cowing
  // them is the hard, distrust-earning road.
  suspicious_villagers: Object.freeze([
    {
      node: ACTION_NODES.COMPASSION,
      outcomeId: 'reassure',
      requirement: 1,
      failure: { text: 'You meet their fear with patience, but every gentle word sounds rehearsed to them.', resolveChange: -1, gainStatuses: ['exposed'] },
    },
    {
      node: ACTION_NODES.CREATION,
      outcomeId: 'impress',
      requirement: 3,
      failure: { text: 'You try to give them something worth remembering. They remember only that you tried too hard.', resolveChange: -1 },
    },
    {
      node: ACTION_NODES.AUTHORITY,
      outcomeId: 'cow',
      requirement: 4,
      failure: { text: 'You demand room to pass. The square answers with silence, then stones.', resolveChange: -1, gainStatuses: ['distrusted'] },
    },
  ]),

  // The grave wants honoring; it can be read; or its restless tenant can be
  // released outright at greater demand.
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
      node: ACTION_NODES.TRANSFORMATION,
      outcomeId: 'release',
      requirement: 4,
      failure: { text: 'You try to free what lingers, but you do not understand what binds it, and it clings to you instead.', resolveChange: -1, gainStatuses: ['haunted'] },
    },
  ]),

  // The thing beneath the floor is patient: communing is easiest, sealing it
  // takes effort, confronting it is the hardest path.
  beneath_the_floor: Object.freeze([
    {
      node: ACTION_NODES.MYSTERY,
      outcomeId: 'commune',
      requirement: 1,
      failure: { text: 'You listen for meaning in the movement below. It learns the rhythm of your breathing instead.', resolveChange: -1, gainStatuses: ['haunted'] },
    },
    {
      node: ACTION_NODES.PROTECTION,
      outcomeId: 'seal',
      requirement: 3,
      failure: { text: 'You brace and mark the floor, but the first board splits before the seal is complete.', resolveChange: -1 },
    },
    {
      node: ACTION_NODES.AGGRESSION,
      outcomeId: 'confront',
      requirement: 5,
      failure: { text: 'You tear at the boards, but whatever waits beneath them is stronger and already moving.', resolveChange: -1, gainStatuses: ['haunted'] },
    },
  ]),

  // The whispering tree wants to be heard; an offering placates it; silencing
  // it with an axe is the hardest, ugliest answer.
  whispering_tree: Object.freeze([
    {
      node: ACTION_NODES.MYSTERY,
      outcomeId: 'heed',
      requirement: 1,
      failure: { text: 'You let the whispers in, but cannot separate warning from hunger.', resolveChange: -1, gainStatuses: ['haunted'] },
    },
    {
      node: ACTION_NODES.COMPASSION,
      outcomeId: 'offering',
      requirement: 2,
      failure: { text: 'You leave a gift at the roots. The tree accepts it and asks for something you cannot give.', resolveChange: -1 },
    },
    {
      node: ACTION_NODES.AGGRESSION,
      outcomeId: 'silence',
      requirement: 5,
      failure: { text: 'Your first blow bites into the bark. The tree says your name in your own voice.', resolveChange: -1, gainStatuses: ['haunted'] },
    },
  ]),
});

export function getEventApproaches(eventOrId) {
  const id = typeof eventOrId === 'string' ? eventOrId : eventOrId?.id;
  return EVENT_APPROACHES[id] || Object.freeze([]);
}
