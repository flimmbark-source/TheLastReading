// Persona definitions. Each persona is a loadout identity chosen before a
// multiplayer match. Passives are applied by the reducer at init and round-start;
// they do not require story justification.

export const PERSONAS = Object.freeze({

  cleaner: {
    id: 'cleaner',
    name: 'The Cleaner',
    tagline: 'Start with 3 Banish in your deck.',
    description:
      'At the start of the game, 3 Banish cards are added to your deck. ' +
      'Banish removes the last played card from your opponent\'s spread.',
    passives: {
      gameStartDeckCards: [{ defId: 'mp_banish', count: 3 }],
    },
  },

  hoarder: {
    id: 'hoarder',
    name: 'The Hoarder',
    tagline: '+1 hand size, −1 starting discard.',
    description:
      'You draw one extra card each round but start with one fewer Discard. ' +
      'More options, less ability fuel.',
    passives: {
      handSizeBonus: 1,
      startingDiscardsBonus: -1,
    },
  },

  anchor: {
    id: 'anchor',
    name: 'The Anchor',
    tagline: 'Your first placed card each round is protected.',
    description:
      'The first card you place into your spread each round cannot be removed ' +
      'or silenced by opponent abilities.',
    passives: {
      anchoredFirstCard: true,
    },
  },

  gambit: {
    id: 'gambit',
    name: 'The Gambit',
    tagline: 'Once per round: Place after Invoke.',
    description:
      'Once per round, after you invoke an ability, you may immediately place ' +
      'a card as a bonus action — no turn is lost.',
    passives: {
      bonusPlaceAfterInvoke: true,
    },
  },

  surgeon: {
    id: 'surgeon',
    name: 'The Surgeon',
    tagline: 'Once per round: free swap in your spread.',
    description:
      'Once per round, on your turn, you may swap any two cards in your own ' +
      'spread as a free action. Does not count as your turn action.',
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