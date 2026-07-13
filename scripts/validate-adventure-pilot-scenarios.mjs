// Validates end-to-end pilot SCENARIOS: seeded runs reproduce exactly, the
// eight-stage flow completes, and the acceptance scenarios (A–G) produce the
// causal outcomes a player should be able to explain afterwards.

import assert from 'node:assert/strict';
import {
  startPilotRun,
  enterStage,
  resolveCurrent,
  resolveChoice,
  applyResolution,
  applyRecovery,
  advanceStage,
} from '../src/systems/adventure/pilot/pilotRun.mjs';
import { buildFinalePayload } from '../src/systems/adventure/pilot/pilotFinale.mjs';

// Drive a run with an explicit per-stage plan. Each plan entry is either
// { trait, choiceId? } for a reading event or { recoveryId } for recovery.
function drive(seed, plan, overrides = {}) {
  const run = startPilotRun({ seed, ...overrides });
  let descriptor = enterStage(run);
  let step = 0;
  let guard = 0;
  while (!run.finished && guard < 32) {
    guard += 1;
    if (descriptor.isFinale) break;
    const decision = plan[step] || plan[plan.length - 1] || {};
    if (descriptor.isRecovery) {
      const choice = descriptor.recoveryChoices.find(c => c.id === decision.recoveryId) || descriptor.recoveryChoices[0];
      applyRecovery(run, choice);
      descriptor = advanceStage(run);
      step += 1;
      continue;
    }
    let packet = resolveCurrent(run, descriptor.event, null, decision.trait);
    if (packet.pendingChoices) {
      const choiceId = decision.choiceId || packet.pendingChoices[0].id;
      packet = resolveChoice(run, descriptor.event, decision.trait, choiceId);
    }
    applyResolution(run, descriptor.event, packet);
    if (run.finished) break;
    descriptor = advanceStage(run);
    step += 1;
  }
  return run;
}

// -- Determinism: identical seed + plan reproduces identical history ---------
{
  const plan = [{ trait: 'investigation' }, { trait: 'compassion' }, { trait: 'aggression' }, { recoveryId: 'rest' }, { trait: 'protection' }, { trait: 'endurance' }, { trait: 'mystery' }];
  const a = drive(41027, plan);
  const b = drive(41027, plan);
  assert.deepEqual(
    a.eventHistory.map(e => [e.eventId, e.trait, e.choiceId]),
    b.eventHistory.map(e => [e.eventId, e.trait, e.choiceId]),
    'a seeded run must reproduce the same event order and choices',
  );
  assert.deepEqual(a.echoes, b.echoes, 'a seeded run must reproduce the same echoes');
}

// -- Every stage completes to a finale or terminal for several seeds ---------
for (const seed of [1, 7, 42, 999, 2024, 55555]) {
  const plan = [{ trait: 'protection' }, { trait: 'investigation' }, { trait: 'compassion' }, { recoveryId: 'rest' }, { trait: 'authority' }, { trait: 'creation' }, { trait: 'transformation' }];
  const run = drive(seed, plan);
  assert.ok(run.finished, `seed ${seed}: run should finish`);
  assert.ok(run.reachedDestination || run.terminalEnding, `seed ${seed}: run should reach destination or end`);
  const payload = buildFinalePayload(run);
  assert.ok(payload.causalSummary.length >= 1, `seed ${seed}: finale needs a causal summary`);
}

// -- Scenario A: exhaustion ending -------------------------------------------
// Repeated demanding endurance/physical actions, then a severe exertion while
// Exhausted must end the journey with visible prior causes.
{
  const run = drive(3, [
    { trait: 'endurance' }, { trait: 'endurance' }, { trait: 'endurance' }, { recoveryId: 'gather' },
    { trait: 'endurance' }, { trait: 'endurance' }, { trait: 'endurance' },
  ]);
  assert.ok(run.terminalEnding, 'Scenario A should end the journey');
  assert.equal(run.terminalEnding.endingId, 'ending_exhausted_exertion', 'Scenario A should end by exhaustion');
  const summary = buildFinalePayload(run).causalSummary.join(' ');
  assert.ok(/Exhausted|strength/i.test(summary), 'Scenario A summary should explain the exhaustion');
}

// -- Scenario B: beast redirects bandits -------------------------------------
// Ambush Aggression -> Hunted; then send a beast toward the pursuers with
// Cornered Beast Deception, removing Hunted and colliding the threads.
{
  const run = startPilotRun({ seed: 1 });
  // Resolve directly against the two named events regardless of seed order.
  const { AMBUSH, CORNERED_BEAST } = await import('../src/data/adventure/pilot/pilotEvents.mjs');
  let p = resolveCurrent(run, AMBUSH, null, 'aggression');
  applyResolution(run, AMBUSH, p);
  assert.ok(run.statuses.includes('hunted'), 'B: Ambush Aggression makes you Hunted');
  p = resolveCurrent(run, CORNERED_BEAST, null, 'deception');
  applyResolution(run, CORNERED_BEAST, p);
  assert.ok(!run.statuses.includes('hunted'), 'B: redirecting the beast removes Hunted');
  assert.equal(run.memories.beast.fate, 'loose', 'B: the beast is loose, aimed at the pursuers');
}

// -- Scenario C: Greyfang persists and changes a later cause ------------------
{
  const run = startPilotRun({ seed: 1, items: ['healing_salve'] });
  const { CORNERED_BEAST, AMBUSH } = await import('../src/data/adventure/pilot/pilotEvents.mjs');
  let p = resolveCurrent(run, CORNERED_BEAST, null, 'compassion');
  applyResolution(run, CORNERED_BEAST, p);
  assert.ok(run.companions.includes('greyfang'), 'C: Compassion + salve gains Greyfang');
  p = resolveCurrent(run, AMBUSH, null, 'investigation');
  assert.ok(p.interventionsApplied.includes('ambush_investigation_greyfang'), 'C: Greyfang changes the Ambush investigation cause');
}

// -- Scenario D: Mystery managed without forced death ------------------------
{
  const run = startPilotRun({ seed: 1, items: ['gatekeepers_ring'] });
  const { IRON_GATE } = await import('../src/data/adventure/pilot/pilotEvents.mjs');
  const p = resolveCurrent(run, IRON_GATE, null, 'mystery');
  assert.ok(p.pendingChoices.map(c => c.id).includes('bind'), 'D: with a ring, Iron Gate Mystery offers Bind');
  const bound = resolveChoice(run, IRON_GATE, 'mystery', 'bind');
  applyResolution(run, IRON_GATE, bound);
  assert.ok(!run.statuses.includes('haunted'), 'D: Bind avoids Haunted');
  assert.ok(run.items.includes('bound_gatekeepers_ring'), 'D: Bind produces the bound ring');
}

// -- Scenario E: Protection cost (dependent + strain) ------------------------
{
  const run = startPilotRun({ seed: 1 });
  const { IRON_GATE } = await import('../src/data/adventure/pilot/pilotEvents.mjs');
  const p = resolveCurrent(run, IRON_GATE, null, 'protection');
  applyResolution(run, IRON_GATE, p);
  assert.equal(run.strain, 'spent', 'E: Protection costs strain');
  assert.ok(run.threads.some(t => t.id === 'traveler_in_care'), 'E: Protection creates a dependent obligation');
  assert.notEqual(run.memories.ironGate.travelers, 'helped', 'E: Protection did not grant a free ideal outcome');
}

// -- Scenario F: Fortune immediate windfall + delayed price ------------------
{
  const run = startPilotRun({ seed: 1 });
  const { AMBUSH } = await import('../src/data/adventure/pilot/pilotEvents.mjs');
  const p = resolveCurrent(run, AMBUSH, null, 'fortune');
  applyResolution(run, AMBUSH, p);
  assert.ok(run.items.includes('bandit_route_ledger'), 'F: Fortune gives an immediate windfall');
  assert.ok(run.threads.some(t => t.id === 'stolen_belonging'), 'F: Fortune leaves an unresolved future price');
  // Reach A Name in Another Hand and confirm both halves.
  const { A_NAME_IN_ANOTHER_HAND } = await import('../src/data/adventure/pilot/pilotConvergences.mjs');
  assert.ok(A_NAME_IN_ANOTHER_HAND.eligible(run), 'F: the stolen belonging makes the impostor convergence eligible');
}

// -- Scenario G: Road truth appears in finale payload ------------------------
{
  const run = startPilotRun({ seed: 1 });
  const { CORNERED_BEAST } = await import('../src/data/adventure/pilot/pilotEvents.mjs');
  const { THE_ROAD_REMEMBERS } = await import('../src/data/adventure/pilot/pilotFollowups.mjs');
  // Gather evidence twice via investigation-style mystery carry + road settle.
  let p = resolveCurrent(run, CORNERED_BEAST, null, 'investigation');
  applyResolution(run, CORNERED_BEAST, p);
  assert.ok((run.memories.roadTrapEvidence || 0) >= 1, 'G: beast investigation yields road-trap evidence');
  p = resolveCurrent(run, THE_ROAD_REMEMBERS, null, 'investigation');
  applyResolution(run, THE_ROAD_REMEMBERS, p);
  run.reachedDestination = true;
  const payload = buildFinalePayload(run);
  assert.ok((payload.world.roadTrapEvidence || 0) >= 1, 'G: evidence is carried into the finale payload');
}

console.log('Adventure pilot scenarios OK — determinism + acceptance scenarios A–G verified.');
