// Adventure Mode validation — exercises the hidden-interpretation loop end to
// end without a browser, matching the repo's node-based validation style.

import assert from 'node:assert/strict';

import { buildDeck } from '../src/systems/deck.mjs';
import { calculateSpreadMeanings, dominantMeaning } from '../src/systems/adventure/meanings.mjs';
import { MEANING_TAGS } from '../src/data/adventure/interpretations.mjs';
import { ADVENTURE_EVENTS, EVENT_TRAITS } from '../src/data/adventure/events.mjs';
import {
  createAdventureRunState,
  resolveEvent,
  applyResolution,
  selectOutcome,
  generateRewardOffers,
  applyReward,
  applyRecoveryChoice,
  isRunLost,
  advanceEvent,
  ADVENTURE_RESULTS,
} from '../src/systems/adventure/run.mjs';
import { REWARD_TYPES } from '../src/data/adventure/rewards.mjs';
import { buildHudHtml, buildDebugPanelHtml, isAdventureDebugEnabled } from '../src/ui/adventure/adventureHud.mjs';

const deck = buildDeck();
const byId = new Map(deck.map(card => [card.id, card]));
const card = id => {
  const c = byId.get(id);
  assert.ok(c, `Unknown card id: ${id}`);
  return c;
};

// --- Meaning calculation ----------------------------------------------------

let meanings = calculateSpreadMeanings([card('major_18')]); // Moon: fear/intuition/secrets
assert.equal(meanings.fear, 2);
assert.equal(meanings.intuition, 2);
assert.equal(meanings.secrets, 2);
assert.equal(meanings.courage, 0, 'unrelated tags stay zero');
for (const tag of MEANING_TAGS) assert.equal(typeof meanings[tag], 'number', `${tag} present`);

// Suit + court defaults stack onto a court card.
meanings = calculateSpreadMeanings([card('court_Swords_Knight')]);
assert.equal(meanings.violence, 1, 'Swords suit default');
assert.equal(meanings.courage, 2, 'Swords courage + Knight courage');

// Null spread slots are ignored.
meanings = calculateSpreadMeanings([card('major_8'), null, null]);
assert.equal(meanings.courage, 3, 'Strength bespoke courage with null slots');

// Haunted status amplifies supernatural meanings already present.
const baseMoon = calculateSpreadMeanings([card('major_18')]);
const hauntedMoon = calculateSpreadMeanings([card('major_18')], ['haunted']);
assert.equal(hauntedMoon.fear, baseMoon.fear + 1, 'Haunted boosts fear');
assert.equal(hauntedMoon.intuition, baseMoon.intuition + 1, 'Haunted boosts intuition');
assert.equal(hauntedMoon.courage, 0, 'Haunted does not invent absent meanings');

// --- Outcome selection ------------------------------------------------------

const ironGate = ADVENTURE_EVENTS.find(e => e.id === 'iron_gate');
// A violent/courageous spread should pick the "force" outcome.
const forceful = selectOutcome(ironGate, calculateSpreadMeanings([
  card('major_16'), // Tower: violence/change
  card('court_Swords_Knight'),
  card('court_Swords_Page'),
]));
assert.equal(forceful.outcome.id, 'force', 'violent spread forces the gate');

// An intuitive/secret spread should pick the "decipher" outcome.
const cryptic = selectOutcome(ironGate, calculateSpreadMeanings([
  card('major_2'), // High Priestess: intuition/secrets
  card('major_18'), // Moon
]));
assert.equal(cryptic.outcome.id, 'decipher', 'cryptic spread deciphers the gate');

// --- Tier thresholds (failure / success / triumph) --------------------------

function fakeScoreSpread(score) {
  // A single placeholder card; we override the event thresholds to hit a tier.
  return [card('major_8')];
}
const probeEvent = { ...ironGate, targetScore: 0, triumphScore: 999 };
let res = resolveEvent({ event: probeEvent, spread: fakeScoreSpread(), run: createAdventureRunState() });
assert.equal(res.tier, ADVENTURE_RESULTS.SUCCESS, 'score over target is success');
assert.equal(res.rewardShow, 3);
assert.equal(res.rewardChoose, 1);

res = resolveEvent({ event: { ...ironGate, targetScore: 0, triumphScore: 0 }, spread: fakeScoreSpread(), run: createAdventureRunState() });
assert.equal(res.tier, ADVENTURE_RESULTS.TRIUMPH, 'score over triumph is triumph');
assert.equal(res.rewardShow, 4);
assert.equal(res.rewardChoose, 2);

res = resolveEvent({ event: { ...ironGate, targetScore: 999, triumphScore: 9999 }, spread: fakeScoreSpread(), run: createAdventureRunState() });
assert.equal(res.tier, ADVENTURE_RESULTS.FAILURE, 'score under target fails');
assert.equal(res.resolveChange, -1, 'failure costs 1 Resolve');
assert.equal(res.rewardTier, null, 'failure grants no reward');

// --- Resolve loss + run-lost ------------------------------------------------

let run = createAdventureRunState({ resolve: 1 });
const failRes = resolveEvent({ event: { ...ironGate, targetScore: 999, triumphScore: 9999 }, spread: fakeScoreSpread(), run });
applyResolution(run, failRes);
assert.equal(run.resolve, 0);
assert.ok(isRunLost(run), 'reaching 0 Resolve loses the run');

// --- Exposed: hostile failures cost +1 Resolve ------------------------------

const ambush = ADVENTURE_EVENTS.find(e => e.id === 'ambush');
assert.ok(ambush.traits.includes(EVENT_TRAITS.HOSTILE));
run = createAdventureRunState({ statuses: ['exposed'], resolve: 5 });
const exposedFail = resolveEvent({ event: { ...ambush, targetScore: 999, triumphScore: 9999 }, spread: fakeScoreSpread(), run });
assert.equal(exposedFail.resolveChange, -2, 'Exposed deepens hostile failures');

// --- Blessed: extra triumph reward, then consumed ---------------------------

run = createAdventureRunState({ statuses: ['blessed'] });
const blessedTriumph = resolveEvent({ event: { ...ironGate, targetScore: 0, triumphScore: 0 }, spread: fakeScoreSpread(), run });
assert.equal(blessedTriumph.tier, ADVENTURE_RESULTS.TRIUMPH);
assert.equal(blessedTriumph.rewardChoose, 3, 'Blessed adds a triumph reward');
assert.ok(blessedTriumph.removeStatuses.includes('blessed'), 'Blessed is consumed');
applyResolution(run, blessedTriumph);
assert.ok(!run.statuses.includes('blessed'), 'Blessed removed after triumph');

// --- Distrusted: social triumph bonus disabled ------------------------------

const socialEvent = { ...ironGate, traits: [EVENT_TRAITS.SOCIAL], targetScore: 0, triumphScore: 0 };
run = createAdventureRunState({ statuses: ['distrusted'] });
const distrustTriumph = resolveEvent({ event: socialEvent, spread: fakeScoreSpread(), run });
assert.equal(distrustTriumph.rewardChoose, 1, 'Distrusted removes the social triumph bonus');

// --- Lucky Coin relic: first failure costs nothing --------------------------

run = createAdventureRunState({ relics: ['lucky_coin'], resolve: 3 });
const coinFail = resolveEvent({ event: { ...ambush, targetScore: 999, triumphScore: 9999 }, spread: fakeScoreSpread(), run });
assert.equal(coinFail.resolveChange, 0, 'Lucky Coin absorbs the first failure');
applyResolution(run, coinFail);
assert.equal(run.resolve, 3, 'Resolve unchanged after Lucky Coin failure');
assert.ok(run.flags.firstFailureUsed, 'Lucky Coin marks its charge spent');

// --- Reward generation + application ----------------------------------------

run = createAdventureRunState({ resolve: 2 });
let seed = 42;
const rng = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
const offers = generateRewardOffers(run, 3, rng);
assert.equal(offers.length, 3, 'success shows 3 offers');
const before = run.resolve;
applyReward(run, { type: REWARD_TYPES.RESTORE_RESOLVE, amount: 1 }, {}, rng);
assert.equal(run.resolve, before + 1, 'RESTORE_RESOLVE restores Resolve');

applyReward(run, { type: REWARD_TYPES.GAIN_RELIC }, {}, rng);
assert.equal(run.relics.length, 1, 'GAIN_RELIC adds a relic');

run.statuses = ['haunted'];
applyReward(run, { type: REWARD_TYPES.REMOVE_STATUS }, {}, rng);
assert.equal(run.statuses.length, 0, 'REMOVE_STATUS clears a status');

// --- Recovery event ---------------------------------------------------------

run = createAdventureRunState({ resolve: 2, statuses: ['haunted'] });
run.currentEventIndex = 3;
applyRecoveryChoice(run, 'rest', rng);
assert.equal(run.resolve, 3, 'recovery rest restores 1 Resolve');
assert.ok(run.flags.recoveryDone, 'recovery is marked done');

// --- Full loop smoke: play the three events ---------------------------------

run = createAdventureRunState();
let safety = 0;
while (run.currentEventIndex < run.events.length && !isRunLost(run) && safety < 20) {
  safety += 1;
  const event = ADVENTURE_EVENTS[run.currentEventIndex];
  // A strong, varied spread to clear the target.
  const spread = [card('major_8'), card('major_16'), card('court_Swords_King'), card('court_Swords_Queen'), card('court_Swords_Knight')];
  const r = resolveEvent({ event, spread, run });
  applyResolution(run, r);
  if (r.rewardTier) {
    const o = generateRewardOffers(run, r.rewardShow, rng);
    assert.ok(o.length >= r.rewardChoose, 'enough offers to choose from');
  }
  advanceEvent(run, event.id);
}
assert.equal(run.completedEvents.length, 3, 'all three events completed');

// --- HUD never leaks hidden meanings ----------------------------------------

const hudEvent = ADVENTURE_EVENTS[0];
const hudRun = createAdventureRunState({ statuses: ['haunted'] });
const hud = buildHudHtml({ run: hudRun, event: hudEvent });
for (const tag of MEANING_TAGS) {
  assert.ok(!hud.toLowerCase().includes(tag), `HUD must not mention hidden meaning "${tag}"`);
}
assert.ok(hud.includes('Resolve'), 'HUD shows Resolve');
assert.ok(hud.includes(hudEvent.title), 'HUD shows the current event');

// --- Debug panel shows meanings, and is dev-gated ---------------------------

const debugMeanings = calculateSpreadMeanings([card('major_18')], ['haunted']);
const debug = buildDebugPanelHtml({ meanings: debugMeanings });
assert.ok(debug.includes('Fear'), 'debug panel lists meanings');
assert.ok(debug.includes(String(debugMeanings.fear)), 'debug panel shows meaning values');

assert.equal(isAdventureDebugEnabled({ location: { hostname: 'localhost', search: '' } }), true, 'dev on localhost');
assert.equal(isAdventureDebugEnabled({ location: { hostname: 'thelastreading.app', search: '' } }), false, 'no debug in production');
assert.equal(isAdventureDebugEnabled({ __TLR_DEV__: true }), true, 'explicit dev flag works');

assert.ok(dominantMeaning(debugMeanings), 'dominant meaning resolves for boss tracking');

console.log('Adventure Mode validation checks passed.');
