// Validates the Adventure pilot RESOLVER and STATE model: card-first direct
// trait mapping (no routing), strain transitions, Wounded semantics, the
// Haunted Carry/Bind/Settle model, and thread creation/consumption.

import assert from 'node:assert/strict';
import { ACTION_NODE_LIST } from '../src/data/adventure/nodes.mjs';
import { createPilotRun, advanceStrainStage, reduceStrainStage } from '../src/systems/adventure/pilot/pilotState.mjs';
import { applyEffects } from '../src/systems/adventure/pilot/pilotEffects.mjs';
import { resolvePilotEvent, resolveWithChoice } from '../src/systems/adventure/pilot/pilotResolver.mjs';
import { READING_EVENTS } from '../src/data/adventure/pilot/pilotContent.mjs';
import { IRON_GATE, CORNERED_BEAST, AMBUSH } from '../src/data/adventure/pilot/pilotEvents.mjs';
import { THE_BANDITS_RETURN, BEAST_AFTER_THE_PASS } from '../src/data/adventure/pilot/pilotFollowups.mjs';

// -- Direct trait mapping: chosen reading trait equals card trait ------------
for (const event of READING_EVENTS) {
  for (const trait of ACTION_NODE_LIST) {
    const run = createPilotRun({ seed: 1 });
    const packet = resolvePilotEvent({ event, run, trait });
    assert.equal(packet.trait, trait, `${event.id}: resolving trait ${trait} must return that exact trait`);
    // The resolver never records a routed/nearest node or a distance/tier.
    assert.equal(packet.resolvedNode, undefined, `${event.id}/${trait}: resolver must not store a resolvedNode`);
    assert.equal(packet.distance, undefined, `${event.id}/${trait}: resolver must not store a distance`);
    assert.equal(packet.tier, undefined, `${event.id}/${trait}: resolver must not store a success tier`);
  }
}

// -- Strain transitions ------------------------------------------------------
assert.equal(advanceStrainStage('clear', 1), 'spent', 'clear + demanding = spent');
assert.equal(advanceStrainStage('spent', 1), 'exhausted', 'spent + demanding = exhausted');
assert.equal(advanceStrainStage('exhausted', 1), 'exhausted', 'exhausted stays exhausted (non-terminal ordinary action)');
assert.equal(reduceStrainStage('exhausted', 1), 'spent', 'recovery reduces one stage');
assert.equal(reduceStrainStage('spent', 1), 'clear', 'recovery reduces one stage');

// Iron Gate Endurance advances strain by one from clear.
{
  const run = createPilotRun({ seed: 1 });
  const packet = resolvePilotEvent({ event: IRON_GATE, run, trait: 'endurance' });
  applyEffects(run, packet.effects);
  assert.equal(run.strain, 'spent', 'Iron Gate Endurance should advance strain to spent');
  assert.equal(packet.terminal, null, 'Endurance from clear is not terminal');
}
// Iron Gate Endurance while already Exhausted is terminal (severe exertion).
{
  const run = createPilotRun({ seed: 1, strain: 'exhausted' });
  const packet = resolvePilotEvent({ event: IRON_GATE, run, trait: 'endurance' });
  assert.ok(packet.terminal, 'Endurance while Exhausted must be terminal');
  assert.equal(packet.terminal.endingId, 'ending_exhausted_exertion');
  assert.equal(packet.terminal.warningSource, 'strain:exhausted', 'terminal warning source must be visible strain');
}

// -- Wounded semantics -------------------------------------------------------
// Wounded does not kill passively: a non-physical reading continues.
{
  const run = createPilotRun({ seed: 1, statuses: ['wounded'] });
  const packet = resolvePilotEvent({ event: IRON_GATE, run, trait: 'investigation' });
  assert.equal(packet.terminal, null, 'Wounded must not passively kill on a non-physical reading');
}
// A severe physical reading while Wounded is terminal (no mitigating asset)...
{
  const run = createPilotRun({ seed: 1, statuses: ['wounded'], items: [] });
  const packet = resolvePilotEvent({ event: CORNERED_BEAST, run, trait: 'physical' });
  assert.ok(packet.terminal, 'Physical struggle while Wounded should be terminal');
  assert.equal(packet.terminal.endingId, 'ending_wounded_physical');
}
// ...unless a protective intervention (Greyfang) mitigates it.
{
  const run = createPilotRun({ seed: 1, statuses: ['wounded'], items: [], companions: ['greyfang'] });
  const packet = resolvePilotEvent({ event: CORNERED_BEAST, run, trait: 'physical' });
  assert.equal(packet.terminal, null, 'Greyfang must mitigate the Wounded physical terminal');
}
// ...and the Healing Salve also mitigates it (treatment mid-struggle).
{
  const run = createPilotRun({ seed: 1, statuses: ['wounded'], items: ['healing_salve'] });
  const packet = resolvePilotEvent({ event: CORNERED_BEAST, run, trait: 'physical' });
  assert.equal(packet.terminal, null, 'Healing Salve must mitigate the Wounded physical terminal');
}
// Treatment removes Wounded only where content supports it (Compassion+salve
// at Iron Gate does not remove wounded, but recovery/beast-after-pass paths do
// via consumeItems). Here we assert the salve-freed Greyfang beast rescue.
{
  const run = createPilotRun({ seed: 1, items: ['healing_salve'] });
  const packet = resolvePilotEvent({ event: CORNERED_BEAST, run, trait: 'compassion' });
  applyEffects(run, packet.effects);
  assert.ok(run.companions.includes('greyfang'), 'Compassion + salve should gain Greyfang');
  assert.ok(!run.items.includes('healing_salve'), 'the salve should be consumed');
}

// -- Haunted Carry / Bind / Settle / terminal --------------------------------
// Carry adds Haunted.
{
  const run = createPilotRun({ seed: 1 });
  const packet = resolvePilotEvent({ event: CORNERED_BEAST, run, trait: 'mystery' });
  // No worked_iron, no blessed -> only Carry available -> auto-applied.
  assert.equal(packet.choiceId, 'carry', 'with no vessel/blessing, Mystery auto-resolves to Carry');
  applyEffects(run, packet.effects);
  assert.ok(run.statuses.includes('haunted'), 'Carry adds Haunted');
}
// Deepen: Carry while Haunted -> Deeply Haunted.
{
  const run = createPilotRun({ seed: 1, statuses: ['haunted'] });
  const packet = resolvePilotEvent({ event: CORNERED_BEAST, run, trait: 'mystery' });
  applyEffects(run, packet.effects);
  assert.ok(run.statuses.includes('deeply_haunted'), 'Carry while Haunted deepens to Deeply Haunted');
  assert.ok(!run.statuses.includes('haunted'), 'haunted is replaced by deeply_haunted');
}
// Bind prevents deepening and creates the vessel; offered only when a vessel exists.
{
  const run = createPilotRun({ seed: 1, materials: ['worked_iron'] });
  const packet = resolvePilotEvent({ event: CORNERED_BEAST, run, trait: 'mystery' });
  assert.ok(packet.pendingChoices, 'with a vessel, Mystery should offer choices');
  assert.deepEqual(packet.pendingChoices.map(c => c.id).sort(), ['bind', 'carry'], 'Carry and Bind should be offered');
  const bound = resolveWithChoice({ event: CORNERED_BEAST, run, trait: 'mystery', choiceId: 'bind' });
  applyEffects(run, bound.effects);
  assert.ok(!run.statuses.includes('haunted'), 'Bind must not add Haunted');
  assert.ok(run.items.includes('bound_trap_presence'), 'Bind creates the bound vessel');
}
// Settle consumes its required resource (Blessed) and releases the presence.
{
  const run = createPilotRun({ seed: 1, statuses: ['blessed'] });
  const packet = resolvePilotEvent({ event: CORNERED_BEAST, run, trait: 'mystery' });
  assert.ok(packet.pendingChoices.map(c => c.id).includes('settle'), 'Blessed should offer Settle');
  const settled = resolveWithChoice({ event: CORNERED_BEAST, run, trait: 'mystery', choiceId: 'settle' });
  applyEffects(run, settled.effects);
  assert.ok(!run.statuses.includes('blessed'), 'Settle consumes Blessed');
  assert.ok(!run.statuses.includes('haunted'), 'Settle does not haunt');
  assert.equal(run.memories.beast.fate, 'freed', 'Settle frees the beast');
}
// Unsafe contact while Deeply Haunted is terminal.
{
  const run = createPilotRun({ seed: 1, statuses: ['deeply_haunted'] });
  const packet = resolvePilotEvent({ event: CORNERED_BEAST, run, trait: 'mystery' });
  assert.ok(packet.terminal, 'Carry while Deeply Haunted must be terminal');
  assert.equal(packet.terminal.endingId, 'ending_possession');
}

// -- Threads: core creates, follow-up eligible, resolves, cannot re-fire -----
{
  const run = createPilotRun({ seed: 1 });
  const packet = resolvePilotEvent({ event: CORNERED_BEAST, run, trait: 'endurance' });
  applyEffects(run, packet.effects);
  assert.ok(run.threads.some(t => t.id === 'beast_after_pass'), 'Cornered Beast Endurance creates the beast follow-up thread');
  assert.ok(BEAST_AFTER_THE_PASS.eligible(run), 'Beast After the Pass should be eligible after the beast is left trapped');

  const followPacket = resolvePilotEvent({ event: BEAST_AFTER_THE_PASS, run, trait: 'endurance' });
  applyEffects(run, followPacket.effects);
  assert.ok(!run.threads.some(t => t.id === 'beast_after_pass'), 'the follow-up should resolve its source thread');
  assert.ok(!BEAST_AFTER_THE_PASS.eligible(run), 'a resolved beast thread should not remain eligible via that thread');
}
// Ambush Aggression -> Hunted + bandits_return; Bandits Return consumes it.
{
  const run = createPilotRun({ seed: 1 });
  const packet = resolvePilotEvent({ event: AMBUSH, run, trait: 'aggression' });
  applyEffects(run, packet.effects);
  assert.ok(run.statuses.includes('hunted'), 'Ambush Aggression should make the traveler Hunted');
  assert.ok(THE_BANDITS_RETURN.eligible(run), 'Bandits Return should be eligible while bandits hunt');
  const ret = resolvePilotEvent({ event: THE_BANDITS_RETURN, run, trait: 'aggression' });
  applyEffects(run, ret.effects);
  assert.ok(!run.statuses.includes('hunted'), 'killing the new leader ends the hunt');
}

console.log('Adventure pilot state & resolver OK — direct trait mapping, strain, Wounded, Haunted, threads verified.');
