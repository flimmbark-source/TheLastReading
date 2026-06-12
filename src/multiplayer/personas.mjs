// Persona definitions. Each persona is a loadout identity chosen before a
// multiplayer match. Passives are applied by the reducer at init and round-start;
// they do not require story justification.
//
// `ability` is the display form of the persona's mechanical hook:
//   name — the ability's title, shown in the loadout description box
//   tag  — frequency badge ('Game Start' | 'Passive' | 'Once / Round')
//   text — rules text; **word** marks mechanic keywords for emphasis

export const PERSONAS = Object.freeze({

  cleaner: {
    id: 'cleaner',
    name: 'The Cleaner',
    tagline: 'Start with 3 Banish in your deck.',
    ability: {
      name: 'Cleansing Rite',
      tag: 'Game Start',
      text:
        'Your deck arrives purified — seeded with 3 **Banish**. Strip the last ' +
        'card your opponent played right out of their spread.',
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
      text:
        'Draw an extra card every round, but the table takes its cut: start ' +
        'each game with one fewer **Discard**. More options, less fuel.',
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
      text:
        'The first card you lay each round is set in stone. No opponent ' +
        'ability can remove or silence it.',
    },
    passives: {
      anchoredFirstCard: true,
    },
  },

  gambit: {
    id: 'gambit',
    name: 'The Gambit',
    tagline: 'Once per round: Place after Invoke.',
    ability: {
      name: 'Double Deal',
      tag: 'Once / Round',
      text:
        'After you **Invoke**, immediately place a card as a bonus action. ' +
        'Two moves, one turn.',
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
      tag: 'Once / Round',
      text:
        'Swap any two cards in your spread as a free action. Your turn is ' +
        'still yours to spend.',
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
