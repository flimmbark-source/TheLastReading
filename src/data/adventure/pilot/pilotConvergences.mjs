// Pilot CONVERGENCE events. Each combines exactly two major active threads so
// that consequences collide instead of waiting independently in a list. A third
// state may intervene but should not become an equal focus.

import { ACTION_NODES } from '../nodes.mjs';

const N = ACTION_NODES;

const status = id => ({ run }) => run.statuses.includes(id);

const fireActive = run => run.memories?.fire === 'active' || run.threads.some(t => t.id === 'roadside_fire');
const otherActiveThread = (run, ids) => run.threads.some(t => ids.includes(t.id)) ||
  (run.memories?.bandits && run.memories.bandits.state !== 'active');
const beastLooseOrCursed = run => ['loose', 'cursed'].includes(run.memories?.beast?.fate) ||
  run.threads.some(t => ['cursed_beast'].includes(t.id));
const belongingLost = run => (run.memories?.stolenBelonging != null) || Boolean(run.memories?.falseIdentity) ||
  (run.memories?.bandits && run.memories.bandits.possession && run.memories.bandits.possession !== 'none') ||
  run.threads.some(t => ['stolen_belonging', 'false_identity', 'impostor_drawing_pursuit'].includes(t.id));

export const SMOKE_AT_THE_TOLLHOUSE = {
  id: 'smoke_tollhouse',
  title: 'Smoke at the Tollhouse',
  kind: 'convergence',
  combines: ['roadside_fire', 'bandits/travelers/roadkeeper'],
  eligible: run =>
    fireActive(run) &&
    (otherActiveThread(run, ['bandits_return', 'young_bandit_deserter', 'traveler_in_care', 'roadkeeper_obligation', 'stolen_belonging']) ||
      run.memories?.roadOutcome != null),
  description:
    'The fire you started at the ambush has reached the tollhouse. Flames move through the roof beams; sparks drive toward the wooden bridge. People are trapped inside — and who they are depends on everything you have done so far.',
  detailPalette: ['fire in the roof beams', 'sparks toward the bridge', 'people trapped inside', 'a wet cloak', 'a warning bell', 'a dry storage shed'],
  readings: {
    [N.PHYSICAL]: {
      id: 'smoke_physical', action: 'Enter through the collapsing rear wall and drag people out.',
      baseNarrative: ['You go in through the failing rear wall and carry them out one at a time, coughing, through the heat.', 'You get the people; you cannot get the building, or anything left in it.'],
      consequenceLines: ['You dragged the trapped group out by hand.', 'The fire is resolved; the tollhouse contents are lost.', 'The rescue cost you strength.'],
      effects: { advanceStrain: 1, memoryPatch: { fire: 'resolved', tollhouse: 'destroyed' }, resolveThreads: ['roadside_fire'], addAllies: ['rescued'] },
      terminalTriggers: [{ id: 'smoke_physical_collapse', when: ({ run }) => run.strain === 'exhausted', warningStatus: 'strain:exhausted', endingId: 'ending_exhausted_exertion', narrative: 'You were already Exhausted when you went into the smoke. The heat asks for more than you have, and the roof comes down on the difference.' }],
    },
    [N.AGGRESSION]: {
      id: 'smoke_aggression', action: 'Destroy the bridge supports before the fire can cross.',
      baseNarrative: ['You cut the burning bridge supports down before the flames can reach them, sealing the road ahead from the fire behind.', 'Whatever hostile faction was trapped is cut off with the flames — and so is anyone friendly who had not already run.'],
      consequenceLines: ['You dropped the bridge to stop the fire.', 'The road ahead is protected; the trapped faction is lost with it.', 'The road turns toward Broken.'],
      effects: { memoryPatch: { fire: 'resolved', roadOutcome: 'broken' }, resolveThreads: ['roadside_fire', 'bandits_return'] },
    },
    [N.PROTECTION]: {
      id: 'smoke_protection', action: 'Hold a wet cloak over the doorway while others evacuate.',
      baseNarrative: ['You soak a cloak and hold the doorway open as a breathable seam, and everyone with a name in this run comes out through it.', 'The cloak and most of your pack are ruined; the tollhouse is not saved. But the people are.'],
      consequenceLines: ['You held the door and saved everyone.', 'The fire is resolved; the tollhouse is destroyed.', 'You spent cloth and strength; witnesses saw it.'],
      effects: { consumeOneOf: [['cloth', 'provision', 'provision']], setStrain: 'spent', memoryPatch: { fire: 'resolved', tollhouse: 'destroyed' }, resolveThreads: ['roadside_fire', 'traveler_in_care'], addWitnesses: ['fire_witnesses'] },
    },
    [N.ENDURANCE]: {
      id: 'smoke_endurance', action: 'Fight every ember through the night.',
      baseNarrative: ['You stay and beat down every ember that tries to cross the road, all night, until there is nothing left to catch.', 'The bridge stands and the fire dies — but anyone who could not walk out on their own is still in there, needing something you did not do.'],
      consequenceLines: ['You held the fire off the bridge all night.', 'The fire is resolved; the bridge stands.', 'The immobile still need another rescue.'],
      effects: { advanceStrain: 1, memoryPatch: { fire: 'resolved' }, resolveThreads: ['roadside_fire'] },
      interventions: [{ id: 'smoke_endurance_allies', priority: 70, when: ({ run }) => run.allies.length > 0 || run.memories?.tollhouse === 'refuge', addNarrative: ['With allies on the line and a refuge at your back, the night is enough to save the building too.'], effects: { memoryPatch: { tollhouse: 'refuge' } } }],
      terminalTriggers: [{ id: 'smoke_endurance_collapse', when: ({ run }) => run.strain === 'exhausted', warningStatus: 'strain:exhausted', endingId: 'ending_exhausted_exertion', narrative: 'You were already Exhausted, and a fire does not tire when you do. Somewhere before dawn you stop beating back the embers, and they do not stop.' }],
    },
    [N.COMPASSION]: {
      id: 'smoke_compassion', action: 'Rescue the person least able to escape.',
      baseNarrative: ['You go straight for the one who cannot run — the injured, the child, the bound — whoever they are, whatever side they were on.', 'You get them out. The fire keeps moving toward the bridge behind you, and you leave something of value in the flames to do it.'],
      consequenceLines: ['You saved the one least able to save themselves.', 'The human crisis is resolved; the fire moves on.', 'You lost a valuable item and gained an ally.'],
      effects: { consumeOneOf: [['silver_toll_seal', 'bandit_route_ledger', 'provision']], removeStatuses: ['distrusted'], memoryPatch: { fire: 'redirected' }, addThreads: [{ id: 'roadside_fire', urgency: 'dormant', tags: ['bridge'] }], addAllies: ['rescued'] },
    },
    [N.AUTHORITY]: {
      id: 'smoke_authority', action: 'Organize a bucket line and evacuation order.',
      baseNarrative: ['You take command of the chaos — a line here, an order of evacuation there — and turn a panicking crowd into a working brigade.', 'How much you can save depends on whether the road already recognizes your right to command it.'],
      consequenceLines: ['You organized the fire response.', 'Legitimacy decided how much you saved.', 'The road remembers how you led here.'],
      effects: { setStrain: 'spent', memoryPatch: { fire: 'resolved' }, resolveThreads: ['roadside_fire'] },
      interventions: [
        { id: 'smoke_authority_legit', priority: 90, when: ({ run }) => ['keeper', 'commissioned', 'refuge'].includes(run.memories?.roadOutcome), replaceNarrative: ['The road already knows you as its keeper, and the brigade moves as one under that authority.', 'You save the people and the bridge both, and the refuge holds.'], consequenceLines: ['Your road authority saved people and bridge alike.', 'The fire is resolved; the tollhouse holds.', 'Your standing as Keeper is strengthened.'], effects: { memoryPatch: { tollhouse: 'refuge' }, resolveThreads: ['roadkeeper_obligation'] } },
        { id: 'smoke_authority_false', priority: 95, when: ({ run }) => run.memories?.falseIdentity != null || run.memories?.ironGate?.claim === 'deceived', addNarrative: ['The tollhouse ledger catches your false claim mid-crisis; you keep the crowd only by admitting, publicly, who you really are.'], effects: { addStatuses: ['distrusted'], memoryPatch: { falseIdentity: null }, resolveThreads: ['false_identity'] } },
      ],
    },
    [N.MYSTERY]: {
      id: 'smoke_mystery', action: 'Contact the dead walking inside the smoke.',
      baseNarrative: ['The fire has woken everyone who ever died at this tollhouse, and they are moving through the smoke with purpose.', 'You reach out to them.'],
      consequenceLines: [], effects: {},
      choices: [
        { id: 'carry', label: 'Carry the dead', description: 'Let the dead guide the living out through you.',
          narrative: ['You let the dead work through you, and they lead every living soul out by ways only they remember.', 'Beneath the tollhouse, they show you a hidden chamber before they let you go — mostly.'],
          consequenceLines: ['The dead guided everyone out through you.', 'The fire’s human cost is resolved; a hidden chamber is revealed.', 'The contact left you Haunted.'],
          effects: { addStatuses: ['haunted'], memoryPatch: { fire: 'resolved' }, resolveThreads: ['roadside_fire'], addThreads: [{ id: 'trapmaker_truth', urgency: 'dormant', tags: ['chamber'] }] },
          terminalTriggers: [{ id: 'smoke_mystery_possession', when: ({ run }) => run.statuses.includes('deeply_haunted'), warningStatus: 'deeply_haunted', endingId: 'ending_possession', narrative: 'You were already Deeply Haunted, and a whole tollhouse of the dead is too many to only borrow. They walk out wearing you.' }] },
        { id: 'bind', label: 'Bind them into light', description: 'Requires a Roadkeeper’s Lamp or Gravekeeper’s Candle.',
          available: ({ run }) => run.items.includes('roadkeepers_lamp') || run.items.includes('gravekeepers_candle'),
          narrative: ['You draw the tollhouse dead into the lamp before they can reach you, and by their cold light lead everyone out.', 'The bound lamp can call road spirits when you need them most.'],
          consequenceLines: ['You bound the dead into the light and saved everyone.', 'You did not become Haunted.', 'The Bound Lamp can call road spirits at the finale.'],
          effects: { memoryPatch: { fire: 'resolved' }, resolveThreads: ['roadside_fire'], addThreads: [{ id: 'trapmaker_truth', urgency: 'dormant', tags: ['bound-lamp'] }] } },
        { id: 'settle', label: 'Settle the dead', description: 'Requires a Road Token or favorable road witnesses.',
          available: ({ run }) => run.items.includes('road_token') || run.witnesses.length > 0,
          narrative: ['You show the dead that the road remembers the living now, and they accept it and let go.', 'They release into blessing — but with no one to guide the flames, the tollhouse still burns.'],
          consequenceLines: ['You settled the dead and gained a Blessing.', 'The people are led out by the living.', 'The tollhouse burns; the fire moves on.'],
          effects: { addStatuses: ['blessed'], memoryPatch: { fire: 'redirected', tollhouse: 'destroyed' }, addThreads: [{ id: 'roadside_fire', urgency: 'dormant', tags: ['bridge'] }] } },
      ],
    },
    [N.DECEPTION]: {
      id: 'smoke_deception', action: 'Ring the bell and send the factions out the safe rear exit.',
      baseNarrative: ['You ring the warning bell and shout that the bridge has already fallen, and the trapped factions flee out the rear rather than fight over a road that is suddenly worthless.', 'Everyone who can move gets out. The fire, redirected, will trouble somewhere else later.'],
      consequenceLines: ['You emptied the tollhouse with a false alarm.', 'The fire is redirected to an abandoned stretch of road.', 'You recovered your belonging if its carrier fled.'],
      effects: { memoryPatch: { fire: 'redirected', stolenBelonging: null }, resolveThreads: ['roadside_fire', 'stolen_belonging'], addThreads: [{ id: 'roadside_fire', urgency: 'dormant', tags: ['elsewhere'] }] },
    },
    [N.INVESTIGATION]: {
      id: 'smoke_investigation', action: 'Collapse an empty storage shed into the ditch to stop the fire.',
      baseNarrative: ['You read the wind and the roof pitch and find the answer in an empty storage shed: drop it into the dry ditch and the fire has nowhere left to go.', 'It works, and it costs whatever was stored in that shed. If your belonging was in there, it is gone with it.'],
      consequenceLines: ['You broke the fire’s path with a precise collapse.', 'The fire is resolved; the bridge stands.', 'The stored goods — and any belonging with them — are lost.'],
      effects: { memoryPatch: { fire: 'resolved' }, resolveThreads: ['roadside_fire'], advanceUrgent: true },
      interventions: [{ id: 'smoke_investigation_belonging', priority: 90, when: ({ run }) => run.memories?.stolenBelonging != null, addNarrative: ['Your stolen belonging was among the stored goods; it burns with the shed.'], effects: { memoryPatch: { stolenBelonging: null }, resolveThreads: ['stolen_belonging'] } }],
    },
    [N.TRANSFORMATION]: {
      id: 'smoke_transformation', action: 'Redirect the tollhouse water mechanism through the fire.',
      baseNarrative: ['You release the old toll counterweight and turn its water channel through the burning structure, making a fire-suppression system out of a machine built to take money.', 'Most of the tollhouse survives, changed. The old toll authority does not.'],
      consequenceLines: ['You turned the toll machine against the fire.', 'The fire is resolved; the tollhouse is Reworked.', 'The old toll authority is permanently disabled.'],
      effects: { memoryPatch: { fire: 'resolved', tollhouse: 'reworked', roadOutcome: 'reworked' }, resolveThreads: ['roadside_fire', 'roadkeeper_obligation'] },
    },
    [N.CREATION]: {
      id: 'smoke_creation', action: 'Build a firebreak and wet-cloth shield around the bridge.',
      baseNarrative: ['You cut a firebreak and rig a wet-cloth shield around the bridge, and give the fire a line it cannot cross.', 'The bridge is saved and the break remains — good ground for a refuge, or a last stand.'],
      consequenceLines: ['You built a firebreak that held the bridge.', 'The fire is resolved; a firebreak remains.', 'It may anchor a later refuge or defense.'],
      effects: { consumeOneOf: [['timber', 'cloth']], memoryPatch: { fire: 'resolved', tollhouse: 'firebreak' }, resolveThreads: ['roadside_fire'] },
      interventions: [{ id: 'smoke_creation_nomat', priority: 40, when: ({ run }) => !run.materials.includes('timber') && !run.materials.includes('cloth'), replaceNarrative: ['With no material to build a break, you can only wet down one side of the road and choose which half to save.', 'You save the bridge and lose the tollhouse.'], consequenceLines: ['With nothing to build from, you saved only the bridge.', 'The fire is resolved on one side.', 'The tollhouse is lost.'], effects: { memoryPatch: { tollhouse: 'destroyed' } } }],
    },
    [N.FORTUNE]: {
      id: 'smoke_fortune', action: 'A floor collapses and reveals the strongbox.',
      baseNarrative: ['A burning section of floor gives way in front of you and drops open onto the tollhouse strongbox, right where you can reach it.', 'You take what is inside — but the same collapse throws the fire somewhere new, toward a group you cannot see and cannot choose.'],
      consequenceLines: ['You took the tollhouse strongbox from the flames.', 'The fire leaves this scene but survives to the finale.', 'You do not control who it reaches next.'],
      effects: { addItems: ['silver_toll_seal'], memoryPatch: { fire: 'redirected' }, resolveThreads: ['roadside_fire'], addThreads: [{ id: 'roadside_fire', urgency: 'dormant', tags: ['finale'] }] },
    },
  },
};

export const BEAST_ON_THE_KINGS_ROAD = {
  id: 'beast_kings_road',
  title: 'The Beast on the King’s Road',
  kind: 'convergence',
  combines: ['beast_loose_or_cursed', 'road/bandit/trap'],
  eligible: run => beastLooseOrCursed(run) && (otherActiveThread(run, ['road_remembers', 'trapmaker_truth', 'roadkeeper_obligation', 'bandits_return']) || (run.memories?.roadTrapEvidence || 0) > 0 || run.memories?.roadOutcome != null),
  description:
    'The beast stands between two milestones, its broken chain wrapped around one stone. Each time it pulls, words appear in the road beneath its feet. If it is cursed, the iron is dragging it toward the Woman in the Well. It has become part of the road’s unfinished purpose.',
  detailPalette: ['a chain caught on a milestone', 'words surfacing in the road', 'the pull toward the well', 'bandits afraid to approach', 'trap-marks matching your evidence'],
  readings: {
    [N.PHYSICAL]: {
      id: 'bkr_physical', action: 'Break the chain free and drag the beast off the marked road.',
      baseNarrative: ['You wrestle the chain off the milestone and haul the beast bodily off the marked stones.', 'The road loses its grip on the animal — but the chain you leave behind was your evidence.'],
      consequenceLines: ['You dragged the beast off the road.', 'The beast is freed; you lost the chain as evidence.', 'The struggle cost you strength.'],
      effects: { advanceStrain: 1, memoryPatch: { beast: { fate: 'freed' } }, resolveThreads: ['cursed_beast'] },
      terminalTriggers: [{ id: 'bkr_physical_wound', when: ({ run }) => run.statuses.includes('wounded'), warningStatus: 'wounded', endingId: 'ending_wounded_physical', narrative: 'You were already Wounded, and the beast and the road pull in opposite directions with you between them. Something in you is what gives.' }],
    },
    [N.AGGRESSION]: {
      id: 'bkr_aggression', action: 'Kill the beast and shatter the milestone.',
      baseNarrative: ['You put the beast down and break the marked milestone over it, ending both the animal and one of the road’s markers.', 'The beast will not reach the finale now. Neither will the truth carved in that stone.'],
      consequenceLines: ['You killed the beast and broke the milestone.', 'The beast finale threat is gone; one evidence source is destroyed.', 'The road turns toward Broken.'],
      effects: { memoryPatch: { beast: { fate: 'killed' }, roadOutcome: 'broken' }, resolveThreads: ['cursed_beast'], addWitnesses: ['fearful_witness'] },
      interventions: [{ id: 'bkr_aggression_bandits', priority: 70, when: ({ run }) => run.memories?.bandits && run.memories.bandits.state !== 'active', addNarrative: ['The watching bandits see it done and want no part of you after.'], effects: { memoryPatch: { bandits: { relation: 'fearful' } } } }],
    },
    [N.PROTECTION]: {
      id: 'bkr_protection', action: 'Anchor the chain and stand between the beast and everyone else.',
      baseNarrative: ['You anchor the chain and put yourself between the straining beast and everyone the road is drawing toward it.', 'You hold long enough for the others to withdraw. The beast is contained, not freed, and now it is yours to answer for.'],
      consequenceLines: ['You shielded everyone from the beast.', 'The beast is contained; you are its guardian.', 'It will reach the finale unless the road is settled first.'],
      effects: { setStrain: 'spent', memoryPatch: { beast: { fate: 'contained' } }, addThreads: [{ id: 'guardian_of_cursed_beast', urgency: 'active', tags: ['finale'] }] },
    },
    [N.ENDURANCE]: {
      id: 'bkr_endurance', action: 'Wait through the milestone’s full cycle until dawn.',
      baseNarrative: ['You wait out the whole cycle of the stones, watching the words rise and fade through the night, until at dawn the road simply lets the chain go.', 'You learn something the road did not mean to teach: its hold weakens with the light.'],
      consequenceLines: ['You waited the road’s cycle out to dawn.', 'The beast is freed; the evidence is preserved.', 'You learned the road weakens at dawn.'],
      effects: { advanceStrain: 1, memoryPatch: { beast: { fate: 'freed' } }, resolveThreads: ['cursed_beast'], roadTrapEvidenceInc: 1 },
      terminalTriggers: [{ id: 'bkr_endurance_collapse', when: ({ run }) => run.strain === 'exhausted', warningStatus: 'strain:exhausted', endingId: 'ending_exhausted_exertion', narrative: 'You were already Exhausted, and the milestones keep their own slow time. Dawn comes for the beast, but you are not there to see it.' }],
    },
    [N.COMPASSION]: {
      id: 'bkr_compassion', action: 'Approach through remembered trust.',
      baseNarrative: ['You approach the animal, not the road, and it lets you near because of how you treated it before.', 'What that trust is worth depends on what you did the last time you had the chance.'],
      consequenceLines: ['You reached the beast through old trust.', 'Its response matched your past kindness.', 'The road’s pull met that trust head-on.'],
      effects: { memoryPatch: { beast: { fate: 'freed' } }, resolveThreads: ['cursed_beast'], consumeOneOf: [['provision', 'timber', 'cloth']] },
      interventions: [{ id: 'bkr_compassion_helped', priority: 90, when: ({ run }) => ['helped', 'companion', 'freed'].includes(run.memories?.beast?.responsibility) || run.memories?.beast?.fate === 'companion', replaceNarrative: ['It remembers your hands from the trap, and it chooses you over the road’s pull.', 'It rises and stays. You call it Greyfang.'], consequenceLines: ['The beast chose you over the road.', 'It became your companion, Greyfang.', 'Trust broke the road’s hold.'], effects: { addCompanions: ['greyfang'], memoryPatch: { beast: { fate: 'companion' } }, consumeOneOf: [] } }],
    },
    [N.AUTHORITY]: {
      id: 'bkr_authority', action: 'Command the road to release an unlawful claim.',
      baseNarrative: ['You address the road itself and command it to release a claim it never had the right to make.', 'Whether it obeys depends entirely on whether your own authority is real.'],
      consequenceLines: ['You ordered the road to release the beast.', 'Legitimacy decided whether it obeyed.', 'A false claim only tightened the chain.'],
      effects: { memoryPatch: { beast: { fate: 'freed' } }, resolveThreads: ['cursed_beast'], roadTrapEvidenceInc: 1 },
      interventions: [{ id: 'bkr_authority_false', priority: 95, when: ({ run }) => ['contested', 'unrecorded', 'outlaw'].includes(run.memories?.roadOutcome) || run.memories?.falseIdentity != null, replaceNarrative: ['Your authority here is borrowed or false, and the road knows it. The chain tightens instead of loosening.', 'You must surrender the claim or find another way.'], consequenceLines: ['The road rejected your false authority.', 'The chain tightened; the beast is not freed.', 'You gained Distrusted from the watchers.'], effects: { addStatuses: ['distrusted'], memoryPatch: { beast: { fate: 'cursed' } }, resolveThreads: [], addThreads: [{ id: 'cursed_beast', urgency: 'active', tags: ['tightened'] }] } }],
    },
    [N.MYSTERY]: {
      id: 'bkr_mystery', action: 'Let road, presence, and animal fear speak together.',
      baseNarrative: ['You touch the milestone and let all three voices — the road, the trapped presence, and the animal’s fear — speak at once.', 'They tell the same story from three sides.'],
      consequenceLines: [], effects: {},
      choices: [
        { id: 'carry', label: 'Carry the road’s command', description: 'Take the road’s voice into yourself and free the beast.',
          narrative: ['You take the road’s command into yourself, and learn the worst of it: the traps were built to keep living things away from the well.', 'The beast comes free of a road that no longer speaks through it.'],
          consequenceLines: ['You carried the road’s command and freed the beast.', 'You learned the traps guard the well against the living.', 'The contact deepened your haunting.'],
          effects: { addStatuses: ['haunted'], memoryPatch: { beast: { fate: 'freed' } }, resolveThreads: ['cursed_beast'], roadTrapEvidenceInc: 1, addThreads: [{ id: 'trapmaker_truth', urgency: 'active', tags: ['well'] }] },
          terminalTriggers: [{ id: 'bkr_mystery_possession', when: ({ run }) => run.statuses.includes('deeply_haunted'), warningStatus: 'deeply_haunted', endingId: 'ending_possession', narrative: 'You were already Deeply Haunted, and the road is the oldest voice yet. It does not pass through you — it moves in, and points you at the well.' }] },
        { id: 'bind', label: 'Bind the command', description: 'Requires a Gatekeeper’s Ring, Bound Trap Presence, or Roadkeeper’s Lamp.',
          available: ({ run }) => ['gatekeepers_ring', 'bound_gatekeepers_ring', 'bound_trap_presence', 'roadkeepers_lamp'].some(id => run.items.includes(id)),
          narrative: ['You bind the road’s command into the vessel you carry, and free the beast without letting the road reach your mind.', 'That vessel can shut down one of the road’s workings at the finale.'],
          consequenceLines: ['You bound the road’s command into a vessel.', 'The beast is freed; you did not deepen your haunting.', 'The vessel can disable one finale binding.'],
          effects: { memoryPatch: { beast: { fate: 'freed' } }, resolveThreads: ['cursed_beast'], addThreads: [{ id: 'trapmaker_truth', urgency: 'active', tags: ['bound-command'] }] } },
        { id: 'exchange', label: 'Exchange for Roadbound', description: 'Requires an existing haunting to transform.',
          available: ({ run }) => run.statuses.includes('haunted') || run.statuses.includes('deeply_haunted'),
          narrative: ['You let the road’s command take the place of the presence already riding you, and become Roadbound.', 'You gain authority over the road’s traps — and lose your footing anywhere the road does not run.'],
          consequenceLines: ['You became Roadbound, trading one haunting for another.', 'You hold authority over road-traps.', 'You are vulnerable away from the road.'],
          effects: { memoryPatch: { beast: { fate: 'freed' } }, resolveThreads: ['cursed_beast'], addThreads: [{ id: 'trapmaker_truth', urgency: 'active', tags: ['roadbound'] }] } },
      ],
    },
    [N.DECEPTION]: {
      id: 'bkr_deception', action: 'Reassign the chain to a dead official.',
      baseNarrative: ['You alter the trapmaker’s mark on the chain so the road reads it as the property of a dead official, not the beast.', 'The road redirects its claim onto a name that cannot suffer for it — unless that name is one you have been using.'],
      consequenceLines: ['You reassigned the road’s claim to a dead name.', 'The beast is freed; the evidence is preserved.', 'The danger may return if you wore that name too.'],
      effects: { memoryPatch: { beast: { fate: 'freed' }, falseIdentity: 'dead_officer' }, resolveThreads: ['cursed_beast'], addThreads: [{ id: 'false_identity', urgency: 'active', tags: ['road-claim'] }], roadTrapEvidenceInc: 1 },
    },
    [N.INVESTIGATION]: {
      id: 'bkr_investigation', action: 'Compare the chain, milestone, and ledger evidence.',
      baseNarrative: ['You lay the chain against the milestone against everything you have gathered, and the truth resolves: the trap was never meant to hold the beast, but to make it drag the road’s mark out into the wild.', 'Two separate mysteries become one cause.'],
      consequenceLines: ['You proved the traps spread the road’s influence.', 'The beast is freed; your Road-Trap Evidence is complete.', 'The time you spent let a pursuit gain ground.'],
      effects: { memoryPatch: { beast: { fate: 'freed' } }, resolveThreads: ['cursed_beast', 'trapmaker_truth'], roadTrapEvidenceInc: 2, advanceUrgent: true },
    },
    [N.TRANSFORMATION]: {
      id: 'bkr_transformation', action: 'Reshape the marked links into a key for the milestone.',
      baseNarrative: ['You reforge the chain’s marked links into a key that fits the milestone itself, and turn it.', 'The road’s claim over every trap that carries the same mark breaks at once.'],
      consequenceLines: ['You made a key from the road’s own chain.', 'The beast is freed; all matching road-traps are disabled.', 'You gained the Road-Trap Key.'],
      effects: { consumeOneOf: [['worked_iron', 'trapmakers_key_fragment']], addItems: ['road_trap_key'], memoryPatch: { beast: { fate: 'freed' } }, resolveThreads: ['cursed_beast', 'trapmaker_truth'] },
    },
    [N.CREATION]: {
      id: 'bkr_creation', action: 'Build an insulated frame and lift the chain without touching the stone.',
      baseNarrative: ['You build an insulated wooden frame around the milestone and lift the chain clear without any part of it — or you — touching the marked stone.', 'The beast walks free, the evidence is intact, and you have left a safe marker for whoever comes next.'],
      consequenceLines: ['You freed the beast without touching the road.', 'The evidence is preserved; a safe marker remains.', 'You avoided any supernatural contact.'],
      effects: { consumeMaterials: ['timber', 'cloth'], memoryPatch: { beast: { fate: 'freed' } }, resolveThreads: ['cursed_beast'] },
    },
    [N.FORTUNE]: {
      id: 'bkr_fortune', action: 'The beast pulls once more and the milestone splits open.',
      baseNarrative: ['The beast throws its weight against the chain one last time and the marked milestone cracks open, spilling a black token stamped with the distance to the Woman in the Well.', 'You take the shortcut it offers. The beast, freed, chooses its own road now.'],
      consequenceLines: ['You took the Black Mile Token and a shortcut to the finale.', 'The beast is loose and chooses its own part.', 'What it does at the end depends on how you treated it.'],
      effects: { addItems: ['black_mile_token'], memoryPatch: { beast: { fate: 'loose' } }, resolveThreads: ['cursed_beast'], addThreads: [{ id: 'cursed_beast', urgency: 'dormant', tags: ['finale-choice'] }] },
    },
  },
};

export const A_NAME_IN_ANOTHER_HAND = {
  id: 'name_another_hand',
  title: 'A Name in Another Hand',
  kind: 'convergence',
  combines: ['stolen_belonging/false_identity', 'unknown_faction'],
  eligible: belongingLost,
  description:
    'At a crowded inn, someone is using your name and carrying the belonging you lost. They have bought food and trust with stories of deeds you actually did. A notice by the door accuses that name of a crime committed further down the road. You must decide what your name is worth.',
  detailPalette: ['an impostor wearing your name', 'your lost belonging on display', 'a notice accusing your name', 'a crowded, watching inn', 'stories of your real deeds'],
  readings: {
    [N.PHYSICAL]: {
      id: 'nah_physical', action: 'Follow the impostor to the stable and seize the belonging.',
      baseNarrative: ['You follow them out to the stable yard and take back what is yours by hand, in front of whoever is watching.', 'You have the belonging and you have exposed the impostor — but force does not put your name back the way it was.'],
      consequenceLines: ['You seized your belonging in the yard.', 'The impostor is exposed; you recovered the item.', 'The reputation is not repaired by force.'],
      effects: { advanceStrain: 1, memoryPatch: { stolenBelonging: null, impostor: 'exposed' }, resolveThreads: ['stolen_belonging', 'impostor_drawing_pursuit'] },
      interventions: [{ id: 'nah_physical_distrust', priority: 50, when: status('distrusted'), addNarrative: ['With your reputation already what it is, the inn treats both of you as dangerous, and remembers your face for it.'], effects: { addWitnesses: ['wary_inn'] } }],
    },
    [N.AGGRESSION]: {
      id: 'nah_aggression', action: 'Challenge the impostor publicly until one claimant yields.',
      baseNarrative: ['You call them out in the middle of the room and refuse to leave until one of you is proven the liar.', 'You get your name and your belonging back through sheer will. Whether the impostor dies or yields decides how their faction answers.'],
      consequenceLines: ['You won your name back publicly.', 'You recovered the belonging; the false identity ends.', 'You gained a Fearful reputation.'],
      effects: { memoryPatch: { stolenBelonging: null, falseIdentity: null, impostor: 'yielded' }, resolveThreads: ['stolen_belonging', 'false_identity', 'impostor_drawing_pursuit'], addWitnesses: ['fearful_witness'] },
    },
    [N.PROTECTION]: {
      id: 'nah_protection', action: 'Accept blame long enough to prevent another’s arrest.',
      baseNarrative: ['Someone else is about to be taken for the crime your name is accused of. You step in and accept the blame long enough to get them clear.', 'They go free; you lose the belonging as evidence and gain the suspicion of the whole region. The impostor slips away in the confusion.'],
      consequenceLines: ['You took the blame to save a stranger.', 'You gained a favorable witness — and local Distrust.', 'You lost the belonging; the impostor escaped.'],
      effects: { addStatuses: ['distrusted'], memoryPatch: { stolenBelonging: null }, resolveThreads: ['stolen_belonging'], addAllies: ['grateful_stranger'], addWitnesses: ['grateful_stranger'] },
    },
    [N.ENDURANCE]: {
      id: 'nah_endurance', action: 'Follow for a full day and trace the identity network.',
      baseNarrative: ['You do not confront them. You follow, for a whole day, and let the stolen name lead you back through every hand it passed — the merchant, the courier, the one who added the accusation.', 'By nightfall you understand who is really spreading your name, and can take your belonging back later, quietly.'],
      consequenceLines: ['You traced the whole identity network.', 'You revealed a finale enemy or hidden patron.', 'You will recover the belonging later, without a scene.'],
      effects: { advanceStrain: 1, memoryPatch: { stolenBelonging: null }, resolveThreads: ['stolen_belonging', 'impostor_drawing_pursuit'], addThreads: [{ id: 'false_identity', urgency: 'dormant', tags: ['network'] }] },
      terminalTriggers: [{ id: 'nah_endurance_collapse', when: ({ run }) => run.strain === 'exhausted', warningStatus: 'strain:exhausted', endingId: 'ending_exhausted_exertion', narrative: 'You were already Exhausted, and a full day of shadowing on no strength is a day too many. You lose them, and then you lose the road, and then you lose the light.' }],
    },
    [N.COMPASSION]: {
      id: 'nah_compassion', action: 'Offer the impostor another route to safety.',
      baseNarrative: ['The impostor admits your name was the only thing that ever bought them food and a door that locked. You offer them a way out that does not require being you.', 'They take it, and give the belonging back — or you let them keep it. Either way, you own their next step now.'],
      consequenceLines: ['You turned the impostor into an ally.', 'You recovered or gave up the belonging by choice.', 'You accepted responsibility for where they go next.'],
      effects: { consumeOneOf: [['provision', 'road_token']], memoryPatch: { stolenBelonging: null, impostor: 'ally' }, resolveThreads: ['stolen_belonging', 'impostor_drawing_pursuit'], addAllies: ['reformed_impostor'] },
    },
    [N.AUTHORITY]: {
      id: 'nah_authority', action: 'Prove your identity through symbols and witnesses.',
      baseNarrative: ['You lay out the proofs of who you are — ring, token, insignia, a witness who was there — and let the room judge between you.', 'If your legitimacy is real, the name comes back to you cleanly. If it is thin, the hearing turns on you instead.'],
      consequenceLines: ['You submitted your identity to judgment.', 'Real legitimacy would clear your name and recover the item.', 'A weak claim risks the authorities holding it.'],
      effects: { memoryPatch: { stolenBelonging: null }, resolveThreads: ['stolen_belonging'] },
      interventions: [
        { id: 'nah_authority_legit', priority: 90, when: ({ run }) => run.items.includes('gatekeepers_ring') || run.items.includes('road_token') || run.items.includes('soldiers_insignia') || run.witnesses.length > 0, replaceNarrative: ['Your ring, your witnesses, and your bearing settle it before the impostor can invent a rebuttal.', 'The room turns on them, and your name is cleared across the whole region.'], consequenceLines: ['Your legitimacy cleared your name regionally.', 'You recovered the belonging; the impostor is exposed.', 'You gained a public witness.'], effects: { removeStatuses: ['distrusted'], memoryPatch: { falseIdentity: null, impostor: 'exposed' }, resolveThreads: ['false_identity'], addWitnesses: ['public_witness'] } },
        { id: 'nah_authority_weak', priority: 80, when: ({ run }) => !run.items.includes('gatekeepers_ring') && !run.items.includes('road_token') && !run.items.includes('soldiers_insignia') && run.witnesses.length === 0, replaceNarrative: ['You have nothing solid to show, and the hearing finds the holes in your story instead of the impostor’s.', 'The authorities keep the belonging until the matter is "resolved," and your standing sinks.'], consequenceLines: ['Your thin claim collapsed under scrutiny.', 'You became Contested; the authorities hold the belonging.', 'The impostor walks.'], effects: { addStatuses: ['distrusted'], memoryPatch: { roadOutcome: 'contested', stolenBelonging: null }, resolveThreads: [] } },
      ],
    },
    [N.MYSTERY]: {
      id: 'nah_mystery', action: 'Read the trace the object retained.',
      baseNarrative: ['You take up the belonging and speak through the memory it kept, and the room hears, in fragments, every hand it passed through.', 'The truth is in the object; the only question is what it costs you to use it.'],
      consequenceLines: [], effects: {},
      choices: [
        { id: 'carry', label: 'Carry the trace', description: 'Let the object speak the possession chain through you.',
          narrative: ['You let the object speak through you, and the whole chain of theft plays out for the crowd to hear.', 'Your name is cleared by the dead air of the thing — and the cold that carried it stays with you.'],
          consequenceLines: ['The object exposed the whole chain through you.', 'You recovered the belonging.', 'The contact left you Haunted.'],
          effects: { addStatuses: ['haunted'], memoryPatch: { stolenBelonging: null, falseIdentity: null }, resolveThreads: ['stolen_belonging', 'false_identity'] },
          terminalTriggers: [{ id: 'nah_mystery_possession', when: ({ run }) => run.statuses.includes('deeply_haunted'), warningStatus: 'deeply_haunted', endingId: 'ending_possession', narrative: 'You were already Deeply Haunted. The object has held many hands, and one more voice in a crowded head is one too many. It keeps the name, and you.' }] },
        { id: 'bind', label: 'Bind it into a Witness Object', description: 'Seal the object’s memory into itself for the finale.',
          narrative: ['You bind the object’s accumulated memory into itself, making it a Witness that will speak once more when it matters.', 'You keep your name and your calm both.'],
          consequenceLines: ['You made the belonging a Witness Object.', 'You recovered it; you did not become Haunted.', 'It will testify once at the finale.'],
          effects: { addItems: ['witness_object'], memoryPatch: { stolenBelonging: null }, resolveThreads: ['stolen_belonging'] } },
        { id: 'settle', label: 'Settle the truth', description: 'Requires the original carrier or a favorable witness.',
          available: ({ run }) => run.allies.length > 0 || run.witnesses.length > 0,
          narrative: ['With someone present who knows the true story, you reconstruct it plainly and let the trace disperse.', 'The false identity dies with the retelling, and nothing clings to you.'],
          consequenceLines: ['You settled the truth with a witness.', 'The false identity is cleared; the trace is gone.', 'You recovered the belonging cleanly.'],
          effects: { memoryPatch: { stolenBelonging: null, falseIdentity: null }, resolveThreads: ['stolen_belonging', 'false_identity'] } },
      ],
    },
    [N.DECEPTION]: {
      id: 'nah_deception', action: 'Let the impostor keep the name and mark the duplicate.',
      baseNarrative: ['You let them go on being you, and quietly swap the belonging for a marked duplicate — then let the false name draw your enemies to someone who is not you.', 'You lose the original for now, but you learn exactly who comes running when your name is called.'],
      consequenceLines: ['You turned the stolen name into a decoy.', 'Your pursuers are drawn to the impostor.', 'You lost the original belonging for now.'],
      effects: { removeStatuses: ['hunted'], memoryPatch: { impostor: 'decoy' }, resolveThreads: ['pursuers_close'], addThreads: [{ id: 'impostor_drawing_pursuit', urgency: 'active', tags: ['decoy'] }] },
    },
    [N.INVESTIGATION]: {
      id: 'nah_investigation', action: 'Trace the transactions and records.',
      baseNarrative: ['You work the paper trail — the innkeeper’s book, the merchant’s receipts, the courier’s log — until the record itself names who bought your story and who added the crime to it.', 'You recover the belonging and the whole source of the false reputation with it.'],
      consequenceLines: ['You exposed the source of the false name in the records.', 'You recovered the belonging; you gained finale evidence.', 'The time you spent let an urgent danger advance.'],
      effects: { memoryPatch: { stolenBelonging: null, falseIdentity: null }, resolveThreads: ['stolen_belonging', 'false_identity'], addItems: ['ledger_page'], advanceUrgent: true },
    },
    [N.TRANSFORMATION]: {
      id: 'nah_transformation', action: 'Alter the belonging so it can no longer prove identity.',
      baseNarrative: ['You take the belonging back and change what it is — a signet into a key, a blade into a tool, a cloak into a banner — so it can never again prove anyone is you.', 'The impostor keeps the rumor but loses the proof, and the false identity thins into mere story.'],
      consequenceLines: ['You transformed the belonging past all proof.', 'You recovered it in a new form; identification ends.', 'The false identity becomes rumor, not evidence.'],
      effects: { memoryPatch: { stolenBelonging: null, falseIdentity: null }, resolveThreads: ['stolen_belonging', 'false_identity'] },
    },
    [N.CREATION]: {
      id: 'nah_creation', action: 'Create a second convincing version of the object.',
      baseNarrative: ['You build a second object as convincing as the first, so that both claimants hold apparent proof and the authorities must judge the stories instead of the things.', 'You recover the original and keep the duplicate as bait.'],
      consequenceLines: ['You forged a rival proof and forced a real inquiry.', 'You recovered the original; a duplicate remains as bait.', 'Your public reputation stays unsettled.'],
      effects: { consumeOneOf: [['worked_iron', 'cloth', 'timber']], memoryPatch: { stolenBelonging: null }, resolveThreads: ['stolen_belonging'], addItems: ['witness_object'] },
    },
    [N.FORTUNE]: {
      id: 'nah_fortune', action: 'The impostor opens the belonging before the crowd.',
      baseNarrative: ['The impostor unwraps the belonging in front of the whole room to prove their claim — and finds, sewn beneath the lining, something neither of you knew was there: a letter, a key, a name.', 'You gain the secret. Which of you the crowd believes afterward is out of your hands.'],
      consequenceLines: ['A hidden secret spilled from the belonging.', 'You gained a rare finale-linked item and a new truth.', 'The crowd will choose a claimant on its own.'],
      effects: { addItems: ['witness_object'], memoryPatch: { stolenBelonging: null }, resolveThreads: ['stolen_belonging'], addThreads: [{ id: 'false_identity', urgency: 'dormant', tags: ['crowd-choice'] }] },
    },
  },
};

export const PILOT_CONVERGENCE_EVENTS = [SMOKE_AT_THE_TOLLHOUSE, BEAST_ON_THE_KINGS_ROAD, A_NAME_IN_ANOTHER_HAND];
