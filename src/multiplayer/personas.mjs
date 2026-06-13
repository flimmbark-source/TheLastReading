// Persona definitions. Each persona is a loadout identity chosen before a
// multiplayer match. Passives are applied by the reducer at init and round-start;
// they do not require story justification.
//
// `accent` is the persona's signature colour (hex). It drives the loadout
// screen's per-persona theming: icon tint, selection ring, and glow.
//
// `bio` is a one-line flavor description shown under the persona's name on the
// loadout screen. `tagline` is the short mechanical summary of the persona.
//
// `icon` is the inner markup of a 0 0 24 24 SVG glyph. It is rendered with
// `fill="none" stroke="currentColor"`, so it inherits `accent` via `color`.
// Use `fill="currentColor" stroke="none"` on any solid sub-shapes (e.g. dots).
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
    bio: 'A former crematorium keeper who left the furnace for the card table, at ease with ash and long silences.',
    accent: '#e8743c',
    icon: '<path d="M12 2.5c1 3 4 4.2 4 8.3a4 4 0 1 1-8 0c0-1.7.8-2.9 1.7-3.8C9.8 8.2 10.6 9.2 11 10c.6-2.7-1-4.7 1-7.5Z"/><path d="M11.8 21.5c1.6 0 2.9-1.1 2.9-2.6 0-1.5-1.4-2.2-1.9-3.4-.6 1-1.4 1.5-1.9 2.2-.5-.5-.7-1.1-.7-1.7-.6.6-1.2 1.5-1.2 2.6 0 1.6 1.3 2.9 2.8 2.9Z"/>',
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
    bio: "A pawnshop heir raised among other people's lost treasures, who has never once been able to let a thing go.",
    accent: '#e2b24a',
    icon: '<ellipse cx="12" cy="6" rx="7.5" ry="3"/><path d="M4.5 6v6c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3V6"/><path d="M4.5 12v6c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3v-6"/>',
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
    bio: 'A retired harbor pilot who guided ships through countless storms and learned to trust patience over daring.',
    accent: '#5fb0c9',
    icon: '<circle cx="12" cy="5" r="2.2"/><path d="M12 7.2V21"/><path d="M5 13a7 7 0 0 0 14 0"/><path d="M3 13h2M19 13h2M8.5 10h7"/>',
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
    bio: 'A back-alley card sharp barred from every honest house in the city, grinning wider as the stakes climb.',
    accent: '#74c47a',
    icon: '<rect x="4" y="4" width="16" height="16" rx="3.5"/><circle cx="8.8" cy="8.8" r="1.3" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.3" fill="currentColor" stroke="none"/><circle cx="15.2" cy="15.2" r="1.3" fill="currentColor" stroke="none"/>',
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
    tagline: 'Once per round: swap your Spread with your Hand.',
    bio: 'A field surgeon struck from the register for unsanctioned work, still proud of her flawless, unhurried hands.',
    accent: '#b98ad8',
    icon: '<polyline points="16 5 20 9 16 13"/><line x1="4" y1="9" x2="20" y2="9"/><polyline points="8 11 4 15 8 19"/><line x1="20" y1="15" x2="4" y2="15"/>',
    ability: {
      name: 'Transposition',
      tag: 'Once per Round',
      rules: 'On your turn, swap a card in your **Spread** with a card in your **Hand** for free.',
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
