// Pilot FOLLOW-UP events — Beast After the Pass, The Bandits Return, The Road
// Remembers. Each consumes the memories/threads created by the core events, so
// an earlier decision literally becomes the shape of a later scene.

import { ACTION_NODES } from '../nodes.mjs';

const N = ACTION_NODES;

const has = id => ({ run }) => run.items.includes(id) || run.companions.includes(id);
const status = id => ({ run }) => run.statuses.includes(id);

// -- shared eligibility predicates -------------------------------------------
const beastActive = run => {
  const fate = run.memories?.beast?.fate;
  return ['trapped', 'contained', 'loose', 'cursed'].includes(fate);
};
const banditsActive = run => {
  const b = run.memories?.bandits;
  if (!b) return false;
  if (['hunting', 'humiliated'].includes(b.relation)) return true;
  if (['divided', 'leaderless'].includes(b.state)) return true;
  return b.possession && b.possession !== 'none';
};
const gateTouched = run => {
  const g = run.memories?.ironGate;
  if (!g) return false;
  const touched = ['destroyed', 'unstable', 'bypassed', 'stabilized', 'rebuilt', 'partially_collapsed'].includes(g.state);
  const claimed = g.claim && g.claim !== 'none';
  const carriesOldRoad = ['gatekeepers_ring', 'bound_gatekeepers_ring', 'road_token', 'old_road_map', 'reversed_lock_teeth', 'silver_toll_seal'].some(id =>
    run.items.includes(id),
  );
  return touched || claimed || carriesOldRoad || (run.memories?.roadTrapEvidence || 0) > 0;
};

export const BEAST_AFTER_THE_PASS = {
  id: 'beast_after_pass',
  title: 'The Beast After the Pass',
  kind: 'followup',
  consumesThreads: ['beast_after_pass', 'beast_returns', 'cursed_beast', 'gatekeeper_duty'],
  eligible: run => beastActive(run) || run.threads.some(t => ['beast_after_pass', 'beast_returns', 'cursed_beast'].includes(t.id)),
  description:
    'At dusk you reach a ruined sheepfold. The same beast lies inside the broken wall, iron chain twisted around its leg, fever taking what strength the trap left. A shepherd watches from the roof with a spear; one lamb lies injured by the gate. The shepherd demands the animal be killed.',
  detailPalette: [
    'the original chain, still dragging',
    'fever heat off the animal',
    'a shepherd with a spear',
    'an injured lamb',
    'a broken sheepfold wall',
    'dusk closing in',
  ],
  readings: {
    [N.PHYSICAL]: {
      id: 'beast_after_pass_physical',
      action: 'Hold the beast while the shepherd cuts the chain.',
      baseNarrative: [
        'You throw yourself across the fevered animal and hold it down while the shepherd saws through the chain.',
        'It comes free and staggers off into the dark — and you carry the marks of holding it.',
      ],
      consequenceLines: ['You held the beast and freed it.', 'The chain is off; the beast is gone.', 'Holding it cost you a Wound.'],
      effects: {
        addStatuses: ['wounded'],
        memoryPatch: { beast: { fate: 'freed', responsibility: 'helped_by_force' } },
        resolveThreads: ['beast_after_pass', 'cursed_beast'],
        addWitnesses: ['shepherd'],
      },
      interventions: [
        { id: 'batp_physical_greyfang', priority: 70, when: has('greyfang'), mitigatesTerminal: 'batp_physical_wound', addNarrative: ['Greyfang keeps the animal’s jaws turned away from you the whole time.'] },
        { id: 'batp_physical_salve', priority: 30, when: has('healing_salve'), mitigatesTerminal: 'batp_physical_wound', effects: { consumeItems: ['healing_salve'] }, addNarrative: ['You bind the reopened wound before it can become the end of you.'] },
        { id: 'batp_physical_prepared', priority: 60, when: status('prepared'), mitigatesTerminal: 'batp_physical_wound', effects: { removeStatuses: ['prepared'] }, addNarrative: ['You had already braced for exactly this hold.'] },
      ],
      terminalTriggers: [
        { id: 'batp_physical_wound', when: ({ run }) => run.statuses.includes('wounded'), warningStatus: 'wounded', endingId: 'ending_wounded_physical', narrative: 'You were already Wounded, and a fevered animal in a panic is stronger than a whole body, let alone a broken one. It gets to the old injury first.' },
      ],
    },
    [N.AGGRESSION]: {
      id: 'beast_after_pass_aggression',
      action: 'Kill the beast to protect the flock.',
      baseNarrative: [
        'You do what the shepherd asked and end the animal before its fever can turn on the lambs.',
        'The shepherd trusts you for it. If any of the bandits are hiding here, they have just watched you kill without hesitation.',
      ],
      consequenceLines: ['You killed the beast to save the flock.', 'The shepherd trusts you now.', 'A hidden witness may spread your reputation.'],
      effects: {
        addItems: ['beast_fang_knife'],
        memoryPatch: { beast: { fate: 'killed', responsibility: 'harmed' } },
        resolveThreads: ['beast_after_pass', 'cursed_beast', 'beast_returns'],
        addAllies: ['shepherd'],
      },
      interventions: [
        { id: 'batp_aggression_bandit_witness', priority: 90, when: ({ run }) => run.memories?.bandits && run.memories.bandits.state !== 'active', addNarrative: ['A wounded bandit hiding in the shed sees the killing and decides you are not to be crossed.'], effects: { memoryPatch: { bandits: { relation: 'fearful' } } } },
      ],
    },
    [N.PROTECTION]: {
      id: 'beast_after_pass_protection',
      action: 'Reinforce the fold and separate beast from flock through the night.',
      baseNarrative: [
        'You spend the night rebuilding the fold and keeping the fevered animal apart from the flock while the shepherd tends the lamb.',
        'By dawn the fever has broken enough to free the beast safely. It costs you nothing but the whole of your strength.',
      ],
      consequenceLines: ['You guarded both flock and beast till dawn.', 'The beast is freed; the shepherd is a witness.', 'The vigil left you drained.'],
      effects: {
        advanceStrain: 1,
        memoryPatch: { beast: { fate: 'freed', responsibility: 'helped' } },
        resolveThreads: ['beast_after_pass', 'cursed_beast'],
        addWitnesses: ['shepherd'],
      },
      terminalTriggers: [
        { id: 'batp_protection_collapse', when: ({ run }) => run.strain === 'exhausted', warningStatus: 'strain:exhausted', endingId: 'ending_exhausted_exertion', narrative: 'You were already Exhausted when you took the whole night’s watch onto yourself. There was no strength left to give it, and the cold took the rest.' },
      ],
    },
    [N.ENDURANCE]: {
      id: 'beast_after_pass_endurance',
      action: 'Keep watch until the animal is too weak to resist treatment.',
      baseNarrative: [
        'You simply wait, out of reach, until the fever wins and the animal can no longer fight being helped.',
        'Then the chain comes off easily. Patience does what force could not.',
      ],
      consequenceLines: ['You waited the beast into stillness and freed it.', 'The beast thread is closed.', 'The long watch cost you strength.'],
      effects: {
        advanceStrain: 1,
        memoryPatch: { beast: { fate: 'freed', responsibility: 'helped' } },
        resolveThreads: ['beast_after_pass', 'cursed_beast'],
      },
      interventions: [
        { id: 'batp_endurance_shelter', priority: 50, when: ({ run }) => run.statuses.includes('haunted') && (run.memories?.tollhouse === 'refuge' || run.items.includes('roadkeepers_lamp')), replaceNarrative: ['With shelter and a warm light through the night, the watch does more than tame the beast — the pressure at the edge of your mind eases for once.', 'By dawn the animal is free and your head is quieter.'], consequenceLines: ['You waited out both the beast and the haunting.', 'The beast is freed.', 'The night eased the presence troubling you.'], effects: { removeStatuses: ['haunted'], advanceStrain: 0 } },
      ],
      terminalTriggers: [
        { id: 'batp_endurance_collapse', when: ({ run }) => run.strain === 'exhausted', warningStatus: 'strain:exhausted', endingId: 'ending_exhausted_exertion', narrative: 'You were already Exhausted, and there is no support here to lean on. Somewhere in the long watch your body decides it has kept enough of them.' },
      ],
    },
    [N.COMPASSION]: {
      id: 'beast_after_pass_compassion',
      action: 'Treat the lamb first, then approach the beast with the same cloth and water.',
      baseNarrative: [
        'You tend the injured lamb where the beast can watch, then bring the same cloth and water to the animal that maimed it.',
        'It lets you. When you rise, it rises with you, and it does not leave your side again. You call it Greyfang.',
      ],
      consequenceLines: ['You healed lamb and beast alike.', 'The beast became your companion, Greyfang.', 'You spent supplies to earn it.'],
      effects: {
        consumeOneOf: [['provision', 'cloth']],
        addCompanions: ['greyfang'],
        memoryPatch: { beast: { fate: 'companion', responsibility: 'helped' } },
        resolveThreads: ['beast_after_pass', 'beast_returns', 'cursed_beast'],
        addAllies: ['shepherd'],
      },
      interventions: [
        { id: 'batp_compassion_empty', priority: 40, when: ({ run }) => run.provisions <= 0 && !run.materials.includes('cloth'), replaceNarrative: ['You have nothing to treat it with, so you can only free it and let it go.', 'It does not stay, but it does not forget you either.'], consequenceLines: ['With no supplies, you freed the beast but could not keep it.', 'The beast is freed, not joined.', 'It may still remember you later.'], effects: { addCompanions: [], memoryPatch: { beast: { fate: 'freed', responsibility: 'helped' } }, addThreads: [{ id: 'beast_returns', urgency: 'dormant', tags: ['freed'] }] } },
      ],
    },
    [N.AUTHORITY]: {
      id: 'beast_after_pass_authority',
      action: 'Order the shepherd to lower the spear and organize treatment.',
      baseNarrative: [
        'You take command of the yard — spear down, water here, cloth there — and turn a standoff into a procedure.',
        'The beast is freed under your direction, and the shepherd will testify to what you did here.',
      ],
      consequenceLines: ['You organized the rescue by command.', 'The beast is freed; you have formal testimony.', 'The shepherd will vouch for you.'],
      effects: {
        memoryPatch: { beast: { fate: 'freed', responsibility: 'helped' } },
        resolveThreads: ['beast_after_pass', 'cursed_beast'],
        addWitnesses: ['shepherd_testimony'],
      },
      interventions: [
        { id: 'batp_authority_distrusted', priority: 50, when: status('distrusted'), addNarrative: ['The shepherd will only follow your orders once you surrender a weapon as surety against the stories he has heard.'], effects: { consumeOneOf: [['beast_fang_knife', 'notched_blade', 'silver_toll_seal']] } },
      ],
    },
    [N.MYSTERY]: {
      id: 'beast_after_pass_mystery',
      action: 'Contact the presence in the chain and reveal the trapmaker’s mark.',
      baseNarrative: ['You reach into the chain rather than the animal, and the mark of the one who forged it rises to meet you.', 'It wants to be known.'],
      consequenceLines: [],
      effects: {},
      choices: [
        {
          id: 'carry', label: 'Carry it', description: 'Take the chain’s presence and free the beast.',
          narrative: ['You take the presence in and read the trapmaker’s mark clear.', 'The beast pulls free of an emptied chain, and the cold settles into you.'],
          consequenceLines: ['You carried the chain-presence and freed the beast.', 'You gained Road-Trap Evidence.', 'The contact left you Haunted.'],
          effects: { addStatuses: ['haunted'], roadTrapEvidenceInc: 1, memoryPatch: { beast: { fate: 'freed', responsibility: 'helped' } }, resolveThreads: ['beast_after_pass', 'cursed_beast'], addThreads: [{ id: 'trapmaker_truth', urgency: 'active', tags: ['mark'] }] },
          terminalTriggers: [{ id: 'batp_mystery_possession', when: ({ run }) => run.statuses.includes('deeply_haunted'), warningStatus: 'deeply_haunted', endingId: 'ending_possession', narrative: 'You were already Deeply Haunted. The chain has held frightened things a long time, and it recognizes another one in you.' }],
        },
        {
          id: 'bind', label: 'Bind it', description: 'Requires Worked Iron, a Gatekeeper’s Ring, or a Candle.',
          available: ({ run }) => run.materials.includes('worked_iron') || run.items.includes('gatekeepers_ring') || run.items.includes('gravekeepers_candle'),
          narrative: ['You seal the mark into iron or ring before it can reach you, and the beast steps free.', 'The vessel remembers what the trap knew.'],
          consequenceLines: ['You bound the chain-presence into a vessel.', 'The beast is freed; you did not deepen your haunting.', 'The Bound Trap Presence is yours.'],
          effects: { consumeMaterials: ['worked_iron'], addItems: ['bound_trap_presence'], memoryPatch: { beast: { fate: 'freed', responsibility: 'helped' } }, resolveThreads: ['beast_after_pass', 'cursed_beast'], addThreads: [{ id: 'trapmaker_truth', urgency: 'active', tags: ['bound'] }] },
        },
        {
          id: 'exchange', label: 'Exchange hauntings', description: 'Requires an existing gatekeeper haunting to swap.',
          available: ({ run }) => run.statuses.includes('haunted') && (run.threads.some(t => t.id === 'gatekeeper_duty')),
          narrative: ['You let the trapmaker’s mark take the place the gatekeeper held in you.', 'The old duty releases; a new one settles in its stead. You are still Haunted, but by something else now.'],
          consequenceLines: ['You traded the gatekeeper for the trapmaker.', 'The beast is freed; your duty changed.', 'You remain Haunted, differently.'],
          effects: { memoryPatch: { beast: { fate: 'freed', responsibility: 'helped' } }, resolveThreads: ['beast_after_pass', 'cursed_beast', 'gatekeeper_duty'], addThreads: [{ id: 'trapmaker_truth', urgency: 'active', tags: ['exchange'] }] },
        },
      ],
    },
    [N.DECEPTION]: {
      id: 'beast_after_pass_deception',
      action: 'Lead the beast away from the flock with a false scent.',
      baseNarrative: ['You lay a false scent trail out past the wall and let the fevered animal follow it away into the dark.', 'The sheepfold is safe. The beast is somewhere out there, loose, and it may wander back into the story at the worst moment.'],
      consequenceLines: ['You lured the beast off with a false trail.', 'The sheepfold crisis is resolved.', 'The beast is loose and unpredictable.'],
      effects: { memoryPatch: { beast: { fate: 'loose', responsibility: 'redirected' } }, resolveThreads: ['beast_after_pass'], addThreads: [{ id: 'cursed_beast', urgency: 'dormant', tags: ['loose'] }] },
      interventions: [
        { id: 'batp_deception_hunted', priority: 90, when: status('hunted'), addNarrative: ['You point the trail at the ones hunting you, and let the fevered animal find them first.'], effects: { removeStatuses: ['hunted'], resolveThreads: ['pursuers_close'] } },
      ],
    },
    [N.INVESTIGATION]: {
      id: 'beast_after_pass_investigation',
      action: 'Find the rust shard causing the fever and remove it.',
      baseNarrative: ['You find it at last — a rust shard driven in above the joint, poisoning the wound and the animal with it. You work it out.', 'The fever breaks; the shepherd cuts the chain. It takes time you may not have had to spare.'],
      consequenceLines: ['You cured the fever at its source and freed the beast.', 'You gained Road-Trap Evidence.', 'The time you spent let a pursuit gain ground.'],
      effects: { roadTrapEvidenceInc: 1, memoryPatch: { beast: { fate: 'freed', responsibility: 'helped' } }, resolveThreads: ['beast_after_pass', 'cursed_beast'], advanceUrgent: true },
      interventions: [
        { id: 'batp_investigation_salve', priority: 30, when: has('healing_salve'), addNarrative: ['You dress the cleaned wound with salve, and the animal decides to stay. You call it Greyfang.'], effects: { consumeItems: ['healing_salve'], addCompanions: ['greyfang'], memoryPatch: { beast: { fate: 'companion' } } } },
      ],
    },
    [N.TRANSFORMATION]: {
      id: 'beast_after_pass_transformation',
      action: 'Reshape the chain into a brace.',
      baseNarrative: ['You reforge the twisted chain into a brace that supports the ruined leg instead of binding it.', 'The beast walks free on your alteration. If the iron was cursed, the curse travels in the new shape.'],
      consequenceLines: ['You reforged the chain into a brace.', 'The ordinary beast problem is closed.', 'A cursed chain would carry its curse into the finale.'],
      effects: { memoryPatch: { beast: { fate: 'freed', responsibility: 'helped' } }, resolveThreads: ['beast_after_pass'], addThreads: [{ id: 'trapmaker_truth', urgency: 'dormant', tags: ['altered'] }] },
      interventions: [
        { id: 'batp_transformation_cursed', priority: 90, when: ({ run }) => run.memories?.beast?.fate === 'cursed' || run.threads.some(t => t.id === 'cursed_beast'), addNarrative: ['The chain was already cursed; the brace only gives the curse a cleaner shape to travel in.'], effects: { memoryPatch: { beast: { fate: 'cursed' } }, addThreads: [{ id: 'cursed_beast', urgency: 'active', tags: ['brace'] }] } },
      ],
    },
    [N.CREATION]: {
      id: 'beast_after_pass_creation',
      action: 'Build a sledge and safe restraint.',
      baseNarrative: ['You build a sledge and a restraint that will not close on the injured leg, and move the beast to safety without a hand ever entering its reach.', 'The shepherd, watching the care of it, throws in with you.'],
      consequenceLines: ['You built a sledge and moved the beast safely.', 'The beast is freed; the shepherd is an ally.', 'You avoided all risk to your body.'],
      effects: { consumeMaterials: ['timber'], consumeOneOf: [['cloth', 'worked_iron']], memoryPatch: { beast: { fate: 'freed', responsibility: 'helped' } }, resolveThreads: ['beast_after_pass', 'cursed_beast'], addAllies: ['shepherd'] },
    },
    [N.FORTUNE]: {
      id: 'beast_after_pass_fortune',
      action: 'Open the fold at the moment the storm changes.',
      baseNarrative: ['You throw the fold open exactly as the storm turns, and the beast chooses the open hillside over the flock.', 'A page from an old trap ledger stays snagged in the broken chain as it drags away.'],
      consequenceLines: ['You freed the beast on a turn of the storm and found a Trap Ledger Page.', 'The beast is loose, its finale role uncontrolled.', 'The immediate crisis is closed.'],
      effects: { addItems: ['trap_ledger_page'], roadTrapEvidenceInc: 1, memoryPatch: { beast: { fate: 'loose', responsibility: 'redirected' } }, resolveThreads: ['beast_after_pass'], addThreads: [{ id: 'cursed_beast', urgency: 'dormant', tags: ['loose'] }] },
    },
  },
};

export const THE_BANDITS_RETURN = {
  id: 'bandits_return',
  title: 'The Bandits Return',
  kind: 'followup',
  consumesThreads: ['bandits_return', 'young_bandit_deserter', 'stolen_belonging', 'pursuers_close'],
  eligible: run => banditsActive(run) || run.threads.some(t => ['bandits_return', 'young_bandit_deserter', 'stolen_belonging', 'pursuers_close'].includes(t.id)),
  description:
    'You reach an abandoned tollhouse at the narrowest part of the road. Lanterns burn behind broken windows. The bandits are waiting — and if they took something of yours, it is displayed by the door.',
  detailPalette: [
    'the dead leader’s coat over the door',
    'a new leader, or none',
    'deserters bound in the stable',
    'missing horses',
    'a fear of Greyfang',
    'your belonging on show by the entrance',
  ],
  readings: {
    [N.PHYSICAL]: {
      id: 'bandits_return_physical',
      action: 'Enter through the roof and use the barrier to divide them.',
      baseNarrative: [
        'You come down through the roof and drop the old tollhouse barrier between the bandits, splitting them before they can mass.',
        'You take back what is yours in the confusion — but a narrow house full of your enemies is a bad place for a body that cannot take a hit.',
      ],
      consequenceLines: ['You dropped in and divided them.', 'You recovered your belonging; they are scattered.', 'The entry cost you strength.'],
      effects: {
        advanceStrain: 1,
        memoryPatch: { bandits: { state: 'scattered', relation: 'humiliated', possession: 'none' }, stolenBelonging: null },
        resolveThreads: ['bandits_return', 'stolen_belonging'],
      },
      interventions: [
        { id: 'br_physical_greyfang', priority: 70, when: has('greyfang'), mitigatesTerminal: 'br_physical_capture', mitigatesTerminalAll: true, addNarrative: ['They will not close on you with Greyfang in the room; the fear of the animal keeps a lane open.'] },
        { id: 'br_physical_prepared', priority: 60, when: status('prepared'), mitigatesTerminal: 'br_physical_capture', effects: { removeStatuses: ['prepared'] }, addNarrative: ['You knew the roofline before you climbed it; the drop lands exactly where no one is looking.'] },
        { id: 'br_physical_cloak', priority: 30, when: has('smoke_cloth_cloak'), mitigatesTerminal: 'br_physical_capture', addNarrative: ['The smoke-cloth cloak keeps them from ever fixing where you are.'] },
      ],
      terminalTriggers: [
        { id: 'br_physical_wound', when: ({ run }) => run.statuses.includes('wounded'), warningStatus: 'wounded', endingId: 'ending_wounded_physical', narrative: 'You were already Wounded, and there is no soft way through a house of blades. The old injury opens, and this time it does not close.' },
        { id: 'br_physical_capture', when: ({ run }) => run.statuses.includes('hunted') && !run.items.includes('old_road_map') && !run.items.includes('stolen_horse'), warningStatus: 'hunted', endingId: 'ending_captured', narrative: 'These were the ones already hunting you, and dropping into the middle of them left no way back out. The barrier that divided them also closed behind you.' },
      ],
    },
    [N.AGGRESSION]: {
      id: 'bandits_return_aggression',
      action: 'Challenge and kill the current leader.',
      baseNarrative: ['You call out the new leader and end them in front of everyone, the way the last one ended.', 'The organized threat dies with them. What is left scatters, afraid, and the hunt is called off for want of anyone to lead it.'],
      consequenceLines: ['You killed the new leader.', 'The bandits are scattered and fearful; the hunt is over.', 'You recovered your belonging.'],
      effects: {
        removeStatuses: ['hunted'],
        addItems: ['notched_blade'],
        memoryPatch: { bandits: { state: 'scattered', relation: 'fearful', possession: 'none' }, stolenBelonging: null },
        resolveThreads: ['bandits_return', 'stolen_belonging', 'pursuers_close'],
      },
      interventions: [
        { id: 'br_aggression_prepared', priority: 60, when: status('prepared'), mitigatesTerminal: 'br_aggression_wound', effects: { removeStatuses: ['prepared'] }, addNarrative: ['You chose the ground before you spoke; the fight is over before it is fair.'] },
        { id: 'br_aggression_buckler', priority: 30, when: has('bandits_buckler'), mitigatesTerminal: 'br_aggression_wound', addNarrative: ['The buckler eats the one blow that would have reached you.'] },
      ],
      terminalTriggers: [
        { id: 'br_aggression_wound', when: ({ run }) => run.statuses.includes('wounded'), warningStatus: 'wounded', endingId: 'ending_wounded_physical', narrative: 'You were already Wounded, and a duel gives your injury one clean chance. The leader falls a moment after you do.' },
      ],
    },
    [N.PROTECTION]: {
      id: 'bandits_return_protection',
      action: 'Hold the barrier until the deserters break free.',
      baseNarrative: ['You take the barrier and hold it, letting the bound deserters work loose behind you while the attack spends itself on your guard.', 'The line splits. One of the freed deserters throws in with you — but holding that long takes a toll on you or your gear.'],
      consequenceLines: ['You held the line until the deserters broke free.', 'The bandits are divided; a deserter joins you.', 'You paid with a shield or a wound.'],
      effects: {
        removeStatuses: ['hunted'],
        memoryPatch: { bandits: { state: 'divided', relation: 'indebted', possession: 'none' }, stolenBelonging: null },
        resolveThreads: ['bandits_return', 'stolen_belonging', 'pursuers_close'],
        addAllies: ['deserter'],
      },
      interventions: [
        { id: 'br_protection_buckler', priority: 70, when: has('bandits_buckler'), replaceNarrative: ['You brace the buckler into the barrier and let the attack ruin the shield instead of you.', 'The deserters come free; the buckler does not.'], consequenceLines: ['You spent the buckler holding the line.', 'The bandits are divided; a deserter joins you.', 'The shield is gone, but you are whole.'], effects: { consumeItems: ['bandits_buckler'] } },
        { id: 'br_protection_nowshield', priority: 40, when: ({ run }) => !run.items.includes('bandits_buckler'), addNarrative: ['With nothing to sacrifice but yourself, you take the blow meant for the deserters.'], effects: { addStatuses: ['wounded'] } },
      ],
    },
    [N.ENDURANCE]: {
      id: 'bandits_return_endurance',
      action: 'Circle and wait until hunger divides the group.',
      baseNarrative: ['You do not go in. You circle the tollhouse for hours, letting cold and hunger and suspicion do to the bandits what a blade could not.', 'By the small hours they have turned on each other and scattered. Your belonging goes with whoever ran fastest.'],
      consequenceLines: ['You waited them into collapse.', 'The bandits scattered; the hunt is off.', 'Your belonging was lost in the scattering.'],
      effects: {
        advanceStrain: 1,
        removeStatuses: ['hunted'],
        memoryPatch: { bandits: { state: 'scattered', relation: 'neutral', possession: 'none' } },
        resolveThreads: ['bandits_return', 'pursuers_close'],
      },
      interventions: [
        { id: 'br_endurance_map', priority: 70, when: has('old_road_map'), mitigatesTerminal: 'br_endurance_collapse', replaceNarrative: ['The old road map shows you a maintenance tunnel under the tollhouse; you wait in shelter and take your belonging back on the way through.', 'You spend no strength you cannot spare.'], consequenceLines: ['You used a hidden tunnel to wait in shelter.', 'The bandits scattered; you recovered your belonging.', 'The map spared you the strain.'], effects: { advanceStrain: 0, memoryPatch: { stolenBelonging: null }, resolveThreads: ['stolen_belonging'] } },
      ],
      terminalTriggers: [
        { id: 'br_endurance_collapse', when: ({ run }) => run.strain === 'exhausted', warningStatus: 'strain:exhausted', endingId: 'ending_exhausted_exertion', narrative: 'You were already Exhausted, with no map, no horse, and no refuge to wait in. The night that breaks the bandits breaks you a little sooner.' },
      ],
    },
    [N.COMPASSION]: {
      id: 'bandits_return_compassion',
      action: 'Offer food and safe passage to the deserters.',
      baseNarrative: ['You call to the bound deserters and offer them food and a way out that does not end on a rope.', 'It divides the tollhouse against itself. One of them owes you now, and gives back what was taken from you.'],
      consequenceLines: ['You bought the deserters out with mercy.', 'The bandits are divided and indebted; a deserter joins you.', 'You recovered your belonging.'],
      effects: {
        consumeProvision: 1,
        memoryPatch: { bandits: { state: 'divided', relation: 'indebted', possession: 'none' }, stolenBelonging: null },
        resolveThreads: ['bandits_return', 'stolen_belonging', 'young_bandit_deserter'],
        addAllies: ['deserter'],
      },
      interventions: [
        { id: 'br_compassion_distrusted', priority: 50, when: status('distrusted'), addNarrative: ['They will not trust the offer until you hand over something that proves you mean it.'], effects: { consumeOneOf: [['road_token', 'silver_toll_seal', 'provision']] } },
      ],
    },
    [N.AUTHORITY]: {
      id: 'bandits_return_authority',
      action: 'Invoke military or old-road authority.',
      baseNarrative: ['You address the tollhouse as though you already command the road it stands on, and enough of them remember discipline to hesitate.', 'The group splits along the line of who still believes in orders. You take your belonging back as though it were requisitioned.'],
      consequenceLines: ['You divided them by authority.', 'The bandits are divided.', 'You recovered your belonging.'],
      effects: {
        memoryPatch: { bandits: { state: 'divided', relation: 'neutral', possession: 'none' }, stolenBelonging: null },
        resolveThreads: ['bandits_return', 'stolen_belonging'],
      },
      interventions: [
        { id: 'br_authority_insignia', priority: 70, when: has('soldiers_insignia'), replaceNarrative: ['You show the soldier’s insignia and the pretense of banditry collapses into old rank.', 'They scatter to your word, and more than one deserter falls in behind you.'], consequenceLines: ['The insignia scattered them outright.', 'You recovered your belonging; deserters joined you.', 'The hunt is over.'], effects: { removeStatuses: ['hunted'], memoryPatch: { bandits: { state: 'scattered', relation: 'fearful' } }, resolveThreads: ['pursuers_close'], addAllies: ['deserter', 'deserter'] } },
        { id: 'br_authority_ring', priority: 60, when: has('road_token'), addNarrative: ['The tollhouse machinery reads your road token and confirms the claim for you.'] },
        { id: 'br_authority_false', priority: 90, when: ({ run }) => run.memories?.ironGate?.claim === 'deceived', addNarrative: ['But your road-claim was a lie once, and someone here was at the gate to hear it. The bluff wobbles.'], effects: { addStatuses: ['distrusted'] } },
      ],
    },
    [N.MYSTERY]: {
      id: 'bandits_return_mystery',
      action: 'Ask the dead leader who betrayed them.',
      baseNarrative: ['You speak past the living to the leader you killed, and ask, in front of everyone, who it was that turned on them.', 'The dead answer.'],
      consequenceLines: [],
      effects: {},
      choices: [
        {
          id: 'carry', label: 'Carry the dead voice', description: 'Let the dead leader speak through you.',
          narrative: ['You let the dead leader use your mouth, and the tollhouse empties of everyone brave enough to run.', 'The voice does not leave when the room does.'],
          consequenceLines: ['You spoke with the dead leader’s voice.', 'The bandits are divided and terrified.', 'The contact left you Haunted.'],
          effects: { addStatuses: ['haunted'], memoryPatch: { bandits: { state: 'divided', relation: 'fearful' } }, resolveThreads: ['bandits_return'] },
          terminalTriggers: [{ id: 'br_mystery_possession', when: ({ run }) => run.statuses.includes('deeply_haunted'), warningStatus: 'deeply_haunted', endingId: 'ending_possession', narrative: 'You were already Deeply Haunted. The dead leader was always going to be stronger than a crowded, frightened head, and it simply stays.' }],
        },
        {
          id: 'bind', label: 'Bind the leader into a blade', description: 'Requires the Notched Blade taken from them.',
          available: ({ run }) => run.items.includes('notched_blade'),
          narrative: ['You bind the dead leader into the blade you took from the first one, and the weapon goes heavy with grievance.', 'It can expose a traitor or frighten a room, once. Turn it on the innocent and the leader will take it back.'],
          consequenceLines: ['You bound the leader into the Notched Blade.', 'The bandits are divided; you stayed unhaunted.', 'The bound blade holds one accusation.'],
          effects: { memoryPatch: { bandits: { state: 'divided', relation: 'fearful' } }, resolveThreads: ['bandits_return'], addThreads: [{ id: 'trapmaker_truth', urgency: 'dormant', tags: ['bound-blade'] }] },
        },
        {
          id: 'settle', label: 'Settle the betrayal', description: 'Requires a spared young bandit or a deserter ally.',
          available: ({ run }) => run.allies.includes('deserter') || run.threads.some(t => t.id === 'young_bandit_deserter'),
          narrative: ['With one of their own to name names, you expose the betrayer plainly and let the dead leader go.', 'No haunting, no bound weapon — only the truth, and a group that can no longer hold together around a lie.'],
          consequenceLines: ['You exposed the betrayer through a witness.', 'The bandits are divided; the dead departed.', 'You gained no occult weapon.'],
          effects: { memoryPatch: { bandits: { state: 'divided', relation: 'neutral' } }, resolveThreads: ['bandits_return', 'young_bandit_deserter'] },
        },
      ],
    },
    [N.DECEPTION]: {
      id: 'bandits_return_deception',
      action: 'Enter as the patrol or threat the bandits expect.',
      baseNarrative: ['You walk in wearing the shape of the thing they are most afraid of — a patrol, a rival, a reckoning — and let their own dread do the work.', 'They divide and break. You take your belonging back off the wall on your way through.'],
      consequenceLines: ['You entered as the threat they feared.', 'The bandits are divided and humiliated; the hunt is off.', 'You recovered your belonging.'],
      effects: {
        removeStatuses: ['hunted'],
        memoryPatch: { bandits: { state: 'divided', relation: 'humiliated', possession: 'none' }, stolenBelonging: null },
        resolveThreads: ['bandits_return', 'stolen_belonging', 'pursuers_close'],
        addAllies: ['deserter'],
      },
      interventions: [
        { id: 'br_deception_redirect', priority: 90, when: ({ run }) => run.enemies.length > 0, addNarrative: ['You leave them pointed at another enemy of yours, and let the two of them settle it.'] },
        { id: 'br_deception_nocloak', priority: 40, when: ({ run }) => !run.items.includes('smoke_cloth_cloak'), addNarrative: ['Without real concealment, one sharp-eyed bandit half-recognizes you; the lie will resurface later.'], effects: { addThreads: [{ id: 'false_identity', urgency: 'dormant', tags: ['bandit-witness'] }] } },
      ],
    },
    [N.INVESTIGATION]: {
      id: 'bandits_return_investigation',
      action: 'Expose that the leader is withholding food and goods.',
      baseNarrative: ['You find the proof and say it out loud: the new leader has been keeping the food and the takings for themselves.', 'The control evaporates. They turn on the leader, hand back your belonging to buy your goodwill, and the immediate threat is simply gone.'],
      consequenceLines: ['You exposed the leader’s hoarding.', 'The bandits are divided and indebted; you recovered your belonging.', 'You resolved the threat completely — and gained no foresight from it.'],
      effects: {
        memoryPatch: { bandits: { state: 'divided', relation: 'indebted', possession: 'none' }, stolenBelonging: null },
        resolveThreads: ['bandits_return', 'stolen_belonging'],
        addItems: ['bandit_route_ledger'],
      },
      interventions: [
        { id: 'br_investigation_greyfang', priority: 70, when: has('greyfang'), addNarrative: ['Greyfang finds the stable exit the leader was guarding, and the proof and the escape arrive together.'] },
      ],
    },
    [N.TRANSFORMATION]: {
      id: 'bandits_return_transformation',
      action: 'Drop the old road barrier between factions.',
      baseNarrative: ['You seize the old road mechanism and drop its barrier straight down the middle of the tollhouse, cutting the group physically in two.', 'Each half now needs you more than it needs the other. Your belonging comes back as part of the bargain.'],
      consequenceLines: ['You split them with the road’s own barrier.', 'The bandits are divided and indebted; you recovered your belonging.', 'The horses came loose in the chaos.'],
      effects: {
        memoryPatch: { bandits: { state: 'divided', relation: 'indebted', possession: 'none' }, stolenBelonging: null },
        resolveThreads: ['bandits_return', 'stolen_belonging'],
        addItems: ['stolen_horse'],
      },
      interventions: [
        { id: 'br_transformation_greyfang', priority: 70, when: has('greyfang'), addNarrative: ['Greyfang goes after the loosed horses, and you must decide whether to keep the animal or the mount.'], effects: { addThreads: [{ id: 'beast_returns', urgency: 'dormant', tags: ['herd'] }] } },
      ],
    },
    [N.CREATION]: {
      id: 'bandits_return_creation',
      action: 'Build a wet-cloth smoke channel through the chimney.',
      baseNarrative: ['You block the chimney and build a wet-cloth channel that drives cold smoke down into the tollhouse without a single spark reaching the timbers.', 'They stumble out coughing into the dark. You walk in the other way, free the deserters, and take back your goods.'],
      consequenceLines: ['You smoked them out without a fire.', 'The bandits are scattered and humiliated; the deserters are free.', 'You recovered your goods.'],
      effects: {
        consumeMaterials: ['cloth'],
        memoryPatch: { bandits: { state: 'scattered', relation: 'humiliated', possession: 'none' }, stolenBelonging: null },
        resolveThreads: ['bandits_return', 'stolen_belonging'],
        addAllies: ['deserter'],
      },
    },
    [N.FORTUNE]: {
      id: 'bandits_return_fortune',
      action: 'Offer them a single wager: the belonging, or the cheating leader.',
      baseNarrative: ['You walk in and put one bet on the table — they can keep the thing they stole from you, or keep the leader who has been cheating them.', 'The room chooses the belonging. In the noise of the choosing, you lift the leader’s hidden tollhouse key and go.'],
      consequenceLines: ['You traded chaos for the Tollhouse Master Key.', 'The bandits are divided; the hunt is off.', 'Your belonging left with an unknown faction.'],
      effects: {
        removeStatuses: ['hunted'],
        addItems: ['tollhouse_master_key'],
        memoryPatch: { bandits: { state: 'divided', relation: 'neutral', possession: 'player_belonging' } },
        resolveThreads: ['bandits_return', 'pursuers_close'],
        addThreads: [{ id: 'stolen_belonging', urgency: 'active', tags: ['unknown-faction'] }],
      },
    },
  },
};

export const THE_ROAD_REMEMBERS = {
  id: 'road_remembers',
  title: 'The Road Remembers',
  kind: 'followup',
  consumesThreads: ['road_remembers', 'gatekeeper_duty', 'traveler_in_care', 'trapmaker_truth', 'false_identity'],
  eligible: gateTouched,
  description:
    'At midnight every milestone points toward the same abandoned tollhouse. Behind the desk sits a roadkeeper in a uniform unworn for generations. An open ledger bears the current date, your name, and an account of the Iron Gate. "By what right did you cross?"',
  detailPalette: [
    'milestones all pointing one way',
    'a roadkeeper in an ancient uniform',
    'an open ledger with your name',
    'the account of the Iron Gate',
    'a silent bell',
    'names written beneath yours',
  ],
  readings: {
    [N.PHYSICAL]: {
      id: 'road_remembers_physical',
      action: 'Overturn the desk and force the forward mechanism.',
      baseNarrative: ['You put your shoulder to the desk and the ancient mechanism behind it, and force the road forward by main strength.', 'The ledger scatters. You will get no more help from the old road — but no more demands from it either.'],
      consequenceLines: ['You forced the road open by hand.', 'You are an outlaw of the old road now.', 'The inherited duty ends here.'],
      effects: {
        advanceStrain: 1,
        memoryPatch: { roadOutcome: 'outlaw' },
        resolveThreads: ['road_remembers', 'gatekeeper_duty'],
      },
      interventions: [
        { id: 'rr_physical_iron', priority: 30, when: ({ run }) => run.materials.includes('worked_iron'), mitigatesTerminal: 'rr_physical_wound', addNarrative: ['You break the mechanism with iron rather than bone.'] },
        { id: 'rr_physical_companion', priority: 70, when: has('greyfang'), mitigatesTerminal: 'rr_physical_wound', addNarrative: ['Greyfang throws its weight against the desk beside you.'] },
        { id: 'rr_physical_prepared', priority: 60, when: status('prepared'), mitigatesTerminal: 'rr_physical_wound', effects: { removeStatuses: ['prepared'] }, addNarrative: ['You had already found the mechanism’s weak seam.'] },
      ],
      terminalTriggers: [
        { id: 'rr_physical_wound', when: ({ run }) => run.statuses.includes('wounded'), warningStatus: 'wounded', endingId: 'ending_wounded_physical', narrative: 'You were already Wounded, and old iron does not give for a broken body. Something in you tears before the mechanism does.' },
      ],
    },
    [N.AGGRESSION]: {
      id: 'road_remembers_aggression',
      action: 'Burn the ledger and destroy the bell.',
      baseNarrative: ['You put the ledger to the lamp and take the silent bell off its mount and break it.', 'Every obligation the old road held over you burns with the page — and every benefit with it. If a gatekeeper rode in you, and only there, it has nothing left to hold to.'],
      consequenceLines: ['You burned the ledger and broke the bell.', 'The old road is Broken; its debts and gifts are gone.', 'Any trap evidence burned with the page.'],
      effects: {
        memoryPatch: { roadOutcome: 'broken', roadTrapEvidence: 0 },
        resolveThreads: ['road_remembers', 'gatekeeper_duty', 'trapmaker_truth'],
      },
      interventions: [
        { id: 'rr_aggression_unhaunt', priority: 90, when: ({ run }) => run.statuses.includes('haunted') && run.threads.some(t => t.id === 'gatekeeper_duty'), addNarrative: ['The gatekeeper had no home but this ledger; the fire that takes the page takes the haunting with it.'], effects: { removeStatuses: ['haunted'] } },
      ],
    },
    [N.PROTECTION]: {
      id: 'road_remembers_protection',
      action: 'Accept responsibility for keeping the road safe.',
      baseNarrative: ['You answer the question by taking the duty on: you will keep the road safe for those the gate endangered.', 'The roadkeeper hands you a lamp and a charge. It makes you strong on this road and beholden to it, and it takes most of what strength you had left.'],
      consequenceLines: ['You became the road’s Keeper.', 'You gained the Roadkeeper’s Lamp and one finale protection.', 'The obligation must be met before the end.'],
      effects: {
        setStrain: 'spent',
        addItems: ['roadkeepers_lamp'],
        memoryPatch: { roadOutcome: 'keeper' },
        resolveThreads: ['road_remembers'],
        addThreads: [{ id: 'roadkeeper_obligation', urgency: 'active', tags: ['duty'] }],
      },
      interventions: [
        { id: 'rr_protection_token', priority: 60, when: has('road_token'), addNarrative: ['You lay the road token on the ledger, and the road blesses the appointment.'], effects: { addStatuses: ['blessed'] } },
      ],
    },
    [N.ENDURANCE]: {
      id: 'road_remembers_endurance',
      action: 'Walk the original keeper’s circuit.',
      baseNarrative: ['Rather than answer, you take up the lantern and walk the keeper’s old circuit yourself, milestone to milestone, until the ledger has no question left to ask.', 'The duty is discharged by the walking of it, and the ring you carried loses whatever the road had put into it.'],
      consequenceLines: ['You walked the keeper’s circuit to its end.', 'The road is Released; the duty and its haunting are gone.', 'The circuit cost you strength and your ring’s power.'],
      effects: {
        advanceStrain: 1,
        removeStatuses: ['haunted'],
        memoryPatch: { roadOutcome: 'released' },
        resolveThreads: ['road_remembers', 'gatekeeper_duty'],
      },
      interventions: [
        { id: 'rr_endurance_map', priority: 70, when: has('old_road_map'), mitigatesTerminal: 'rr_endurance_collapse', replaceNarrative: ['The old road map turns the circuit from an ordeal into a route; you walk it clean and rested.', 'The duty ends without breaking you.'], effects: { advanceStrain: 0 } },
      ],
      terminalTriggers: [
        { id: 'rr_endurance_collapse', when: ({ run }) => run.strain === 'exhausted', warningStatus: 'strain:exhausted', endingId: 'ending_exhausted_exertion', narrative: 'You were already Exhausted, and the keeper’s circuit is longer than one night should be. You sit down at a milestone to rest, and do not get up.' },
      ],
    },
    [N.COMPASSION]: {
      id: 'road_remembers_compassion',
      action: 'Ask about the names written beneath yours.',
      baseNarrative: ['You ignore the accusation and ask instead about the other names in the ledger — the ones written under yours, the ones the road is still waiting on.', 'The roadkeeper softens toward the asking. A pardon is possible, but the ledger will want its debts made good.'],
      consequenceLines: ['You asked after the road’s other debts.', 'The road is willing to Pardon you.', 'What you owe depends on who you left behind.'],
      effects: {
        memoryPatch: { roadOutcome: 'pardoned' },
        resolveThreads: ['road_remembers'],
      },
      interventions: [
        { id: 'rr_compassion_abandoned', priority: 90, when: ({ run }) => run.memories?.ironGate?.travelers === 'abandoned', addNarrative: ['Your name sits above the travelers you left at the gate. The pardon requires you to make that right — a sacrifice, or a promise of rescue.'], effects: { consumeOneOf: [['road_token', 'silver_toll_seal', 'provision']], addThreads: [{ id: 'traveler_in_care', urgency: 'active', tags: ['restitution'] }] } },
        { id: 'rr_compassion_helped', priority: 80, when: ({ run }) => ['helped', 'in_care', 'escorted'].includes(run.memories?.ironGate?.travelers), addNarrative: ['The travelers you helped are named as witnesses in your favor, and the road answers their word with a blessing.'], effects: { addStatuses: ['blessed'] } },
        { id: 'rr_compassion_token', priority: 40, when: has('road_token'), addNarrative: ['You lay down the road token as proof of aid given.'], effects: { consumeItems: ['road_token'] } },
      ],
    },
    [N.AUTHORITY]: {
      id: 'road_remembers_authority',
      action: 'Present the basis of your claim.',
      baseNarrative: ['You answer the question directly: you set your claim on the ledger and let the road judge it.', 'How the road answers depends entirely on what your claim is actually built on.'],
      consequenceLines: ['You presented your claim to the road.', 'The road judged it by its true foundation.', 'Legitimacy is power here; its absence is a debt.'],
      effects: { memoryPatch: { roadOutcome: 'contested' }, resolveThreads: ['road_remembers'], addThreads: [{ id: 'roadkeeper_obligation', urgency: 'dormant', tags: ['liability'] }] },
      interventions: [
        { id: 'rr_authority_legit', priority: 90, when: ({ run }) => run.items.includes('gatekeepers_ring') && run.memories?.ironGate?.claim === 'inherited', replaceNarrative: ['You set the gatekeeper’s ring on the ledger, and the road reads an inheritance it already recognizes.', 'You keep the ring, and gain the authority to open the last threshold.'], consequenceLines: ['Your inherited claim was confirmed.', 'The road names you Keeper; you keep the ring.', 'You hold threshold authority for the finale.'], effects: { memoryPatch: { roadOutcome: 'keeper' }, resolveThreads: ['roadkeeper_obligation'] } },
        { id: 'rr_authority_insignia', priority: 80, when: has('soldiers_insignia'), replaceNarrative: ['You present the soldier’s insignia, and the road accepts a commission if not an inheritance.', 'Your duty is limited, but real.'], consequenceLines: ['Your commission was accepted.', 'The road names you Commissioned.', 'Your duty is limited but legitimate.'], effects: { memoryPatch: { roadOutcome: 'commissioned' } } },
        { id: 'rr_authority_deceived', priority: 95, when: ({ run }) => run.memories?.ironGate?.claim === 'deceived', replaceNarrative: ['The ledger already holds the false patrol you invented at the gate. The road demands you surrender the lie or wear it.', 'You cannot prove what you claimed, and the road knows it.'], consequenceLines: ['Your earlier deception surfaced in the ledger.', 'You must surrender the claim or become Outlaw.', 'The false road identity is exposed.'], effects: { memoryPatch: { roadOutcome: 'outlaw', falseIdentity: null }, addStatuses: ['distrusted'], resolveThreads: ['false_identity'] } },
      ],
    },
    [N.MYSTERY]: {
      id: 'road_remembers_mystery',
      action: 'Ask whether the roadkeeper is a person, a duty, or a memory.',
      baseNarrative: ['You ask the roadkeeper what it actually is — a man kept past his death, an office with no one to fill it, or only the road remembering itself.', 'The answer opens like a door.'],
      consequenceLines: [],
      effects: {},
      choices: [
        {
          id: 'carry', label: 'Carry the road’s memory', description: 'Take the roadkeeper into yourself and learn the secret way.',
          narrative: ['You let the road’s memory settle into you, and it shows you a route the milestones never marked.', 'You are Keeper now, in a way that does not wash off.'],
          consequenceLines: ['You carried the roadkeeper’s memory.', 'The road names you Keeper; a secret finale route opens.', 'The contact deepened your haunting.'],
          effects: { addStatuses: ['haunted'], memoryPatch: { roadOutcome: 'keeper' }, resolveThreads: ['road_remembers'], addThreads: [{ id: 'trapmaker_truth', urgency: 'dormant', tags: ['secret-route'] }] },
          terminalTriggers: [{ id: 'rr_mystery_possession', when: ({ run }) => run.statuses.includes('deeply_haunted'), warningStatus: 'deeply_haunted', endingId: 'ending_possession', narrative: 'You were already Deeply Haunted. The road’s memory is older and wider than a person, and once it is inside you there is very little person left to argue.' }],
        },
        {
          id: 'bind', label: 'Bind the roadkeeper', description: 'Requires a Gatekeeper’s Ring or Roadkeeper’s Lamp.',
          available: ({ run }) => run.items.includes('gatekeepers_ring') || run.items.includes('bound_gatekeepers_ring') || run.items.includes('roadkeepers_lamp'),
          narrative: ['You bind the roadkeeper into ring or lamp, where it can open the secret route without ever touching your mind.', 'It will, one day, ask for the duty it was denied.'],
          consequenceLines: ['You bound the roadkeeper into an object.', 'The road is Bound; you did not deepen your haunting.', 'The vessel opens the secret route.'],
          effects: { memoryPatch: { roadOutcome: 'bound' }, resolveThreads: ['road_remembers'], addThreads: [{ id: 'trapmaker_truth', urgency: 'dormant', tags: ['bound-route'] }] },
        },
        {
          id: 'settle', label: 'Settle the account', description: 'Requires Road-Trap Evidence to prove the road’s own harm.',
          available: ({ run }) => (run.memories?.roadTrapEvidence || 0) > 0,
          narrative: ['You lay out the trap evidence and prove that the road’s own authority made the harm it now blames on travelers.', 'The individual keeper is released, and the road’s hidden purpose stands exposed — no haunting required.'],
          consequenceLines: ['You settled the road’s account with evidence.', 'The road is Accounted; its hidden purpose is revealed.', 'You released the keeper without being haunted.'],
          effects: { memoryPatch: { roadOutcome: 'accounted' }, resolveThreads: ['road_remembers', 'trapmaker_truth'], roadTrapEvidenceInc: 1 },
        },
      ],
    },
    [N.DECEPTION]: {
      id: 'road_remembers_deception',
      action: 'Rewrite the crossing under a dead officer’s identity.',
      baseNarrative: ['You take the pen and rewrite the account: it was not you who crossed, but a dead officer whose name the ledger still honors.', 'The obligation lifts from your name and lands on a corpse. The lie holds — until something checks it.'],
      consequenceLines: ['You signed the crossing to a dead officer.', 'The road’s demand is Unrecorded against you.', 'The false identity may be exposed later.'],
      effects: {
        memoryPatch: { roadOutcome: 'unrecorded', falseIdentity: 'dead_officer' },
        resolveThreads: ['road_remembers'],
        addThreads: [{ id: 'false_identity', urgency: 'active', tags: ['road', 'officer'] }],
      },
      interventions: [
        { id: 'rr_deception_insignia', priority: 60, when: has('soldiers_insignia'), addNarrative: ['The soldier’s insignia makes the dead officer’s name sit convincingly in your hand.'] },
      ],
    },
    [N.INVESTIGATION]: {
      id: 'road_remembers_investigation',
      action: 'Reorganize the ledger as unfinished causes rather than guilt.',
      baseNarrative: ['You take the ledger apart and rebuild it — not as a list of the guilty, but as a record of unfinished causes, each pointing at who truly owes what.', 'Rewritten this way, the road can see where responsibility actually lies. It shows you the safest way onward in return.'],
      consequenceLines: ['You rebuilt the ledger as causes, not blame.', 'The road is Accounted; you gained a copied Ledger Page.', 'Rewriting it cost time an urgent danger used.'],
      effects: {
        memoryPatch: { roadOutcome: 'accounted' },
        addItems: ['ledger_page'],
        resolveThreads: ['road_remembers'],
        advanceUrgent: true,
      },
      interventions: [
        { id: 'rr_investigation_evidence', priority: 60, when: ({ run }) => (run.memories?.roadTrapEvidence || 0) > 0, addNarrative: ['Your trap evidence slots straight into the record and closes the road’s oldest open cause.'], effects: { resolveThreads: ['trapmaker_truth'], roadTrapEvidenceInc: 1 } },
      ],
    },
    [N.TRANSFORMATION]: {
      id: 'road_remembers_transformation',
      action: 'Remove royal ownership and make the king’s road a common road.',
      baseNarrative: ['You do not answer by what right you crossed — you erase the question, striking the royal claim out of the ledger and making the king’s road a common one.', 'The barriers lose their meaning. Everyone gains the road at once: your allies, your enemies, and the public who never had it.'],
      consequenceLines: ['You made the king’s road a common road.', 'The road is Freed; you gained a public ally.', 'You lost the exclusive authority of your ring.'],
      effects: {
        memoryPatch: { roadOutcome: 'freed' },
        resolveThreads: ['road_remembers', 'gatekeeper_duty'],
        addAllies: ['road_commons'],
      },
      interventions: [
        { id: 'rr_transformation_evidence', priority: 60, when: ({ run }) => (run.memories?.roadTrapEvidence || 0) > 0, addNarrative: ['The trap evidence, made public, condemns the old traps and disables them for good.'], effects: { resolveThreads: ['trapmaker_truth'] } },
      ],
    },
    [N.CREATION]: {
      id: 'road_remembers_creation',
      action: 'Repair the tollhouse as a refuge.',
      baseNarrative: ['Instead of arguing the ledger, you rebuild the tollhouse around it — a roof, a hearth, a barred door — and make it a place people can shelter.', 'The road accepts the work as its answer. You will have somewhere to rest before the end, though allies and enemies alike may find it too.'],
      consequenceLines: ['You rebuilt the tollhouse as a refuge.', 'The road is a Refuge; you eased your strain.', 'The refuge is open to whoever finds it.'],
      effects: {
        consumeOneOf: [['worked_iron']],
        reduceStrain: 1,
        memoryPatch: { roadOutcome: 'refuge', tollhouse: 'refuge' },
        resolveThreads: ['road_remembers'],
      },
      interventions: [
        { id: 'rr_creation_alt_materials', priority: 60, when: ({ run }) => !run.materials.includes('worked_iron') && run.materials.includes('timber') && run.materials.includes('cloth'), replaceNarrative: ['Lacking worked iron, you frame the refuge from timber and hang cloth against the wind.', 'It is rougher, but it holds, and it rests you all the same.'], effects: { consumeMaterials: ['timber', 'cloth'] } },
      ],
    },
    [N.FORTUNE]: {
      id: 'road_remembers_fortune',
      action: 'Sign the blank line without naming the duty.',
      baseNarrative: ['You sign the blank line at the bottom of the ledger without reading what it commits you to, and the roadkeeper slides a black-and-silver coin across the desk before closing the book.', 'Something is settled. What, exactly, the road will decide later, out of everything you have actually done.'],
      consequenceLines: ['You signed the blank line and took the Road’s Favor.', 'The road’s outcome is Unsettled.', 'The road will choose its role from your conduct.'],
      effects: {
        addItems: ['roads_favor'],
        memoryPatch: { roadOutcome: 'unsettled' },
        resolveThreads: ['road_remembers'],
      },
    },
  },
};

export const PILOT_FOLLOWUP_EVENTS = [BEAST_AFTER_THE_PASS, THE_BANDITS_RETURN, THE_ROAD_REMEMBERS];
