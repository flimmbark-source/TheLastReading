// Live legacy market data extracted from index.html.
// Tuple format: [name, desc, baseCost, scale, icon, category, pairedKey?]

export const SHOP = Object.freeze({
  // ── Foundation Pack (foundation) ──
  omen:            ['Omen',              'All spread cards gain +1 base Chips',                                                                                                24,1.8, '⚜','foundation'],
  resonance:       ['Resonance',         'Each Major Arcana in the spread contributes +3 extra Chips',                                                                        26,1.8, '🌙','foundation'],
  offering:        ['Offering',          'Gain +5 Reserve at the start of each reading',                                                                                      22,1.7, '🕯','foundation'],
  minor_chips:     ['Minor Arcana',      'Minor Arcana cards in the spread gain +1 Chips each',                                                                               14,1.7, '⚜','foundation'],
  major_chips:     ['Major Arcana',      'Major Arcana cards in the spread gain +2 Chips each',                                                                               16,1.7, '🌙','foundation'],
  number_chips:    ['Numbered Cards',    'Numbered Minor Arcana in the spread gain +1 Chips each',                                                                            14,1.7, '⚜','foundation'],
  cups_chips:      ['Cups',              'Cups cards in the spread gain +1 Chips each',                                                                                       12,1.65,'⚜','foundation'],
  wands_chips:     ['Wands',             'Wands cards in the spread gain +1 Chips each',                                                                                      12,1.65,'⚜','foundation'],
  swords_chips:    ['Swords',            'Swords cards in the spread gain +1 Chips each',                                                                                     12,1.65,'⚜','foundation'],
  pentacles_chips: ['Pentacles',         'Pentacles cards in the spread gain +1 Chips each',                                                                                  12,1.65,'⚜','foundation'],
  // ── Ritual Pack (ritual) ──
  flat_mult:       ['Ritual Mult',       '+0.25 base Mult',                                                                                                                   18,1.8, '🌙','ritual'],
  major_mult:      ['Major Arcana Mult', 'Each Major Arcana in the spread adds <span class="up-mult">+0.10 Mult</span>',                                                      20,1.8, '🌙','ritual'],
  minor_mult:      ['Minor Arcana Mult', 'Each Minor Arcana in the spread adds <span class="up-mult">+0.05 Mult</span>',                                                      18,1.75,'🌙','ritual'],
  court_mult_base: ['Court Mult',        'Each Court card in the spread adds <span class="up-mult">+0.10 Mult</span>',                                                        20,1.8, '👑','ritual'],
  cups_mult:       ['Cups Mult',         'Each Cups card in the spread adds <span class="up-mult">+0.05 Mult</span>',                                                         16,1.7, '⚜','ritual'],
  wands_mult:      ['Wands Mult',        'Each Wands card in the spread adds <span class="up-mult">+0.05 Mult</span>',                                                        16,1.7, '⚜','ritual'],
  swords_mult:     ['Swords Mult',       'Each Swords card in the spread adds <span class="up-mult">+0.05 Mult</span>',                                                       16,1.7, '⚜','ritual'],
  pentacles_mult:  ['Pentacles Mult',    'Each Pentacles card in the spread adds <span class="up-mult">+0.05 Mult</span>',                                                    16,1.7, '⚜','ritual'],
  // ── Pattern Pack (pattern) ──
  rank:            ['Rank of a Kind',    'Three/Four of a Kind gain <span class="up-chips">+5 Chips</span> and <span class="up-mult">+0.25 Mult</span>',                      26,1.8, '⚜','pattern','rank_mult'],
  sequence:        ['Sequence',          'All Sequences gain <span class="up-chips">+5 Chips</span> and <span class="up-mult">+0.5 Mult</span>',                              30,1.85,'🌙','pattern','seq_mult'],
  court_chips:     ['Full Court',        'Full Court gains <span class="up-chips">+8 Chips</span> and <span class="up-mult">+0.25 Mult</span>',                          20,1.6, '👑','pattern','court_mult'],
  royal_court_chips:['Royal Court',      'Royal Court gains <span class="up-chips">+8 Chips</span> and <span class="up-mult">+0.25 Mult</span>',                         20,1.6, '👑','pattern','royal_court_mult'],
  path_chips:      ['Path of the Magi',  '<span class="up-chips">+15 Chips</span> and <span class="up-mult">+0.5 Mult</span>',                                                30,1.9, '✨','pattern','path_mult'],
  balanced_reading:['Balanced Reading',  'Major &amp; Minor Arcana both present: <span class="up-chips">+5 Chips</span> and <span class="up-mult">+0.25 Mult</span>',           24,1.8, '🌙','pattern','balanced_reading_mult'],
  elemental_harmony:['Elemental Harmony','All 4 suits present: <span class="up-chips">+10 Chips</span> and <span class="up-mult">+0.5 Mult</span>',                            28,1.85,'⚜','pattern','elemental_harmony_mult'],
  // ── Innate Force Pack (hand) ──
  hand:            ['Wider Hand',        '+1 starting hand size',                                                                                                             40,2,   '✋','hand'],
  deep_current:    ['Deep Current',      'Draw +1 card at the start of each reading',                                                                                         25,1.75,'🌊','hand'],
  blessed_start:   ['Blessed Start',     '+0.25 Mult at the start of each reading',                                                                                         22,1.8, '🌙','hand'],
  first_light:     ['First Light',       'First card placed in the spread gains +3 Chips',                                                                                    18,1.75,'✨','hand'],
  deep_reserve:    ['Deep Reserve',      'Cards in hand when scoring each give +2 Chips',                                                                                     20,1.75,'✋','hand'],
  // ── Restless Hands Pack (draw) ──
  discards:        ['Extra Discard',     '+1 Discard each reading',                                                                                                           15,1.75,'🃏','draw'],
  mulligan:        ['Mulligan',          '+1 Mulligan charge per reading',                                                                                                    20,1.75,'🔄','draw'],
  ritual_depth:    ['Ritual Depth',      'Whenever an ability draws cards, draw +1 extra',                                                                                    28,1.8, '🧬','draw'],
  nimble_fingers:  ['Nimble Fingers',    'After each Discard, draw 1 card',                                                                                                   22,1.75,'🃏','draw'],
  quick_release:   ['Quick Release',     'Each discarded card adds +3 Chips to the score',                                                                                  18,1.75,'🃏','draw'],
  // ── Relic Cache (relic) ──
  relicSlot:       ['Relic Vessel',      'Gain +1 Relic Slot (max 5).',                                                                                                      35,2,   '🎁','relic'],
  // ── Second Sight Pack (sight) ──
  lens_mastery:    ['Lens Mastery',      'All abilities reveal +1 extra card',                                                                                                30,1.8, '🔭','sight'],
  peek_plus:       ['Deeper Peek',       'Peek reveals +1 additional card',                                                                                                   22,1.75,'🔭','sight'],
  sight_cost:      ['Sight Discount',    'Peek, Search, and Mirror abilities cost no Discard charge once per reading',                                                        28,1.8, '🔭','sight'],
  chosen:          ['Chosen',            'Cards taken via abilities each gain +5 Chips in the spread',                                                                       26,1.8, '🔭','sight'],
  // ── Thread Pack (thread) ──
  relation_plus:   ['Deeper Threads',    'Kin, Between, and Neighbor each reveal +1 card',                                                                                        22,1.75,'🧬','thread'],
  relation_chips:  ['Thread Bond',       'Cards taken via Kin, Between, or Neighbor each gain +1 Chips',                                                                      26,1.8, '🧬','thread'],
});

export const PACKS = Object.freeze({
  foundation:{name:'Foundation Pack',    desc:'Choose a chip bonus for your cards.',                  icon:'isp-foundation',  cost:14, pool:'foundation'},
  ritual:    {name:'Ritual Pack',        desc:'Choose a multiplier upgrade.',                         icon:'isp-ritual',      cost:18, pool:'ritual'},
  pattern:   {name:'Pattern Pack',       desc:'Choose a scoring pattern upgrade.',                    icon:'isp-pattern',     cost:16, pool:'pattern'},
  innate:    {name:'Innate Force Pack',  desc:'Improve your starting resources.',                     icon:'isp-innate',      cost:20, pool:'hand'},
  restless:  {name:'Restless Hands Pack',desc:'Improve your draw and discard abilities.',             icon:'isp-restless',    cost:18, pool:'draw'},
  relic:       {name:'Relic Cache',        desc:'Choose a relic to carry through your session.',        icon:'isp-relic-cache', cost:24},
  second_sight:{name:'Second Sight Pack', desc:'Improve your information and sight abilities.',        icon:'isp-second-sight',cost:18, pool:'sight'},
  thread:      {name:'Thread Pack',       desc:'Enhance your relational abilities.',                   icon:'isp-thread',      cost:18, pool:'thread'},
});

export const SHOP_ICON = Object.freeze({
  discards:'isp-disc',hand:'isp-draw',mulligan:'isp-reshuffle',lens_mastery:'isp-peek',offering:'isp-scoring',ritual_depth:'isp-kin',deep_current:'isp-draw',
  omen:'isp-scoring',resonance:'isp-scoring',rank:'isp-scoring',sequence:'isp-scoring',court_chips:'isp-kin',royal_court_chips:'isp-kin',path_chips:'isp-scoring',relicSlot:'isp-abilities',
  minor_chips:'isp-scoring',major_chips:'isp-scoring',number_chips:'isp-scoring',cups_chips:'isp-scoring',wands_chips:'isp-scoring',swords_chips:'isp-scoring',pentacles_chips:'isp-scoring',
  flat_mult:'isp-scoring',major_mult:'isp-scoring',minor_mult:'isp-scoring',court_mult_base:'isp-kin',cups_mult:'isp-scoring',wands_mult:'isp-scoring',swords_mult:'isp-scoring',pentacles_mult:'isp-scoring',
  peek_plus:'isp-peek',sight_cost:'isp-peek',chosen:'isp-peek',
  relation_plus:'isp-kin',relation_chips:'isp-kin',
  blessed_start:'isp-scoring',first_light:'isp-scoring',deep_reserve:'isp-draw',
  nimble_fingers:'isp-draw',quick_release:'isp-disc',
  balanced_reading:'isp-scoring',elemental_harmony:'isp-scoring',
});

export const REFRESH_COSTS = Object.freeze([5,8,12,17,23]);

export function shopCost(key, persist) {
  const item = SHOP[key];
  const level = (persist?.up || {})[key] || 0;
  return item ? Math.floor(item[2] * Math.pow(item[3], level)) : 0;
}
