// Pilot CORE events — The Iron Gate, Ambush, Cornered Beast.
//
// Every event provides a direct reading for all twelve ACTION_NODES. A reading
// is CARD-FIRST: the trait the player chose is the reading that resolves. There
// are no potencies, requirements, distances, or success tiers here — only an
// authored action, its causal result, world-state changes, and the threads a
// later event will consume.

import { ACTION_NODES } from '../nodes.mjs';

const N = ACTION_NODES;

// Small predicate helpers keep intervention `when` clauses readable.
const has = id => ({ run }) => run.items.includes(id) || run.companions.includes(id);
const status = id => ({ run }) => run.statuses.includes(id);
const material = id => ({ run }) => run.materials.includes(id);

export const IRON_GATE = {
  id: 'iron_gate',
  title: 'The Iron Gate',
  kind: 'core',
  description:
    'The king’s road ends at a black iron gate between two crumbling pillars. Strange words band the lock three times over. One hinge has split the stone; a drainage channel slips beneath the wall. Beyond the bars, two travelers wait — one has crushed a hand trying to climb, and neither will try again.',
  detailPalette: [
    'rusted lower hinge',
    'cracked upper pillar',
    'unstable wall',
    'repeating inscription',
    'wind with a word-like rhythm',
    'drainage channel',
    'hidden counterweight',
    'old road crest',
    'two stranded travelers',
    'an injured hand',
    'danger behind you',
  ],
  readings: {
    [N.PHYSICAL]: {
      id: 'iron_gate_physical',
      action: 'Climb the intact buttress and cross the wall.',
      baseNarrative: [
        'You find the one buttress the wall has not surrendered and haul yourself up its face.',
        'You drop to the far side and the road opens ahead — but the stranded pair cannot follow, and the drainage channel is buried under the stone you loosened.',
      ],
      consequenceLines: [
        'You crossed the wall alone.',
        'The gate is bypassed; the travelers are left behind.',
        'The buried channel can no longer be used by anyone.',
      ],
      effects: {
        advanceStrain: 1,
        memoryPatch: { ironGate: { state: 'bypassed', travelers: 'abandoned' } },
      },
      interventions: [
        {
          id: 'iron_gate_physical_greyfang',
          priority: 70,
          when: has('greyfang'),
          mitigatesTerminal: 'iron_gate_physical_fall',
          replaceNarrative: [
            'Your grip fails on the old wound, but Greyfang scrambles the loose scree ahead of you and wedges a paw where your hand should be.',
            'You follow the line the animal opens and reach the top before the injury can pull you down.',
          ],
        },
        {
          id: 'iron_gate_physical_prepared',
          priority: 60,
          when: status('prepared'),
          mitigatesTerminal: 'iron_gate_physical_fall',
          addNarrative: ['The line you rigged earlier takes your weight when the wound does not.'],
          effects: { removeStatuses: ['prepared'] },
        },
      ],
      terminalTriggers: [
        {
          id: 'iron_gate_physical_fall',
          when: ({ run }) => run.statuses.includes('wounded'),
          warningStatus: 'wounded',
          endingId: 'ending_wounded_physical',
          narrative:
            'Halfway up the buttress your injured side gives out. There is nothing to catch you, and the wall keeps what falls.',
        },
      ],
    },

    [N.AGGRESSION]: {
      id: 'iron_gate_aggression',
      action: 'Destroy the split hinge until the gate crashes inward.',
      baseNarrative: [
        'You batter the fractured hinge until the whole gate tears free of the stone and crashes inward.',
        'The noise rolls a long way down the road. The travelers can cross now — but so can anything following that sound.',
      ],
      consequenceLines: [
        'You broke the gate open.',
        'Everyone can cross — including your pursuers.',
        'The old road will remember who broke its authority.',
      ],
      effects: {
        addItems: ['broken_chain'],
        memoryPatch: { ironGate: { state: 'destroyed', travelers: 'helped' } },
        addThreads: [{ id: 'road_remembers', urgency: 'active', tags: ['gate', 'destroyed'] }],
      },
      interventions: [
        {
          id: 'iron_gate_aggression_hunted',
          priority: 90,
          when: status('hunted'),
          addNarrative: ['The same noise that frees the travelers carries straight back to the ones hunting you.'],
          effects: { addThreads: [{ id: 'pursuers_close', urgency: 'urgent', tags: ['noise'] }] },
        },
      ],
    },

    [N.PROTECTION]: {
      id: 'iron_gate_protection',
      action: 'Brace the pillar and escort the stranded travelers through the breach.',
      baseNarrative: [
        'You shoulder the cracked pillar steady and walk the two travelers through the narrow breach one at a time.',
        'The injured one cannot go on alone. Until you can hand them to safety, their pace is your pace.',
      ],
      consequenceLines: [
        'You held the pillar and brought both travelers through.',
        'The gate is stabilized; you gained a Road Token.',
        'The injured traveler is in your care until you can rest.',
      ],
      effects: {
        setStrain: 'spent',
        addItems: ['road_token'],
        memoryPatch: { ironGate: { state: 'stabilized', travelers: 'in_care' } },
        addThreads: [{ id: 'traveler_in_care', urgency: 'active', tags: ['dependent'] }],
        echoChanges: {},
      },
    },

    [N.ENDURANCE]: {
      id: 'iron_gate_endurance',
      action: 'Follow the wall to a forgotten patrol path.',
      baseNarrative: [
        'You turn along the base of the wall and walk, and walk, until the stone gives up a forgotten patrol path.',
        'It costs most of the day and a great deal of your strength, but it takes no supplies and leaves the gate untouched behind you.',
      ],
      consequenceLines: [
        'You walked the long patrol path around the gate.',
        'The gate is bypassed; you found an Old Road Map.',
        'The delay let anything pursuing you gain ground.',
      ],
      effects: {
        advanceStrain: 1,
        addItems: ['old_road_map'],
        memoryPatch: { ironGate: { state: 'bypassed', travelers: 'abandoned' } },
      },
      interventions: [
        {
          id: 'iron_gate_endurance_hunted',
          priority: 90,
          when: status('hunted'),
          addNarrative: ['The extra hours belong to your pursuers as much as to you; their signs are fresher when you rejoin the road.'],
          effects: { addThreads: [{ id: 'pursuers_close', urgency: 'urgent', tags: ['delay'] }] },
        },
      ],
      terminalTriggers: [
        {
          id: 'iron_gate_endurance_collapse',
          when: ({ run }) => run.strain === 'exhausted',
          warningStatus: 'strain:exhausted',
          endingId: 'ending_exhausted_exertion',
          narrative:
            'You were already spent past spending. The patrol path is long, and somewhere on it your body simply stops.',
        },
      ],
    },

    [N.COMPASSION]: {
      id: 'iron_gate_compassion',
      action: 'Treat the injured hand and listen for the old roadkeeper’s verse.',
      baseNarrative: [
        'You bind the crushed hand and sit with the pair until one of them remembers a verse an old roadkeeper used to sing.',
        'Spoken together against the inscription, the lock answers, and the gate simply opens.',
      ],
      consequenceLines: [
        'You healed the traveler and learned the roadkeeper’s verse.',
        'The gate opens; the travelers are grateful witnesses.',
        'The verse is yours to use where the old road still listens.',
      ],
      effects: {
        memoryPatch: { ironGate: { state: 'functional', travelers: 'helped' } },
        addItems: ['roadkeepers_verse'],
        addWitnesses: ['grateful_travelers'],
      },
      interventions: [
        {
          id: 'iron_gate_compassion_salve',
          priority: 30,
          when: has('healing_salve'),
          addNarrative: ['The salve closes the hand cleanly; the traveler will carry no grudge and no limp.'],
          effects: { consumeItems: ['healing_salve'], addWitnesses: ['devoted_traveler'] },
        },
        {
          id: 'iron_gate_compassion_hunted',
          priority: 90,
          when: status('hunted'),
          addNarrative: ['Stopping to help costs you distance you did not have to spare.'],
          effects: { addThreads: [{ id: 'pursuers_close', urgency: 'urgent', tags: ['delay'] }] },
        },
      ],
    },

    [N.AUTHORITY]: {
      id: 'iron_gate_authority',
      action: 'Claim the right of passage beneath the old road crest.',
      baseNarrative: [
        'You stand beneath the worn crest and claim the road’s right of passage as though it were already yours.',
        'The gate opens to the claim — but the travelers watch to see whether the road agrees with you, and so, somewhere, does the road.',
      ],
      consequenceLines: [
        'You claimed passage under the old road crest.',
        'The gate opens; your claim is asserted, not yet proven.',
        'The road will one day ask by what right you crossed.',
      ],
      effects: {
        memoryPatch: { ironGate: { state: 'functional', claim: 'asserted', travelers: 'helped' } },
        addThreads: [{ id: 'road_remembers', urgency: 'active', tags: ['claim', 'asserted'] }],
      },
      interventions: [
        {
          id: 'iron_gate_authority_insignia',
          priority: 70,
          when: has('soldiers_insignia'),
          replaceNarrative: [
            'You show the crest the soldier’s insignia, and the claim stops being a bluff.',
            'The lock reads it as inheritance. A gatekeeper’s ring turns in the mechanism and comes loose into your hand.',
          ],
          consequenceLines: [
            'The insignia made your claim inherited, not asserted.',
            'You gained the Gatekeeper’s Ring and old-road authority.',
            'The road recognizes you as one of its own now.',
          ],
          effects: {
            memoryPatch: { ironGate: { claim: 'inherited' } },
            addItems: ['gatekeepers_ring'],
          },
        },
      ],
    },

    [N.MYSTERY]: {
      id: 'iron_gate_mystery',
      action: 'Listen to the unfinished duty inside the lock.',
      baseNarrative: [
        'You set your ear to the cold lock and listen past the wind to the thing still keeping watch inside it.',
        'It has a duty it never finished, and it notices that you can hear it.',
      ],
      consequenceLines: [],
      effects: {},
      choices: [
        {
          id: 'carry',
          label: 'Carry the gatekeeper',
          description: 'Take the presence and its duty into yourself.',
          narrative: [
            'You let the watcher come with you rather than leave it unanswered.',
            'The gate opens for its own keeper. The ring is yours, and so, now, is the cold at the edge of your thoughts.',
          ],
          consequenceLines: [
            'You carried the gatekeeper out of the lock.',
            'You gained the Gatekeeper’s Ring and became Haunted.',
            'Its unfinished duty travels with you now.',
          ],
          effects: {
            addItems: ['gatekeepers_ring'],
            addStatuses: ['haunted'],
            memoryPatch: { ironGate: { claim: 'inherited', state: 'functional' } },
            addThreads: [{ id: 'gatekeeper_duty', urgency: 'active', tags: ['supernatural'] }],
          },
          terminalTriggers: [
            {
              id: 'iron_gate_mystery_possession',
              when: ({ run }) => run.statuses.includes('deeply_haunted'),
              warningStatus: 'deeply_haunted',
              endingId: 'ending_possession',
              narrative:
                'You were already too full of borrowed voices. When the gatekeeper steps in, there is no longer a place for you to step back to.',
            },
          ],
        },
        {
          id: 'bind',
          label: 'Bind it into a ring',
          description: 'Requires a Gatekeeper’s Ring to hold the presence.',
          available: ({ run }) => run.items.includes('gatekeepers_ring'),
          narrative: [
            'Instead of taking the watcher in, you press it into the ring already on your hand.',
            'The metal goes cold and certain. It will open one old-road mechanism at your word — and loose the keeper unpredictably if it ever leaves you.',
          ],
          consequenceLines: [
            'You bound the gatekeeper into the ring.',
            'The Bound Gatekeeper’s Ring can command one road mechanism.',
            'Breaking or surrendering it would release the presence.',
          ],
          effects: {
            consumeItems: ['gatekeepers_ring'],
            addItems: ['bound_gatekeepers_ring'],
            memoryPatch: { ironGate: { claim: 'bound', state: 'functional' } },
          },
        },
        {
          id: 'settle',
          label: 'Settle the duty',
          description: 'Requires Blessed or a Road Token to answer the duty honestly.',
          available: ({ run }) => run.statuses.includes('blessed') || run.items.includes('road_token'),
          narrative: [
            'You answer the duty instead of taking it — you name the road it kept and tell it the watch is ended.',
            'The presence lets go. The gate swings wide, and the ring left behind is only a ring.',
          ],
          consequenceLines: [
            'You released the gatekeeper honestly.',
            'The gate opens; you gained a plain Gatekeeper’s Ring.',
            'A grateful spirit remembers that you set it down gently.',
          ],
          effects: {
            addItems: ['gatekeepers_ring'],
            memoryPatch: { ironGate: { state: 'functional' } },
            addWitnesses: ['grateful_spirit'],
          },
        },
      ],
    },

    [N.DECEPTION]: {
      id: 'iron_gate_deception',
      action: 'Imitate the call of an approaching road patrol.',
      baseNarrative: [
        'You cup your hands and throw the call of a road patrol down the empty road, sharp and official.',
        'The gate takes the signal and opens briefly, long enough to slip through — but a false patrol has now been recorded here.',
      ],
      consequenceLines: [
        'You tricked the gate with a false patrol call.',
        'The gate opens; your crossing is recorded as a lie.',
        'A later road structure may recognize the false signal.',
      ],
      effects: {
        memoryPatch: { ironGate: { claim: 'deceived', state: 'functional' }, falseIdentity: 'road_patrol' },
        addThreads: [{ id: 'false_identity', urgency: 'active', tags: ['road', 'patrol'] }],
      },
      interventions: [
        {
          id: 'iron_gate_deception_cloak',
          priority: 30,
          when: has('smoke_cloth_cloak'),
          addNarrative: ['Under the smoke-cloth cloak the gate cannot fix your face to the false call.'],
          effects: { memoryPatch: { falseIdentity: null } },
        },
      ],
    },

    [N.INVESTIGATION]: {
      id: 'iron_gate_investigation',
      action: 'Study the writing, drainage, and rust pattern.',
      baseNarrative: [
        'You read the three bands of writing against the rust and the dry channel until the meaning settles: the words describe how water once moved the counterweight.',
        'Clearing the channel would wake the mechanism. It takes long, patient work, and the day burns away while you learn.',
      ],
      consequenceLines: [
        'You understood how the old counterweight works.',
        'The gate stays functional; you gained an Old Road Map.',
        'The time you spent let an urgent danger advance.',
      ],
      effects: {
        memoryPatch: { ironGate: { state: 'functional' } },
        addItems: ['old_road_map'],
        roadTrapEvidenceInc: 1,
        advanceUrgent: true,
      },
    },

    [N.TRANSFORMATION]: {
      id: 'iron_gate_transformation',
      action: 'Reverse the locking plate so pressure holds the gate open.',
      baseNarrative: [
        'You work the locking plate loose and set it back reversed, so the mechanism’s own pressure now holds the gate open instead of shut.',
        'It will never close again. Allies, strangers, and pursuers will all find an open road here.',
      ],
      consequenceLines: [
        'You reversed the lock so the gate stays open forever.',
        'You gained the Reversed Lock Teeth.',
        'The old road has noticed its machine was altered.',
      ],
      effects: {
        memoryPatch: { ironGate: { state: 'rebuilt', travelers: 'helped' } },
        addItems: ['reversed_lock_teeth'],
        addThreads: [{ id: 'road_remembers', urgency: 'active', tags: ['gate', 'altered'] }],
      },
    },

    [N.CREATION]: {
      id: 'iron_gate_creation',
      action: 'Build a scaffold over the strongest section of wall.',
      baseNarrative: [
        'You lash a scaffold up the soundest stretch of wall and walk the travelers over it in turn.',
        'The structure stays behind you, solid enough for the next travelers — and for anyone else who comes this way.',
      ],
      consequenceLines: [
        'You built a scaffold and escorted the travelers across.',
        'The gate is bypassed; a scaffold remains on the road.',
        'You could pull it down from the far side, at a cost of strength.',
      ],
      effects: {
        consumeMaterials: ['timber'],
        memoryPatch: { ironGate: { state: 'bypassed', travelers: 'escorted' } },
      },
      interventions: [
        {
          id: 'iron_gate_creation_no_timber',
          priority: 40,
          when: ({ run }) => !run.materials.includes('timber'),
          replaceNarrative: [
            'You have no timber, so you improvise a crossing from the wall’s own loose stone and your own straining back.',
            'It works, barely, and the effort costs you.',
          ],
          consequenceLines: [
            'With no timber, you forced an improvised crossing.',
            'The gate is bypassed; the travelers are escorted.',
            'The effort left you spent.',
          ],
          effects: { advanceStrain: 1 },
        },
      ],
    },

    [N.FORTUNE]: {
      id: 'iron_gate_fortune',
      action: 'Wait for wind and shifting stone to open one brief gap.',
      baseNarrative: [
        'You wait beside the broken hinge and bet on the wind. Once, for a breath, stone shifts against stone and the gate gapes open.',
        'You cross, and in the ruined guard post an abandoned drawer gives up a silver toll seal.',
      ],
      consequenceLines: [
        'You slipped through on one lucky gap and found a Silver Toll Seal.',
        'The gate is left unstable behind you.',
        'It may fall, stay open, or trap the next group — that is no longer yours to decide.',
      ],
      effects: {
        addItems: ['silver_toll_seal'],
        memoryPatch: { ironGate: { state: 'unstable', travelers: 'abandoned' } },
        addThreads: [{ id: 'road_remembers', urgency: 'dormant', tags: ['gate', 'unstable'] }],
      },
    },
  },
};

export const AMBUSH = {
  id: 'ambush',
  title: 'Ambush',
  kind: 'core',
  description:
    'Bandits rise from both ditches and close across the road; their leader demands your pack. Two archers stay low in the brush. Three horses strain against a single tether behind the line, and the youngest bandit keeps glancing at the trees. The formation looks dangerous, but it does not look loyal.',
  detailPalette: [
    'a leader ruling by fear',
    'two hidden archers',
    'restless horses on one tether',
    'a frightened youngest bandit',
    'a narrow road',
    'dry brush',
    'a stone milestone',
    'an old military uniform',
    'a weak side',
    'escape routes through the brush',
  ],
  readings: {
    [N.PHYSICAL]: {
      id: 'ambush_physical',
      action: 'Rush the horse line and escape on a stolen horse.',
      baseNarrative: [
        'You put your head down and drive straight at the tether, cutting a horse free and swinging up as the line breaks.',
        'You ride clear, but the bandits keep something of yours out of the wreck, and they are still very much in business.',
      ],
      consequenceLines: [
        'You broke the horse line and rode out.',
        'You gained a Stolen Horse; the bandits kept a belonging of yours.',
        'The bandits remain active on the road.',
      ],
      effects: {
        addItems: ['stolen_horse'],
        memoryPatch: { bandits: { state: 'active', relation: 'neutral', possession: 'player_belonging' }, stolenBelonging: 'ambush_pack' },
        addThreads: [{ id: 'stolen_belonging', urgency: 'active', tags: ['bandit'] }],
      },
      interventions: [
        {
          id: 'ambush_physical_greyfang',
          priority: 70,
          when: has('greyfang'),
          mitigatesTerminal: 'ambush_physical_wound',
          addNarrative: ['Greyfang hits the horse line a heartbeat ahead of you and tears the opening wider than your body could.'],
        },
        {
          id: 'ambush_physical_prepared',
          priority: 60,
          when: status('prepared'),
          mitigatesTerminal: 'ambush_physical_wound',
          effects: { removeStatuses: ['prepared'] },
          addNarrative: ['You already knew where the tether was weakest; the charge lands exactly where you planned.'],
        },
        {
          id: 'ambush_physical_buckler',
          priority: 30,
          when: has('bandits_buckler'),
          mitigatesTerminal: 'ambush_physical_wound',
          addNarrative: ['The buckler turns the one blow that would have opened your side.'],
        },
      ],
      terminalTriggers: [
        {
          id: 'ambush_physical_wound',
          when: ({ run }) => run.statuses.includes('wounded'),
          warningStatus: 'wounded',
          endingId: 'ending_wounded_physical',
          narrative:
            'You were already Wounded, and the horse line is no place for a body that cannot take another blow. A blade finds the old injury, and you do not ride out.',
        },
      ],
    },

    [N.AGGRESSION]: {
      id: 'ambush_aggression',
      action: 'Kill the leader before the formation closes.',
      baseNarrative: [
        'You do not wait for the demand to finish. You put the leader down before the line can tighten, and the fear that held the bandits together turns, for a moment, into confusion.',
        'The survivors will remember your face, and they will come looking for it.',
      ],
      consequenceLines: [
        'You killed the bandit leader.',
        'The bandits are leaderless — and now hunting you.',
        'You gained a Notched Blade and the status Hunted.',
      ],
      effects: {
        addItems: ['notched_blade'],
        addStatuses: ['hunted'],
        memoryPatch: { bandits: { state: 'leaderless', relation: 'hunting', possession: 'none' } },
        addThreads: [{ id: 'bandits_return', urgency: 'active', tags: ['revenge'] }],
        addEnemies: ['leaderless_bandits'],
      },
    },

    [N.PROTECTION]: {
      id: 'ambush_protection',
      action: 'Hold behind the milestone until the robbery costs too much.',
      baseNarrative: [
        'You put the stone milestone at your back and make the bandits come at you through the narrowest reach of road.',
        'They break off when the taking costs more than the pack is worth — but your gear is torn apart in the doing, and the bandits are still out here.',
      ],
      consequenceLines: [
        'You held the milestone until the robbery stopped paying.',
        'You lost a supply, but read the whole fight — you are Prepared.',
        'The bandits withdrew active and unresolved.',
      ],
      effects: {
        consumeOneOf: [['timber', 'cloth', 'oil', 'worked_iron', 'provision']],
        addStatuses: ['prepared'],
        memoryPatch: { bandits: { state: 'active', relation: 'neutral', possession: 'none' } },
      },
    },

    [N.ENDURANCE]: {
      id: 'ambush_endurance',
      action: 'Escape into the brush and keep moving after they stop.',
      baseNarrative: [
        'You break for the brush and simply do not stop. The bandits chase until the chase stops being worth it, and then you keep going anyway.',
        'You spend no trick and no supply — only your own strength, which is now noticeably lower.',
      ],
      consequenceLines: [
        'You outlasted the pursuit on foot.',
        'The bandits still hold the road behind you.',
        'The long run cost you strength.',
      ],
      effects: {
        advanceStrain: 1,
        memoryPatch: { bandits: { state: 'active', relation: 'neutral', possession: 'none' } },
      },
      interventions: [
        {
          id: 'ambush_endurance_shakes_hunt',
          priority: 90,
          when: status('hunted'),
          addNarrative: ['These are the same ones who were hunting you; when they finally give up, the pursuit gives up with them.'],
          effects: { removeStatuses: ['hunted'], resolveThreads: ['pursuers_close'] },
        },
      ],
      terminalTriggers: [
        {
          id: 'ambush_endurance_collapse',
          when: ({ run }) => run.strain === 'exhausted',
          warningStatus: 'strain:exhausted',
          endingId: 'ending_exhausted_exertion',
          narrative:
            'You were already Exhausted before you ran. The brush goes on longer than your body, and this time keeping moving is the thing that stops you.',
        },
      ],
    },

    [N.COMPASSION]: {
      id: 'ambush_compassion',
      action: 'Offer food to the youngest bandit and name the hunger under the weapon.',
      baseNarrative: [
        'You hold out food to the youngest one and speak past the raised weapon to the hunger and fear underneath it.',
        'It splits the group down its seam. The youngest lowers the blade, and the leader’s hold cracks.',
      ],
      consequenceLines: [
        'You fed the youngest bandit and named their fear.',
        'The bandits are divided; a deserter may follow.',
        'You spent a provision to buy it.',
      ],
      effects: {
        consumeProvision: 1,
        memoryPatch: { bandits: { state: 'divided', relation: 'indebted', possession: 'none' } },
        addThreads: [{ id: 'young_bandit_deserter', urgency: 'active', tags: ['bandit', 'mercy'] }],
      },
      interventions: [
        {
          id: 'ambush_compassion_distrusted',
          priority: 50,
          when: status('distrusted'),
          replaceNarrative: [
            'The food buys your passage, but the stories that cling to you keep the youngest bandit from truly turning.',
            'They let you go without joining you.',
          ],
          consequenceLines: [
            'The food bought passage, not a defector.',
            'The bandits are divided but keep their number.',
            'Your reputation kept the mercy from landing.',
          ],
          effects: { resolveThreads: ['young_bandit_deserter'] },
        },
        {
          id: 'ambush_compassion_knife',
          priority: 30,
          when: has('beast_fang_knife'),
          addNarrative: ['The beast-fang knife at your belt makes the mercy read as choice, not weakness — the defection is firmer for it.'],
        },
      ],
    },

    [N.AUTHORITY]: {
      id: 'ambush_authority',
      action: 'Recognize the old drill and address them as deserters.',
      baseNarrative: [
        'You see the old military drill hiding under the banditry and name it — you speak to them as deserters, not robbers.',
        'The word lands. The formation loosens as men remember an order older than their leader.',
      ],
      consequenceLines: [
        'You named them deserters and split their loyalty.',
        'The bandits are divided.',
        'Without proof of rank you paid a small toll to be heard.',
      ],
      effects: {
        consumeProvision: 1,
        memoryPatch: { bandits: { state: 'divided', relation: 'neutral', possession: 'none' } },
      },
      interventions: [
        {
          id: 'ambush_authority_insignia',
          priority: 70,
          when: has('soldiers_insignia'),
          replaceNarrative: [
            'You show them the soldier’s insignia, and the drill takes over completely. They stand down as if inspected.',
            'No toll, no argument — only old discipline reasserting itself.',
          ],
          consequenceLines: [
            'The insignia made them stand down entirely.',
            'The bandits are divided and cowed.',
            'Some may come over to you as deserters.',
          ],
          effects: { consumeProvision: 0, addThreads: [{ id: 'young_bandit_deserter', urgency: 'active', tags: ['deserter'] }] },
        },
        {
          id: 'ambush_authority_hunted',
          priority: 90,
          when: status('hunted'),
          addNarrative: ['But these are the ones already on your trail; naming yourself only sharpens their reason to close.'],
          effects: { addThreads: [{ id: 'pursuers_close', urgency: 'urgent', tags: ['exposed'] }] },
        },
      ],
    },

    [N.MYSTERY]: {
      id: 'ambush_mystery',
      action: 'Name something the bandits believe no stranger could know.',
      baseNarrative: [
        'You speak a name none of them expected a stranger to carry — a dead man’s, or a secret one’s.',
        'The road goes very quiet. Something answers you, and the bandits feel it before they understand it.',
      ],
      consequenceLines: [],
      effects: {},
      choices: [
        {
          id: 'carry',
          label: 'Carry the revelation',
          description: 'Speak with the dead voice and let it cling to you.',
          narrative: [
            'You let the dead voice speak through you, and the bandits scatter back from the sound of it.',
            'The road is yours to walk — but so is the cold that spoke.',
          ],
          consequenceLines: [
            'You spoke with a borrowed dead voice.',
            'The bandits are fearful; occult rumor spreads.',
            'The contact left you Haunted.',
          ],
          effects: {
            addStatuses: ['haunted'],
            memoryPatch: { bandits: { state: 'active', relation: 'fearful', possession: 'none' } },
          },
          terminalTriggers: [
            {
              id: 'ambush_mystery_possession',
              when: ({ run }) => run.statuses.includes('deeply_haunted'),
              warningStatus: 'deeply_haunted',
              endingId: 'ending_possession',
              narrative:
                'You were already Deeply Haunted. The dead name does not pass through you this time — it stays, and you are the one who leaves.',
            },
          ],
        },
        {
          id: 'bind',
          label: 'Bind it into a vessel',
          description: 'Requires a Gravekeeper’s Candle or a suitable weapon.',
          available: ({ run }) =>
            run.items.includes('gravekeepers_candle') || run.items.includes('notched_blade') || run.items.includes('beast_fang_knife'),
          narrative: [
            'You catch the revealed thing before it can settle into you and press it into the vessel at your side.',
            'It is held now — a one-use edge with a specific debt to call in later.',
          ],
          consequenceLines: [
            'You bound the revealed dead into a vessel.',
            'The bandits are fearful; you did not become Haunted.',
            'The bound thing will ask something of you later.',
          ],
          effects: {
            memoryPatch: { bandits: { state: 'active', relation: 'fearful', possession: 'none' } },
            addThreads: [{ id: 'trapmaker_truth', urgency: 'dormant', tags: ['bound'] }],
          },
        },
        {
          id: 'settle',
          label: 'Settle the truth',
          description: 'Requires a witness, insignia, or known dead identity to reveal without carrying it.',
          available: ({ run }) =>
            run.items.includes('soldiers_insignia') || run.witnesses.length > 0,
          narrative: [
            'You do not carry the thing or cage it — you simply say the true name aloud, with proof, and let it be true.',
            'The bandits break apart over what they have just heard. Nothing follows you from it.',
          ],
          consequenceLines: [
            'You revealed the truth without carrying it.',
            'The bandits are divided and shaken.',
            'You gained no bound thing and no haunting.',
          ],
          effects: { memoryPatch: { bandits: { state: 'divided', relation: 'fearful', possession: 'none' } } },
        },
      ],
    },

    [N.DECEPTION]: {
      id: 'ambush_deception',
      action: 'Call out to an imaginary patrol and slip through the weak side.',
      baseNarrative: [
        'You shout a greeting to a patrol that is not there, sharp with false relief, and the bandits’ heads snap toward the empty road.',
        'You are through the weak side before they understand the trick — and being tricked in front of each other is not something they will forgive.',
      ],
      consequenceLines: [
        'You bluffed a patrol and escaped through the weak side.',
        'The bandits are humiliated — they will want to answer that.',
        'A later encounter will carry their grudge.',
      ],
      effects: {
        memoryPatch: { bandits: { state: 'active', relation: 'humiliated', possession: 'none' } },
        addThreads: [{ id: 'bandits_return', urgency: 'active', tags: ['humiliation'] }],
      },
      interventions: [
        {
          id: 'ambush_deception_cloak',
          priority: 30,
          when: has('smoke_cloth_cloak'),
          addNarrative: ['The smoke-cloth cloak takes your outline apart as you go; there is no immediate pursuit at all.'],
          effects: { resolveThreads: ['pursuers_close'] },
        },
        {
          id: 'ambush_deception_redirect',
          priority: 90,
          when: status('hunted'),
          addNarrative: ['You leave the ambushers pointed at the enemy already hunting you, and let two problems find each other.'],
          effects: { removeStatuses: ['hunted'] },
        },
      ],
    },

    [N.INVESTIGATION]: {
      id: 'ambush_investigation',
      action: 'Study the archers’ lines and escape through the blind space.',
      baseNarrative: [
        'You trace the archers’ lines of fire until you find the blind wedge behind the horse tether, and you leave through it.',
        'You learn how this formation is built — but knowing it is not the same as breaking it, and the bandits still hold the road.',
      ],
      consequenceLines: [
        'You read the formation and slipped its blind spot.',
        'You are Prepared for their return.',
        'The bandits remain active behind you.',
      ],
      effects: {
        addStatuses: ['prepared'],
        memoryPatch: { bandits: { state: 'active', relation: 'neutral', possession: 'none' } },
        addThreads: [{ id: 'bandits_return', urgency: 'active', tags: ['studied'] }],
      },
      interventions: [
        {
          id: 'ambush_investigation_greyfang',
          priority: 70,
          when: has('greyfang'),
          replaceNarrative: [
            'You mark the horses as the weak point — and Greyfang turns your reading into an event, panicking the line so the blind space becomes a collapse.',
            'You walk out through a formation that is busy falling apart.',
          ],
          consequenceLines: [
            'Greyfang turned your read of the horses into a stampede.',
            'You are Prepared; the bandit line broke as you left.',
            'The bandits remain active but rattled.',
          ],
        },
      ],
    },

    [N.TRANSFORMATION]: {
      id: 'ambush_transformation',
      action: 'Cut the horse tether and turn the formation into a stampede.',
      baseNarrative: [
        'You get a blade to the single tether and the three horses become one panic that runs straight through the bandit line.',
        'You take a horse out of the chaos. The bandits keep the road but lose their speed, and loose horses are now somebody’s problem down the way.',
      ],
      consequenceLines: [
        'You stampeded the horses through the bandits.',
        'You gained a Stolen Horse; the bandits are grounded.',
        'Loose horses may cause trouble later on the road.',
      ],
      effects: {
        addItems: ['stolen_horse'],
        memoryPatch: { bandits: { state: 'active', relation: 'humiliated', possession: 'none' } },
      },
      interventions: [
        {
          id: 'ambush_transformation_greyfang',
          priority: 70,
          when: has('greyfang'),
          addNarrative: ['Greyfang goes after the herd rather than the road, and you have to choose between the horse and the animal that trusts you.'],
          effects: { addThreads: [{ id: 'beast_returns', urgency: 'dormant', tags: ['companion', 'herd'] }] },
        },
      ],
    },

    [N.CREATION]: {
      id: 'ambush_creation',
      action: 'Create a smoke bundle and vanish.',
      baseNarrative: [
        'You bind oil and cloth into a fat smoke bundle, light it, and walk out inside the cloud you made.',
        'The bandits are left coughing in a road they can no longer see across. They are still there — but you are not.',
      ],
      consequenceLines: [
        'You escaped inside a bundle of smoke.',
        'The bandits remain active in the murk.',
        'Uncontrolled, that smoke can become a fire on the road.',
      ],
      effects: {
        consumeOneOf: [['oil', 'cloth']],
        memoryPatch: { bandits: { state: 'active', relation: 'neutral', possession: 'none' }, fire: 'active' },
        addThreads: [{ id: 'roadside_fire', urgency: 'active', tags: ['smoke'] }],
      },
      interventions: [
        {
          id: 'ambush_creation_controlled',
          priority: 50,
          when: status('prepared'),
          replaceNarrative: [
            'Because you planned the wind, the smoke does exactly what you tell it and nothing more.',
            'You leave a controlled cloud behind, not a fire waiting to happen.',
          ],
          consequenceLines: [
            'Your foresight kept the smoke controlled.',
            'You escaped cleanly; the bandits remain active.',
            'No fire was left on the road.',
          ],
          effects: { removeStatuses: ['prepared'], memoryPatch: { fire: null }, resolveThreads: ['roadside_fire'] },
        },
      ],
    },

    [N.FORTUNE]: {
      id: 'ambush_fortune',
      action: 'Throw a purse and a wrapped belonging between them, then take the ledger.',
      baseNarrative: [
        'You throw your purse and one wrapped belonging into the space between the bandits and let greed do the rest of the work.',
        'While the line dissolves over the spoils, you lift the leader’s route ledger from a saddlebag and slip away.',
      ],
      consequenceLines: [
        'You bought chaos and stole the Bandit Route Ledger.',
        'The ledger reveals a future road event.',
        'The bandits kept a belonging of yours that may surface later.',
      ],
      effects: {
        addItems: ['bandit_route_ledger'],
        memoryPatch: { bandits: { state: 'divided', relation: 'neutral', possession: 'player_belonging' }, stolenBelonging: 'wrapped_belonging' },
        addThreads: [{ id: 'stolen_belonging', urgency: 'active', tags: ['fortune'] }],
      },
    },
  },
};

export const CORNERED_BEAST = {
  id: 'cornered_beast',
  title: 'Cornered Beast',
  kind: 'core',
  description:
    'A wounded beast blocks the narrow pass. An iron trap is still clamped on one leg, its chain scraping stone whenever the animal moves. It snaps at every approach — though exhaustion weighs on it more heavily than rage. The trap is older than the wound.',
  detailPalette: [
    'a wounded animal',
    'an iron trap',
    'a chain that triggers attacks when it scrapes',
    'fear more than rage',
    'exhaustion',
    'a narrow pass',
    'branches and loose stones',
    'very little room',
    'a trap older than the wound',
  ],
  readings: {
    [N.PHYSICAL]: {
      id: 'cornered_beast_physical',
      action: 'Pin the beast and force the trap open.',
      baseNarrative: [
        'You get your weight onto the thrashing animal and force the trap’s jaws apart with your hands.',
        'It comes free and bolts — but not before its claws and the iron have opened you badly.',
      ],
      consequenceLines: [
        'You forced the trap and freed the beast.',
        'You gained Worked Iron — and a Wound.',
        'The beast owes its freedom to your hands.',
      ],
      effects: {
        addStatuses: ['wounded'],
        addMaterials: ['worked_iron'],
        memoryPatch: { beast: { fate: 'freed', responsibility: 'helped_by_force' } },
        addThreads: [{ id: 'beast_returns', urgency: 'dormant', tags: ['beast', 'force'] }],
      },
      interventions: [
        {
          id: 'cornered_beast_physical_greyfang',
          priority: 70,
          when: has('greyfang'),
          mitigatesTerminal: 'cornered_beast_physical_wound',
          addNarrative: ['Another animal at your side changes the struggle; the beast reads it and fights you less.'],
        },
        {
          id: 'cornered_beast_physical_salve',
          priority: 30,
          when: has('healing_salve'),
          mitigatesTerminal: 'cornered_beast_physical_wound',
          effects: { consumeItems: ['healing_salve'] },
          addNarrative: ['You dress the reopened injury before it can finish you.'],
        },
      ],
      terminalTriggers: [
        {
          id: 'cornered_beast_physical_wound',
          when: ({ run }) => run.statuses.includes('wounded'),
          warningStatus: 'wounded',
          endingId: 'ending_wounded_physical',
          narrative:
            'You were already Wounded, and the beast’s panic finds that exact place. The trap takes one of you, and it is not the animal.',
        },
      ],
    },

    [N.AGGRESSION]: {
      id: 'cornered_beast_aggression',
      action: 'Kill the beast before it can lunge again.',
      baseNarrative: [
        'You end it before it can gather for another lunge. The pass goes quiet.',
        'You cut a fang free as proof, or as a tool. Something — a hunter, a spirit, the road itself — will eventually notice this was done.',
      ],
      consequenceLines: [
        'You killed the beast in the pass.',
        'You gained a Beast-Fang Knife; the threat is gone.',
        'Witnesses or the road may answer for the killing.',
      ],
      effects: {
        addItems: ['beast_fang_knife'],
        memoryPatch: { beast: { fate: 'killed', responsibility: 'harmed' } },
      },
    },

    [N.PROTECTION]: {
      id: 'cornered_beast_protection',
      action: 'Secure the chain and wall the pass with your pack.',
      baseNarrative: [
        'You wrap your pack around one arm and work the beast’s chain fast to a heavy stone, then brace the pass with your own gear as a barrier.',
        'The animal stays alive and cannot reach you, but its claws tear your pack apart, and the trap is still on its leg when you go.',
      ],
      consequenceLines: [
        'You contained the beast without harming it.',
        'You lost a supply to its claws.',
        'The trapped beast is left behind and will return.',
      ],
      effects: {
        consumeOneOf: [['timber', 'cloth', 'oil', 'worked_iron', 'provision']],
        memoryPatch: { beast: { fate: 'contained', responsibility: 'abandoned' } },
        addThreads: [{ id: 'beast_after_pass', urgency: 'active', tags: ['beast', 'contained'] }],
      },
    },

    [N.ENDURANCE]: {
      id: 'cornered_beast_endurance',
      action: 'Wait beyond its reach until it sleeps.',
      baseNarrative: [
        'You settle just beyond the chain’s reach and wait the animal out, hour after hour, until exhaustion folds it down into sleep.',
        'You slip past while it dreams. It is still trapped when you go, and it will still be trapped when someone else finds it.',
      ],
      consequenceLines: [
        'You waited the beast into sleep and passed.',
        'The beast remains trapped in the pass.',
        'The cold vigil cost you strength.',
      ],
      effects: {
        advanceStrain: 1,
        memoryPatch: { beast: { fate: 'trapped', responsibility: 'abandoned' } },
        addThreads: [{ id: 'beast_after_pass', urgency: 'active', tags: ['beast', 'trapped'] }],
      },
      terminalTriggers: [
        {
          id: 'cornered_beast_endurance_collapse',
          when: ({ run }) => run.strain === 'exhausted',
          warningStatus: 'strain:exhausted',
          endingId: 'ending_exhausted_exertion',
          narrative:
            'You were already Exhausted, and the night is longer than you are. The cold does to you what the trap did to the beast, and by dawn you are the one who cannot rise.',
        },
      ],
    },

    [N.COMPASSION]: {
      id: 'cornered_beast_compassion',
      action: 'Approach without threat and release the trap.',
      baseNarrative: [
        'You come at the animal with no weapon and no hurry, letting it learn your hands before they touch the iron.',
        'The trap opens. The beast does not run at once — it looks at you first, and remembers.',
      ],
      consequenceLines: [
        'You freed the beast gently.',
        'It remembers your hands.',
        'It may return to you further down the road.',
      ],
      effects: {
        memoryPatch: { beast: { fate: 'freed', responsibility: 'helped' } },
        addThreads: [{ id: 'beast_returns', urgency: 'active', tags: ['beast', 'trust'] }],
      },
      interventions: [
        {
          id: 'cornered_beast_compassion_salve',
          priority: 70,
          when: has('healing_salve'),
          replaceNarrative: [
            'You open the trap and then dress the wound beneath it with the salve, and something in the animal decides.',
            'It rises, shakes, and stays at your side. You call it Greyfang.',
          ],
          consequenceLines: [
            'You healed the beast and it chose to stay.',
            'You gained the companion Greyfang.',
            'The beast thread is closed in trust.',
          ],
          effects: {
            consumeItems: ['healing_salve'],
            addCompanions: ['greyfang'],
            memoryPatch: { beast: { fate: 'companion', responsibility: 'helped' } },
            resolveThreads: ['beast_returns'],
          },
        },
      ],
    },

    [N.AUTHORITY]: {
      id: 'cornered_beast_authority',
      action: 'Drive the beast from the road through voice and presence.',
      baseNarrative: [
        'You make yourself the larger animal — voice, stance, and advance — until the beast breaks and drags its chain off into the country beyond the pass.',
        'The road is clear. Wherever the beast goes now, it goes as a problem you handed to someone else.',
      ],
      consequenceLines: [
        'You drove the beast off the road.',
        'It is loose in the country, still trapped.',
        'Later travelers or a settlement may pay for it.',
      ],
      effects: {
        memoryPatch: { beast: { fate: 'loose', responsibility: 'redirected' } },
        addThreads: [{ id: 'cursed_beast', urgency: 'dormant', tags: ['beast', 'loose'] }],
      },
      interventions: [
        {
          id: 'cornered_beast_authority_distrusted',
          priority: 50,
          when: status('distrusted'),
          addNarrative: ['Those who see you drive it off fold the display into the darker story they already tell about you.'],
          effects: { addWitnesses: ['fearful_witness'] },
        },
      ],
    },

    [N.MYSTERY]: {
      id: 'cornered_beast_mystery',
      action: 'Reach toward the presence inside the trap iron.',
      baseNarrative: [
        'You set your attention on the trap iron, not the animal, and feel the fear worn into it by everything it has ever held.',
        'A presence answers from inside the metal.',
      ],
      consequenceLines: [],
      effects: {},
      choices: [
        {
          id: 'carry',
          label: 'Carry the trap-fear',
          description: 'Take the presence from the iron into yourself.',
          narrative: [
            'You draw the thing out of the iron and let it ride with you, and it shows you what the trap remembers.',
            'The beast pulls free changed, and so are you.',
          ],
          consequenceLines: [
            'You took the trap-presence into yourself.',
            'You gained Road-Trap Evidence; the beast is Cursed.',
            'The contact left you Haunted.',
          ],
          effects: {
            addStatuses: ['haunted'],
            roadTrapEvidenceInc: 1,
            memoryPatch: { beast: { fate: 'cursed', responsibility: 'redirected' } },
            addThreads: [{ id: 'cursed_beast', urgency: 'active', tags: ['beast', 'cursed'] }, { id: 'trapmaker_truth', urgency: 'active', tags: ['evidence'] }],
          },
          terminalTriggers: [
            {
              id: 'cornered_beast_mystery_possession',
              when: ({ run }) => run.statuses.includes('deeply_haunted'),
              warningStatus: 'deeply_haunted',
              endingId: 'ending_possession',
              narrative:
                'You were already Deeply Haunted. The trap has held frightened things for a long time, and now it holds you.',
            },
          ],
        },
        {
          id: 'bind',
          label: 'Bind it into iron or candle',
          description: 'Requires Worked Iron or a Gravekeeper’s Candle to hold the presence.',
          available: ({ run }) => run.materials.includes('worked_iron') || run.items.includes('gravekeepers_candle'),
          narrative: [
            'You catch the presence before it reaches you and seal it into iron of your own.',
            'The beast comes loose from a trap that no longer means anything, and you carry a thing that can name road-traps later.',
          ],
          consequenceLines: [
            'You bound the trap-presence into a vessel.',
            'The beast is Loose; you did not become Haunted.',
            'The Bound Trap Presence can identify road-traps later.',
          ],
          effects: {
            consumeMaterials: ['worked_iron'],
            addItems: ['bound_trap_presence'],
            memoryPatch: { beast: { fate: 'loose', responsibility: 'redirected' } },
            addThreads: [{ id: 'cursed_beast', urgency: 'active', tags: ['beast', 'loose'] }],
          },
        },
        {
          id: 'settle',
          label: 'Settle it with Blessing',
          description: 'Requires Blessed to release the presence cleanly.',
          available: ({ run }) => run.statuses.includes('blessed'),
          narrative: [
            'You spend the blessing on the iron, and the frightened thing inside it is allowed, at last, to leave.',
            'The trap opens of its own accord and the beast walks free of a clean pass.',
          ],
          consequenceLines: [
            'You released the trap-presence with your blessing.',
            'The beast is Freed with no curse.',
            'You gained no cursed thing.',
          ],
          effects: {
            removeStatuses: ['blessed'],
            memoryPatch: { beast: { fate: 'freed', responsibility: 'helped' } },
            addThreads: [{ id: 'beast_returns', urgency: 'dormant', tags: ['beast', 'freed'] }],
          },
        },
      ],
    },

    [N.DECEPTION]: {
      id: 'cornered_beast_deception',
      action: 'Lay a false trail and draw the beast away.',
      baseNarrative: [
        'You drag scent and sound off to one side and let the beast’s fear do the rest, pulling it away from the pass.',
        'It goes, chain and all, chasing a thing that was never there.',
      ],
      consequenceLines: [
        'You lured the beast off the pass.',
        'It is loose, and now aimed by you.',
        'You spent strength or supply to make the trail.',
      ],
      effects: {
        consumeProvision: 1,
        memoryPatch: { beast: { fate: 'loose', responsibility: 'redirected' } },
        addThreads: [{ id: 'cursed_beast', urgency: 'dormant', tags: ['beast', 'loose'] }],
      },
      interventions: [
        {
          id: 'cornered_beast_deception_hunted',
          priority: 90,
          when: status('hunted'),
          replaceNarrative: [
            'You do not just draw the beast away — you draw it toward the ones hunting you, and let its fear and their pursuit meet on the road behind you.',
            'Whatever finds whom back there, it is no longer only your problem.',
          ],
          consequenceLines: [
            'You aimed the beast at your pursuers.',
            'The beast is loose on the hunt behind you.',
            'The pursuit is weakened or broken.',
          ],
          effects: { removeStatuses: ['hunted'], resolveThreads: ['pursuers_close'] },
        },
      ],
    },

    [N.INVESTIGATION]: {
      id: 'cornered_beast_investigation',
      action: 'Discover that the scraping chain triggers every attack.',
      baseNarrative: [
        'You watch until the pattern gives itself up: every lunge begins when the chain scrapes the stone. Silence the chain and the beast has no reason to strike.',
        'You wedge it beneath a fallen branch and walk through unhurt — leaving the animal exactly as trapped as you found it.',
      ],
      consequenceLines: [
        'You learned the chain triggers the attacks and passed safely.',
        'You gained Road-Trap Evidence; the beast stays trapped.',
        'The time you spent let an urgent danger advance.',
      ],
      effects: {
        roadTrapEvidenceInc: 1,
        memoryPatch: { beast: { fate: 'trapped', responsibility: 'abandoned' } },
        addThreads: [{ id: 'beast_after_pass', urgency: 'active', tags: ['beast', 'trapped'] }],
        advanceUrgent: true,
      },
    },

    [N.TRANSFORMATION]: {
      id: 'cornered_beast_transformation',
      action: 'Reshape the trap into a brace.',
      baseNarrative: [
        'You work the trap’s own iron into a brace that lifts its jaws instead of closing them, turning the thing against its purpose.',
        'The beast steps free of a device that has become its opposite. The old road’s trapmaker would know his own work at a glance.',
      ],
      consequenceLines: [
        'You reforged the trap into a brace and freed the beast.',
        'The alteration is unmistakably deliberate.',
        'The old-road trapmaker may recognize the change.',
      ],
      effects: {
        memoryPatch: { beast: { fate: 'freed', responsibility: 'helped' } },
        addThreads: [{ id: 'trapmaker_truth', urgency: 'active', tags: ['altered', 'trap'] }],
      },
      interventions: [
        {
          id: 'cornered_beast_transformation_iron',
          priority: 30,
          when: material('worked_iron'),
          addNarrative: ['With worked iron to spare, you keep a length of the reshaped metal for yourself.'],
          effects: { addMaterials: ['worked_iron'] },
        },
      ],
    },

    [N.CREATION]: {
      id: 'cornered_beast_creation',
      action: 'Build a lever and restraint.',
      baseNarrative: [
        'You cut a lever from timber and a restraint from cloth and build a small machine to open the trap from outside the beast’s reach.',
        'It works once and breaks in the working, but the animal is free and you are unmarked.',
      ],
      consequenceLines: [
        'You built a device that freed the beast safely.',
        'You avoided any injury.',
        'The device broke after its one use.',
      ],
      effects: {
        consumeOneOf: [['timber', 'cloth']],
        memoryPatch: { beast: { fate: 'freed', responsibility: 'helped' } },
        addThreads: [{ id: 'beast_returns', urgency: 'dormant', tags: ['beast', 'freed'] }],
      },
      interventions: [
        {
          id: 'cornered_beast_creation_improvised',
          priority: 40,
          when: ({ run }) => !run.materials.includes('timber') && !run.materials.includes('cloth'),
          replaceNarrative: [
            'With no timber or cloth, you improvise a lever from a green branch and your own belt.',
            'It frees the beast, but the wrenching effort leaves you spent.',
          ],
          consequenceLines: [
            'You improvised a device with no proper materials.',
            'The beast is freed; you avoided injury.',
            'The effort left you spent.',
          ],
          effects: { advanceStrain: 1 },
        },
      ],
    },

    [N.FORTUNE]: {
      id: 'cornered_beast_fortune',
      action: 'Commit to the instant the chain catches between two stones.',
      baseNarrative: [
        'You wait for the one bad step, and when the chain jams between two stones you go — sliding through the pass as the link snaps behind you.',
        'Under the broken link lies a brass key fragment stamped with the old road’s crest.',
      ],
      consequenceLines: [
        'You slipped through and found a Trapmaker’s Key Fragment.',
        'The beast tore loose and is Loose on the road.',
        'What it becomes is no longer yours to decide.',
      ],
      effects: {
        addItems: ['trapmakers_key_fragment'],
        memoryPatch: { beast: { fate: 'loose', responsibility: 'redirected' } },
        addThreads: [{ id: 'cursed_beast', urgency: 'dormant', tags: ['beast', 'loose'] }, { id: 'road_remembers', urgency: 'dormant', tags: ['fragment'] }],
      },
    },
  },
};

export const PILOT_CORE_EVENTS = [IRON_GATE, AMBUSH, CORNERED_BEAST];
