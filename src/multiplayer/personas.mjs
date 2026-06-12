// Persona definitions. Each persona is a loadout identity chosen before a
// multiplayer match. Passives are applied by the reducer at init and round-start;
// they do not require story justification.
//
// `ability` is the display form of the persona's mechanical hook, split the way
// card games template it:
//   name     — the ability's title
//   tag      — timing badge ('Game Start' | 'Passive' | 'Once per Round')
//   rules    — templated rules text; **word** marks a game keyword
//   reminder — optional muted line explaining a keyword referenced in rules
//   flavor   — optional one-line italic flavor quote
//
// Rules text style guide: lead with the timing window, state the effect in
// the fewest words that stay unambiguous, capitalize game terms (Place,
// Discard, Banish, Spread), digits for numbers, no metaphors. The player-facing
// term for spending a discard to trigger a card's ability is Discard (the code
// calls this "invoke" internally — never show that word to players).

export const PERSONAS = Object.freeze({

  cleaner: {
    id: 'cleaner',
    name: 'The Cleaner',
    tagline: 'Start with 3 Banish in your deck.',
    ability: {
      name: 'Cleansing Rite',
      tag: 'Game Start',
      rules: 'Your deck starts with 3 **Banish**.',
      reminder: 'Banish: remove the last card your opponent played from their spread.',
      flavor: 'Every deck carries residue. Burn it clean.',
    },
    passives: {
      gameStartDeckCards: [{ defId: 'mp_banish', count: 3 }],
    },
  },

  hoarder: {
    id: 'hoarder',
    name: 'The Hoarder',
    tagline: '+1 hand size, −1 starting discard.',
    ability: {
      name: 'Overdraw',
      tag: 'Passive',
      rules: '+1 **Hand Size**. −1 starting **Discard**.',
      flavor: 'More cards. Fewer outs.',
    },
    passives: {
      handSizeBonus: 1,
      startingDiscardsBonus: -1,
    },
  },

  anchor: {
    id: 'anchor',
    name: 'The Anchor',
    tagline: 'Your first placed card each round is protected.',
    ability: {
      name: 'Significator',
      tag: 'Passive',
      rules: 'The first card you **Place** each round can’t be removed or silenced.',
      flavor: 'The first card laid is the truest.',
    },
    passives: {
      anchoredFirstCard: true,
    },
  },

  gambit: {
    id: 'gambit',
    name: 'The Gambit',
    tagline: 'Once per round: Place after Discard.',
    ability: {
      name: 'Double Deal',
      tag: 'Once per Round',
      rules: 'After you **Discard**, you may immediately **Place** a card for free.',
      flavor: 'Why take one turn when you’re owed two?',
    },
    passives: {
      bonusPlaceAfterInvoke: true,
    },
  },

  surgeon: {
    id: 'surgeon',
    name: 'The Surgeon',
    tagline: 'Once per round: free swap in your spread.',
    ability: {
      name: 'Transposition',
      tag: 'Once per Round',
      rules: 'On your turn, swap 2 cards in your **Spread** for free.',
      flavor: 'Fate rewards a steady hand.',
    },
    passives: {
      freeSpreadSwap: true,
    },
  },

});

export function getPersona(id) {
  return PERSONAS[id] ?? null;
}

export function allPersonas() {
  return Object.values(PERSONAS);
}
